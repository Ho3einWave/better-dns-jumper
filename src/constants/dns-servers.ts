import type { SERVER } from "../types";

export const DNS_SERVERS: SERVER[] = [
    {
        type: "dns",
        key: "GOOGLE",
        name: "Google DNS",
        servers: ["8.8.8.8", "8.8.4.4"],
        tags: ["General", "Web"],
    },
    {
        type: "dns",
        key: "CLOUDFLARE",
        name: "Cloudflare DNS",
        servers: ["1.1.1.1", "1.0.0.1"],
        tags: ["General", "Web"],
    },
    {
        type: "dns",
        key: "SHECAN",
        name: "Shecan DNS",
        servers: ["178.22.122.100", "185.51.200.2"],
        tags: ["Iran", "Gaming", "Web", "Ai"],
    },
    {
        type: "dns",
        key: "US_DYN",
        name: "DynX AdBlocker",
        servers: ["216.146.35.35", "216.146.36.36"],
        tags: ["Web", "Ad Blocker", "Gaming"],
    },
    {
        type: "dns",
        key: " DYNX_IRAN_ANTI_SANCTIONS",
        name: "DynX Iran Anti Sanctions",
        servers: ["10.70.95.150", "10.70.95.162"],
        tags: ["Bypass", "Ad Blocker", "Gaming"],
    },
    {
        type: "dns",
        key: "ADGUARD",
        name: "AdGuard",
        servers: ["94.140.14.14", "94.140.15.15"],
        tags: ["Web", "Ad Blocker"],
    },
    {
        type: "dns",
        key: "YANDEX",
        name: "Yandex DNS",
        servers: ["77.88.8.8", "77.88.8.1"],
        tags: ["Web"],
    },
];

export const DOH_SERVERS: SERVER[] = [
    {
        type: "doh",
        key: "DYNX",
        name: "DynX DoH",
        servers: ["https://dns.dynx.pro/dns-query"],
        tags: ["Web"],
    },
    {
        type: "doh",
        key: "GOOGLE",
        name: "Google DoH",
        servers: ["https://dns.google/dns-query"],
        tags: ["Web"],
    },
    {
        type: "doh",
        key: "CLOUDFLARE",
        name: "Cloudflare DoH",
        servers: ["https://cloudflare-dns.com/dns-query"],
        tags: ["Web"],
    },
    {
        type: "doh",
        key: "HW_CFW",
        name: "HW CFW DoH",
        servers: ["https://doh.hoseinwave.ir/dns-query"],
        tags: ["Web"],
    },
    {
        type: "doh",
        key: "HW_CFW_RAW_DOMAIN",
        name: "HW CFW DoH RAW DOMAIN",
        servers: ["https://doh-cf-workers.ho3einwave.workers.dev/dns-query"],
        tags: ["Web"],
    },
];
