export const DNS_SERVERS: DNS_SERVER[] = [
    {
        key: "GOOGLE",
        name: "Google DNS",
        servers: ["8.8.8.8", "8.8.4.4"],
        tags: ["General", "Web"],
    },
    {
        key: "CLOUDFLARE",
        name: "Cloudflare DNS",
        servers: ["1.1.1.1", "1.0.0.1"],
        tags: ["General", "Web"],
    },
    {
        key: "SHECAN",
        name: "Shecan DNS",
        servers: ["178.22.122.100", "185.51.200.2"],
        tags: ["Iran", "Gaming", "Web", "Ai"],
    },
    {
        key: "US_DYN",
        name: "DynX AdBlocker",
        servers: ["216.146.35.35", "216.146.36.36"],
        tags: ["Web", "Ad Blocker", "Gaming"],
    },
    {
        key: " DYNX_IRAN_ANTI_SANCTIONS",
        name: "DynX Iran Anti Sanctions",
        servers: ["10.70.95.150", "10.70.95.162"],
        tags: ["Bypass", "Ad Blocker", "Gaming"],
    },
    {
        key: "ADGUARD",
        name: "AdGuard",
        servers: ["94.140.14.14", "94.140.15.15"],
        tags: ["Web", "Ad Blocker"],
    },
    {
        key: "YANDEX",
        name: "Yandex DNS",
        servers: ["77.88.8.8", "77.88.8.1"],
        tags: ["Web"],
    },
];

export type DNS_SERVER = {
    key: string;
    name: string;
    servers: string[];
    tags: string[];
};
