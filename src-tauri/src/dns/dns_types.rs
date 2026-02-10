use serde::{Deserialize, Serialize};

pub const MAX_LOG_ENTRIES: usize = 1000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DnsQueryStatus {
    Success,
    Error,
    Blocked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsQueryLog {
    pub id: u64,
    pub timestamp: String,
    pub domain: String,
    pub record_type: String,
    pub response_records: Vec<String>,
    pub latency_ms: u64,
    pub status: DnsQueryStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsRule {
    pub id: String,
    pub domain: String,
    pub response: String,
    pub enabled: bool,
    pub record_type: String,
}
