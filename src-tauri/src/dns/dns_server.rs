use hickory_proto::op::{Header, ResponseCode};
use hickory_proto::rr::rdata::{A, AAAA};
use hickory_proto::rr::{Name, RData, Record, RecordType};
use hickory_proto::runtime::TokioRuntimeProvider;
use hickory_proto::xfer::Protocol;
use hickory_resolver::config::{NameServerConfig, ResolverConfig, ResolverOpts};
use hickory_resolver::name_server::GenericConnector;
use hickory_resolver::{Resolver, TokioResolver};
use hickory_server::authority::MessageResponseBuilder;
use hickory_server::server::{
    Request, RequestHandler, ResponseHandler, ResponseInfo, ServerFuture,
};
use log::{debug, error, info};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};
use std::str::FromStr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::{mpsc, oneshot, Mutex, RwLock};
use tokio::time::Instant;

#[derive(Debug, serde::Deserialize)]
pub struct BootstrapResolverInfo {
    pub server: String,
    pub bootstrap_ip: Option<String>,
}

use super::dns_rules::DnsRules;
use super::dns_types::{DnsQueryLog, DnsQueryStatus};

pub struct DnsServer {
    pub resolver: Option<TokioResolver>,
    pub server: Option<Arc<Mutex<ServerFuture<DnsResolver>>>>,
    pub socket: Option<UdpSocket>,
    pub shutdown_sender: Option<oneshot::Sender<()>>,
    pub log_sender: Option<mpsc::UnboundedSender<DnsQueryLog>>,
    pub rules: Arc<RwLock<DnsRules>>,
    pub log_id_counter: Arc<AtomicU64>,
}

impl DnsServer {
    pub fn new(
        log_sender: mpsc::UnboundedSender<DnsQueryLog>,
        rules: Arc<RwLock<DnsRules>>,
    ) -> Self {
        Self {
            resolver: None,
            server: None,
            socket: None,
            shutdown_sender: None,
            log_sender: Some(log_sender),
            rules,
            log_id_counter: Arc::new(AtomicU64::new(1)),
        }
    }

    pub async fn run(
        &mut self,
        server: String,
        bootstrap_ip: Option<String>,
        bootstrap_resolver: Option<BootstrapResolverInfo>,
    ) -> Result<(), String> {
        let (domain, port, proto, http_endpoint) = Self::parse_server_url(&server)?;

        // Priority: bootstrap_ip > bootstrap_resolver > system DNS
        let effective_bootstrap_ip = if bootstrap_ip.is_some() {
            bootstrap_ip
        } else if let Some(ref resolver_info) = bootstrap_resolver {
            Some(Self::resolve_via_bootstrap(resolver_info, &domain).await?)
        } else {
            None
        };

        let resolver =
            DnsServer::create_dns_resolver(domain, port, proto, http_endpoint, effective_bootstrap_ip)
                .map_err(|e| {
                    error!("Failed to create DNS resolver: {}", e);
                    format!("Failed to create DNS resolver: {}", e)
                })?;

        let socket = self.create_udp_socket().await?;

        debug!("created socket: {:?}", socket);

        let dns_resolver = DnsResolver::new(
            resolver,
            self.log_sender.clone(),
            self.rules.clone(),
            self.log_id_counter.clone(),
        );

        let mut server = ServerFuture::new(dns_resolver);

        debug!("created server");

        server.register_socket(socket);

        let server = Arc::new(Mutex::new(server));
        self.server = Some(server.clone());

        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        self.shutdown_sender = Some(shutdown_tx);

        let server_clone = server.clone();
        tokio::spawn(async move {
            debug!("Dns server blocking until done");

            tokio::select! {
                result = async {
                    let mut server_guard = server_clone.lock().await;
                    server_guard.block_until_done().await
                } => {
                    match result {
                        Ok(_) => debug!("Dns server stopped (block_until_done completed)"),
                        Err(err) => error!("Dns server stopped with error: {}", err),
                    }
                }
                _ = shutdown_rx => {
                    debug!("Dns server received shutdown signal");
                    // Acquire lock to call shutdown_gracefully
                    // This will wait for the lock to be released by the cancelled branch above
                    let mut server_guard = server_clone.lock().await;
                    if let Err(_err) = server_guard.shutdown_gracefully().await {
                        error!("Error during graceful shutdown: {:?}", _err);
                    }
                    // Continue to block until done (should complete quickly after shutdown)
                    if let Err(_err) = server_guard.block_until_done().await {
                        error!("Dns server stopped with error");
                    }
                    debug!("Dns server stopped (after graceful shutdown)");
                }
            }
        });

        debug!("registered socket");

        Ok(())
    }

    pub async fn shutdown(&mut self) -> Result<(), String> {
        debug!("shutting down dns server");
        // Send shutdown signal to the spawned task instead of trying to acquire the lock
        if let Some(shutdown_tx) = self.shutdown_sender.take() {
            debug!("sending shutdown signal");
            if let Err(_) = shutdown_tx.send(()) {
                error!("shutdown signal receiver already dropped");
            } else {
                debug!("shutdown signal sent successfully");
            }
        }
        // Clear the server reference after shutdown
        self.server = None;
        debug!("dns server shutdown successfully");
        Ok(())
    }

    /// Parse a server URL string into (domain, port, protocol, http_endpoint).
    /// Supported schemes: https://, tls://, quic://, h3://
    pub fn parse_server_url(server: &str) -> Result<(String, u16, Protocol, Option<String>), String> {
        let server_url =
            url::Url::parse(server).map_err(|e| format!("Failed to parse server: {}", e))?;

        let scheme = server_url.scheme();
        let domain = server_url
            .host()
            .ok_or("Failed to get domain")?
            .to_string();

        match scheme {
            "https" => {
                let port = server_url.port().unwrap_or(443);
                let path = server_url.path().to_string();
                Ok((domain, port, Protocol::Https, Some(path)))
            }
            "tls" => {
                let port = server_url.port().unwrap_or(853);
                Ok((domain, port, Protocol::Tls, None))
            }
            "quic" => {
                let port = server_url.port().unwrap_or(853);
                Ok((domain, port, Protocol::Quic, None))
            }
            "h3" => {
                let port = server_url.port().unwrap_or(443);
                let path = server_url.path().to_string();
                let endpoint = if path.is_empty() || path == "/" {
                    "/dns-query".to_string()
                } else {
                    path
                };
                Ok((domain, port, Protocol::H3, Some(endpoint)))
            }
            _ => {
                error!("Unsupported protocol scheme: {}", scheme);
                Err(format!("Unsupported protocol scheme: {}", scheme))
            }
        }
    }

    pub fn create_dns_resolver(
        domain: String,
        port: u16,
        protocol: Protocol,
        http_endpoint: Option<String>,
        bootstrap_ip: Option<String>,
    ) -> Result<TokioResolver, String> {
        let mut config = ResolverConfig::new();

        let socket_addr = if let Some(ref ip_str) = bootstrap_ip {
            let ip: IpAddr = ip_str
                .parse()
                .map_err(|e| format!("Failed to parse bootstrap IP '{}': {}", ip_str, e))?;
            SocketAddr::new(ip, port)
        } else {
            let mut addrs = (domain.clone(), port)
                .to_socket_addrs()
                .map_err(|e| format!("Failed to resolve domain: {}", e))?;
            addrs
                .next()
                .ok_or(format!("Failed to resolve domain: {}", &domain))?
        };

        info!("DNS Server Resolved: {:?} (protocol: {:?})", socket_addr, protocol);

        let tls_dns_name = match protocol {
            Protocol::Udp | Protocol::Tcp => None,
            _ => Some(domain),
        };

        config.add_name_server(NameServerConfig {
            socket_addr,
            protocol,
            tls_dns_name,
            http_endpoint,
            bind_addr: None,
            trust_negative_responses: true,
        });

        let opts = ResolverOpts::default();

        let connector = GenericConnector::<TokioRuntimeProvider>::default();

        let resolver = Resolver::builder_with_config(config, connector)
            .with_options(opts)
            .build();

        Ok(resolver)
    }

    /// Resolve a domain using a bootstrap resolver (either plain DNS IP or DoH URL with its own bootstrap IP).
    pub async fn resolve_via_bootstrap(
        bootstrap: &BootstrapResolverInfo,
        domain: &str,
    ) -> Result<String, String> {
        let is_plain_ip = bootstrap.server.parse::<IpAddr>().is_ok();

        let resolver = if is_plain_ip {
            let ip: IpAddr = bootstrap
                .server
                .parse()
                .map_err(|e| format!("Failed to parse bootstrap IP: {}", e))?;
            let socket_addr = SocketAddr::new(ip, 53);

            let mut config = ResolverConfig::new();
            config.add_name_server(NameServerConfig {
                socket_addr,
                protocol: Protocol::Udp,
                tls_dns_name: None,
                http_endpoint: None,
                bind_addr: None,
                trust_negative_responses: true,
            });

            let opts = ResolverOpts::default();
            let connector = GenericConnector::<TokioRuntimeProvider>::default();

            Resolver::builder_with_config(config, connector)
                .with_options(opts)
                .build()
        } else {
            let (resolver_domain, port, proto, http_endpoint) =
                Self::parse_server_url(&bootstrap.server)?;
            Self::create_dns_resolver(
                resolver_domain,
                port,
                proto,
                http_endpoint,
                bootstrap.bootstrap_ip.clone(),
            )?
        };

        let lookup = resolver
            .lookup_ip(domain)
            .await
            .map_err(|e| format!("Bootstrap resolution failed for '{}': {}", domain, e))?;

        let ip = lookup
            .iter()
            .next()
            .ok_or(format!("Bootstrap resolver returned no IPs for '{}'", domain))?;

        info!("Bootstrap resolved '{}' to {}", domain, ip);
        Ok(ip.to_string())
    }

    pub async fn create_udp_socket(&self) -> Result<UdpSocket, String> {
        let socket = UdpSocket::bind("127.0.0.2:53")
            .await
            .map_err(|e| format!("Failed to create UDP socket: {}", e))?;

        Ok(socket)
    }

    pub async fn is_running(&self) -> bool {
        self.server.is_some()
    }
}

pub struct DnsResolver {
    resolver: TokioResolver,
    log_sender: Option<mpsc::UnboundedSender<DnsQueryLog>>,
    rules: Arc<RwLock<DnsRules>>,
    log_id_counter: Arc<AtomicU64>,
}

impl DnsResolver {
    pub fn new(
        resolver: TokioResolver,
        log_sender: Option<mpsc::UnboundedSender<DnsQueryLog>>,
        rules: Arc<RwLock<DnsRules>>,
        log_id_counter: Arc<AtomicU64>,
    ) -> Self {
        Self {
            resolver,
            log_sender,
            rules,
            log_id_counter,
        }
    }

    fn next_log_id(&self) -> u64 {
        self.log_id_counter.fetch_add(1, Ordering::Relaxed)
    }

    fn send_log(&self, log: DnsQueryLog) {
        if let Some(ref sender) = self.log_sender {
            let _ = sender.send(log);
        }
    }

    fn record_type_str(rt: RecordType) -> String {
        format!("{:?}", rt)
    }
}

#[async_trait::async_trait]
impl RequestHandler for DnsResolver {
    async fn handle_request<R: ResponseHandler>(
        &self,
        request: &Request,
        mut response_handle: R,
    ) -> ResponseInfo {
        let resolver = &self.resolver;
        if let Some(query) = request.queries().first() {
            let name = query.name().to_ascii();
            let record_type = query.query_type();

            debug!("Received query: {} {:?}", name, record_type);

            // Strip trailing dot for matching
            let domain_clean = name.trim_end_matches('.').to_lowercase();
            let record_type_string = Self::record_type_str(record_type);

            // Check rules before forwarding
            {
                let rules = self.rules.read().await;
                if let Some(rule) = rules.match_domain(&domain_clean) {
                    debug!("Rule matched for {}: -> {}", domain_clean, rule.response);

                    // Build synthetic response based on record type
                    let record_name = Name::from_ascii(&name).unwrap_or_default();
                    let synthetic_record: Option<Record<RData>> = match record_type {
                        RecordType::A => {
                            if let Ok(ip) = Ipv4Addr::from_str(&rule.response) {
                                Some(Record::from_rdata(record_name, 60, RData::A(A(ip))))
                            } else {
                                None
                            }
                        }
                        RecordType::AAAA => {
                            if let Ok(ip) = Ipv6Addr::from_str(&rule.response) {
                                Some(Record::from_rdata(record_name, 60, RData::AAAA(AAAA(ip))))
                            } else {
                                // For AAAA queries with an IPv4 rule response, return empty (no records)
                                None
                            }
                        }
                        _ => None,
                    };

                    let response = MessageResponseBuilder::from_message_request(request);
                    let mut header = Header::response_from_request(request.header());
                    header.set_response_code(ResponseCode::NoError);

                    let result = if let Some(ref rec) = synthetic_record {
                        response_handle
                            .send_response(response.build(
                                header,
                                std::iter::once(rec),
                                &[],
                                &[],
                                &[],
                            ))
                            .await
                    } else {
                        response_handle
                            .send_response(response.build_no_records(header))
                            .await
                    };

                    // Log blocked entry
                    self.send_log(DnsQueryLog {
                        id: self.next_log_id(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        domain: domain_clean.clone(),
                        record_type: record_type_string,
                        response_records: synthetic_record
                            .as_ref()
                            .map(|r| vec![r.data().to_string()])
                            .unwrap_or_default(),
                        latency_ms: 0,
                        status: DnsQueryStatus::Blocked,
                    });

                    return match result {
                        Err(e) => {
                            error!("Error sending blocked response: {}", e);
                            let mut err_header = Header::response_from_request(request.header());
                            err_header.set_response_code(ResponseCode::ServFail);
                            err_header.into()
                        }
                        Ok(info) => info,
                    };
                }
            }

            // No rule matched — forward to DoH resolver
            let start = Instant::now();

            // Perform DNS lookup through DoH resolver and convert to Vec<Record>
            let records_result: Result<Vec<Record>, _> = match record_type {
                RecordType::A | RecordType::AAAA => resolver
                    .lookup_ip(name.clone())
                    .await
                    .map(|lookup| lookup.as_lookup().record_iter().cloned().collect()),
                RecordType::TXT => resolver
                    .txt_lookup(name.clone())
                    .await
                    .map(|lookup| lookup.as_lookup().record_iter().cloned().collect()),
                RecordType::MX => resolver
                    .mx_lookup(name.clone())
                    .await
                    .map(|lookup| lookup.as_lookup().record_iter().cloned().collect()),
                _ => {
                    error!("Unsupported record type: {:?}", record_type);
                    let response = MessageResponseBuilder::from_message_request(request);
                    let mut header = Header::response_from_request(request.header());
                    header.set_response_code(ResponseCode::NotImp);
                    let result = response_handle
                        .send_response(response.build_no_records(header))
                        .await;
                    return match result {
                        Err(e) => {
                            error!("Error sending response: {}", e);
                            let mut err_header = Header::response_from_request(request.header());
                            err_header.set_response_code(ResponseCode::ServFail);
                            err_header.into()
                        }
                        Ok(info) => info,
                    };
                }
            };

            let latency_ms = start.elapsed().as_millis() as u64;

            // Build response
            let response = MessageResponseBuilder::from_message_request(request);
            let mut header = Header::response_from_request(request.header());

            let (result, log_status, log_records) = if let Ok(ref records) = records_result {
                header.set_response_code(ResponseCode::NoError);
                let response_records: Vec<String> =
                    records.iter().map(|r| r.data().to_string()).collect();
                let send_result = response_handle
                    .send_response(response.build(header, records.iter(), &[], &[], &[]))
                    .await;
                (send_result, DnsQueryStatus::Success, response_records)
            } else {
                header.set_response_code(ResponseCode::ServFail);
                let send_result = response_handle
                    .send_response(response.build_no_records(header))
                    .await;
                (
                    send_result,
                    DnsQueryStatus::Error,
                    vec![records_result.unwrap_err().to_string()],
                )
            };

            // Log the query
            self.send_log(DnsQueryLog {
                id: self.next_log_id(),
                timestamp: chrono::Utc::now().to_rfc3339(),
                domain: domain_clean,
                record_type: record_type_string,
                response_records: log_records,
                latency_ms,
                status: log_status,
            });

            match result {
                Err(e) => {
                    error!("Error sending response: {}", e);
                    let mut err_header = Header::response_from_request(request.header());
                    err_header.set_response_code(ResponseCode::ServFail);
                    err_header.into()
                }
                Ok(info) => info,
            }
        } else {
            // No queries in request
            let response = MessageResponseBuilder::from_message_request(request);
            let mut header = Header::response_from_request(request.header());
            header.set_response_code(ResponseCode::FormErr);
            let result = response_handle
                .send_response(response.build_no_records(header))
                .await;

            match result {
                Err(e) => {
                    error!("Error sending response: {}", e);
                    let mut err_header = Header::response_from_request(request.header());
                    err_header.set_response_code(ResponseCode::ServFail);
                    err_header.into()
                }
                Ok(info) => info,
            }
        }
    }
}
