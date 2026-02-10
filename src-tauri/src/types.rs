use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerTestResult {
    pub success: bool,
    pub latency: usize,
    pub error: Option<String>,
}
