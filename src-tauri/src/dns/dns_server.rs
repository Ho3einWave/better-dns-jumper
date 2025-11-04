use hickory_proto::op::{Header, ResponseCode};
use hickory_proto::rr::{Record, RecordType};
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
use std::net::ToSocketAddrs;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::{oneshot, Mutex};

pub struct DnsServer {
    pub resolver: Option<TokioResolver>,
    pub server: Option<Arc<Mutex<ServerFuture<DnsResolver>>>>,
    pub socket: Option<UdpSocket>,
    pub shutdown_sender: Option<oneshot::Sender<()>>,
}

impl DnsServer {
    pub fn new() -> Self {
        Self {
            resolver: None,
            server: None,
            socket: None,
            shutdown_sender: None,
        }
    }

    pub async fn run(&mut self, server: String) -> Result<(), String> {
        let server_url =
            url::Url::parse(&server).map_err(|e| format!("Failed to parse server: {}", e))?;

        let protocol = server_url.scheme();
        if protocol != "https" {
            error!("Invalid protocol: {}", protocol);
            return Err(format!("Invalid protocol: {}", protocol));
        }

        let domain = server_url.host().ok_or("Failed to get domain")?;
        let port = server_url.port().unwrap_or(443);
        let path = server_url.path();

        let resolver =
            DnsServer::create_dns_resolver(domain.to_string(), port, Some(path.to_string()));
        if resolver.is_err() {
            return Err(resolver.err().unwrap());
        }

        let socket = self.create_udp_socket().await?;

        debug!("created socket: {:?}", socket);

        let mut server = ServerFuture::new(DnsResolver::new(resolver.unwrap()));

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

    pub fn create_dns_resolver(
        domain: String,
        port: u16,
        http_endpoint: Option<String>,
    ) -> Result<TokioResolver, String> {
        let mut config = ResolverConfig::new();

        let mut socket_addr = (domain.clone(), port)
            .to_socket_addrs()
            .map_err(|e| format!("Failed to resolve domain: {}", e))?;

        let socket_addr = socket_addr
            .next()
            .ok_or(format!("Failed to resolve domain: {}", &domain))?;

        info!("DNS Server Resolved: {:?}", socket_addr);

        config.add_name_server(NameServerConfig {
            socket_addr,
            protocol: Protocol::Https,
            tls_dns_name: Some(domain),
            http_endpoint: http_endpoint,
            bind_addr: None,
            trust_negative_responses: true,
        });

        let opts = ResolverOpts::default();

        let connector = GenericConnector::<TokioRuntimeProvider>::default();

        let resolver = Resolver::builder_with_config(config, connector)
            .with_options(opts)
            .build();

        dbg!(&resolver);

        Ok(resolver)
    }

    pub async fn create_udp_socket(&self) -> Result<UdpSocket, String> {
        let socket = UdpSocket::bind("127.0.0.2:53")
            .await
            .map_err(|e| format!("Failed to create UDP socket: {}", e))?;

        Ok(socket)
    }
}

pub struct DnsResolver {
    resolver: TokioResolver,
}

impl DnsResolver {
    pub fn new(resolver: TokioResolver) -> Self {
        Self { resolver }
    }
}

#[async_trait::async_trait]
impl RequestHandler for DnsResolver {
    async fn handle_request<R: ResponseHandler>(
        &self,
        request: &Request,
        mut response_handle: R,
    ) -> ResponseInfo {
        println!("handle_request");
        let resolver = &self.resolver;
        if let Some(query) = request.queries().first() {
            let name = query.name().to_ascii();
            let record_type = query.query_type();

            println!("Received query: {} {:?}", name, record_type);

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
                    println!("Unsupported record type: {:?}", record_type);
                    let response = MessageResponseBuilder::from_message_request(request);
                    let mut header = Header::response_from_request(request.header());
                    header.set_response_code(ResponseCode::NotImp);
                    let result = response_handle
                        .send_response(response.build_no_records(header))
                        .await;
                    return match result {
                        Err(e) => {
                            eprintln!("Error sending response: {}", e);
                            let mut err_header = Header::response_from_request(request.header());
                            err_header.set_response_code(ResponseCode::ServFail);
                            err_header.into()
                        }
                        Ok(info) => info,
                    };
                }
            };

            // Build response
            let response = MessageResponseBuilder::from_message_request(request);
            let mut header = Header::response_from_request(request.header());

            let result = if let Ok(records) = records_result {
                header.set_response_code(ResponseCode::NoError);
                response_handle
                    .send_response(response.build(header, records.iter(), &[], &[], &[]))
                    .await
            } else {
                header.set_response_code(ResponseCode::ServFail);
                response_handle
                    .send_response(response.build_no_records(header))
                    .await
            };

            match result {
                Err(e) => {
                    eprintln!("Error sending response: {}", e);
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
                    eprintln!("Error sending response: {}", e);
                    let mut err_header = Header::response_from_request(request.header());
                    err_header.set_response_code(ResponseCode::ServFail);
                    err_header.into()
                }
                Ok(info) => info,
            }
        }
    }
}
