export type SERVER = {
    type: "doh" | "dns" | "dot" | "doq" | "doh3";
    key: string;
    name: string;
    servers: string[];
    tags: string[];
    bootstrap_ips?: string[];
};

export type Protocol = {
    key: string;
    name: string;
    description: string;
    defaultPort?: number;
    color: "primary" | "secondary" | "success" | "warning" | "danger";
};

export const PROTOCOLS: Protocol[] = [
    {
        key: "dns",
        name: "DNS",
        description: "Plain DNS over UDP/TCP — unencrypted, fastest but no privacy",
        color: "primary",
    },
    {
        key: "doh",
        name: "DoH",
        description: "DNS over HTTPS — encrypted queries via HTTPS (port 443)",
        defaultPort: 443,
        color: "success",
    },
    {
        key: "dot",
        name: "DoT",
        description: "DNS over TLS — encrypted queries via dedicated TLS connection",
        defaultPort: 853,
        color: "warning",
    },
    {
        key: "doq",
        name: "DoQ",
        description: "DNS over QUIC — encrypted queries via QUIC transport protocol",
        defaultPort: 853,
        color: "secondary",
    },
    {
        key: "doh3",
        name: "DoH3",
        description: "DNS over HTTP/3 — encrypted queries via HTTP/3 (QUIC-based)",
        defaultPort: 443,
        color: "danger",
    },
];

export type DnsQueryLog = {
    id: number;
    timestamp: string;
    domain: string;
    record_type: string;
    response_records: string[];
    latency_ms: number;
    status: "success" | "error" | "blocked";
};

export type DnsRule = {
    id: string;
    domain: string;
    response: string;
    enabled: boolean;
    record_type: string;
};
