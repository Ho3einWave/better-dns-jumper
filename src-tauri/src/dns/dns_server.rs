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
use std::net::ToSocketAddrs;
use tokio::net::UdpSocket;

pub struct DnsServer {
    pub resolver: Option<TokioResolver>,
    pub server: Option<ServerFuture<DnsServer>>,
    pub socket: Option<UdpSocket>,
}

impl DnsServer {
    pub fn new() -> Self {
        Self {
            resolver: None,
            server: None,
            socket: None,
        }
    }

    pub fn run(&mut self, server: String) -> Result<(), String> {
        let server_url =
            url::Url::parse(&server).map_err(|e| format!("Failed to parse server: {}", e))?;

        let protocol = server_url.scheme();
        if protocol != "https" {
            return Err(format!("Invalid protocol: {}", protocol));
        }

        let domain = server_url.host().ok_or("Failed to get domain")?;
        let port = server_url.port().unwrap_or(443);
        let path = server_url.path();

        let resolver = self.create_dns_resolver(domain.to_string(), port, Some(path.to_string()));
        if resolver.is_err() {
            return Err(resolver.err().unwrap());
        }

        let socket = self.create_udp_socket();
        if socket.is_err() {
            return Err(socket.err().unwrap());
        }

        let mut server = ServerFuture::new(DnsServer {
            resolver: Some(resolver.unwrap()),
            server: None,
            socket: None,
        });

        server.register_socket(socket.unwrap());

        self.server = Some(server);

        Ok(())
    }

    pub fn create_dns_resolver(
        &self,
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

    pub fn create_udp_socket(&self) -> Result<UdpSocket, String> {
        let socket = UdpSocket::bind("127.0.0.1:53").await;

        Ok(socket)
    }

    pub fn shutdown(&mut self) -> Result<(), String> {
        if let Some(server) = self.server.as_mut() {
            server.shutdown_gracefully();
        }
        Ok(())
    }
}

#[async_trait::async_trait]
impl RequestHandler for DnsServer {
    async fn handle_request<R: ResponseHandler>(
        &self,
        request: &Request,
        mut response_handle: R,
    ) -> ResponseInfo {
        let resolver = self.resolver.as_ref().unwrap();
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
