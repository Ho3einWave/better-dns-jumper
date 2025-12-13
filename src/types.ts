export interface SERVER {
    type: "doh" | "dns";
    key: string;
    name: string;
    servers: string[];
    tags: string[];
}

export const PROTOCOLS: Protocol[] = [
    {
        key: "dns",
        name: "DNS",
    },
    {
        key: "doh",
        name: "DoH",
    },
];

export interface Protocol {
    key: string;
    name: string;
}
