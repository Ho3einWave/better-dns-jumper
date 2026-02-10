export type SERVER = {
    type: "doh" | "dns" | "dot" | "doq" | "doh3";
    key: string;
    name: string;
    servers: string[];
    tags: string[];
};

export const PROTOCOLS: Protocol[] = [
    {
        key: "dns",
        name: "DNS",
    },
    {
        key: "doh",
        name: "DoH",
    },
    {
        key: "dot",
        name: "DoT",
    },
    {
        key: "doq",
        name: "DoQ",
    },
    {
        key: "doh3",
        name: "DoH3",
    },
];

export type Protocol = {
    key: string;
    name: string;
};

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
