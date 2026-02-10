use std::collections::HashMap;

use super::dns_types::DnsRule;

pub struct DnsRules {
    exact: HashMap<String, DnsRule>,
    wildcard: Vec<DnsRule>,
}

impl DnsRules {
    pub fn new() -> Self {
        Self {
            exact: HashMap::new(),
            wildcard: Vec::new(),
        }
    }

    pub fn match_domain(&self, domain: &str) -> Option<&DnsRule> {
        let domain_lower = domain.to_lowercase();

        // Check exact match first
        if let Some(rule) = self.exact.get(&domain_lower) {
            if rule.enabled {
                return Some(rule);
            }
        }

        // Check wildcard rules
        for rule in &self.wildcard {
            if !rule.enabled {
                continue;
            }
            // rule.domain is like "*.ads.example.com"
            // Strip the "*." prefix to get the suffix
            let suffix = &rule.domain[2..].to_lowercase();
            // Matches "ads.example.com" itself and any subdomain like "foo.ads.example.com"
            if domain_lower == *suffix || domain_lower.ends_with(&format!(".{}", suffix)) {
                return Some(rule);
            }
        }

        None
    }

    pub fn add_rule(&mut self, rule: DnsRule) {
        let domain_lower = rule.domain.to_lowercase();
        if domain_lower.starts_with("*.") {
            // Remove any existing wildcard with same domain
            self.wildcard.retain(|r| r.domain.to_lowercase() != domain_lower);
            self.wildcard.push(DnsRule {
                domain: domain_lower,
                ..rule
            });
        } else {
            self.exact.insert(domain_lower.clone(), DnsRule {
                domain: domain_lower,
                ..rule
            });
        }
    }

    pub fn remove_rule(&mut self, id: &str) {
        self.exact.retain(|_, r| r.id != id);
        self.wildcard.retain(|r| r.id != id);
    }

    pub fn toggle_rule(&mut self, id: &str) {
        if let Some(rule) = self.exact.values_mut().find(|r| r.id == id) {
            rule.enabled = !rule.enabled;
            return;
        }
        if let Some(rule) = self.wildcard.iter_mut().find(|r| r.id == id) {
            rule.enabled = !rule.enabled;
        }
    }

    pub fn to_vec(&self) -> Vec<DnsRule> {
        let mut rules: Vec<DnsRule> = Vec::new();
        rules.extend(self.exact.values().cloned());
        rules.extend(self.wildcard.iter().cloned());
        rules
    }

    pub fn load_rules(&mut self, rules: Vec<DnsRule>) {
        self.exact.clear();
        self.wildcard.clear();
        for rule in rules {
            self.add_rule(rule);
        }
    }
}
