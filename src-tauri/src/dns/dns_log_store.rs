use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};

use super::dns_types::{DnsQueryLog, MAX_LOG_ENTRIES};

pub struct DnsLogStore {
    logs: Arc<Mutex<VecDeque<DnsQueryLog>>>,
}

impl DnsLogStore {
    pub fn from_receiver(rx: mpsc::UnboundedReceiver<DnsQueryLog>) -> Self {
        let logs = Arc::new(Mutex::new(VecDeque::with_capacity(MAX_LOG_ENTRIES)));

        // Spawn the receiver task
        tokio::spawn(Self::start_receiver(rx, logs.clone()));

        Self { logs }
    }

    async fn start_receiver(
        mut rx: mpsc::UnboundedReceiver<DnsQueryLog>,
        logs: Arc<Mutex<VecDeque<DnsQueryLog>>>,
    ) {
        while let Some(log_entry) = rx.recv().await {
            let mut buffer = logs.lock().await;
            if buffer.len() >= MAX_LOG_ENTRIES {
                buffer.pop_back();
            }
            buffer.push_front(log_entry);
        }
    }

    pub async fn get_logs(
        &self,
        filter: Option<String>,
        offset: Option<usize>,
        limit: Option<usize>,
    ) -> Vec<DnsQueryLog> {
        let buffer = self.logs.lock().await;
        let offset = offset.unwrap_or(0);
        let limit = limit.unwrap_or(100);

        let iter = buffer.iter();

        let filtered: Vec<DnsQueryLog> = match filter {
            Some(ref f) if !f.is_empty() => {
                let f_lower = f.to_lowercase();
                iter.filter(|log| log.domain.to_lowercase().contains(&f_lower))
                    .skip(offset)
                    .take(limit)
                    .cloned()
                    .collect()
            }
            _ => iter.skip(offset).take(limit).cloned().collect(),
        };

        filtered
    }

    pub async fn clear_logs(&self) {
        let mut buffer = self.logs.lock().await;
        buffer.clear();
    }
}
