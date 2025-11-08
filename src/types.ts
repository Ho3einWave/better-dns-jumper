export type SERVER = {
    type: "doh" | "dns";
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
];

export type Protocol = {
    key: string;
    name: string;
};
