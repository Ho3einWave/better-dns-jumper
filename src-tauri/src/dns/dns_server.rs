use anyhow::Ok;
use hickory_proto::{runtime::TokioRuntimeProvider, xfer::Protocol};
use hickory_resolver::{
    config::{NameServerConfig, ResolverConfig, ResolverOpts},
    name_server::GenericConnector,
    Resolver, TokioResolver,
};
use std::net::ToSocketAddrs;

#[derive(Debug, Clone)]
pub struct DnsServer {
    pub resolver: Option<TokioResolver>,
}

impl DnsServer {
    pub fn new() -> Self {
        Self { resolver: None }
    }

    pub fn create_dns_resolver(
        &mut self,
        domain: String,
        port: u16,
        http_endpoint: Option<String>,
    ) -> Result<(), String> {
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

        self.resolver = Some(resolver);

        Ok(());
    }

    pub fn run(&self, server: String) -> Result<(), String> {
        let server_url = url::Url::parse(&server);

        Ok(());
    }
}
