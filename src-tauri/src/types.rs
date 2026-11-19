use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerTestResult {
    pub success: bool,
    pub latency: usize,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstalledApp {
    pub name: String,
    pub publisher: Option<String>,
    pub install_location: Option<String>,
}