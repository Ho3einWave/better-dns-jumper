import { SERVER } from "../types";

export const DEFAULT_SERVERS: SERVER[] = [
    // === Cloudflare ===
    {
        type: "dns",
        key: "CLOUDFLARE_DNS",
        name: "Cloudflare DNS",
        servers: ["1.1.1.1", "1.0.0.1"],
        tags: ["Cloudflare", "Privacy"],
    },
    {
        type: "doh",
        key: "CLOUDFLARE_DOH",
        name: "Cloudflare DoH",
        servers: ["https://cloudflare-dns.com/dns-query"],
        tags: ["Cloudflare", "Privacy"],
    },
    {
        type: "dot",
        key: "CLOUDFLARE_DOT",
        name: "Cloudflare DoT",
        servers: ["tls://one.one.one.one:853"],
        tags: ["Cloudflare", "Privacy"],
    },
    {
        type: "doq",
        key: "CLOUDFLARE_DOQ",
        name: "Cloudflare DoQ",
        servers: ["quic://one.one.one.one:853"],
        tags: ["Cloudflare", "Privacy"],
    },
    {
        type: "doh3",
        key: "CLOUDFLARE_DOH3",
        name: "Cloudflare DoH3",
        servers: ["h3://cloudflare-dns.com:443"],
        tags: ["Cloudflare", "Privacy"],
    },

    // === Google ===
    {
        type: "dns",
        key: "GOOGLE_DNS",
        name: "Google DNS",
        servers: ["8.8.8.8", "8.8.4.4"],
        tags: ["Google", "General"],
    },
    {
        type: "doh",
        key: "GOOGLE_DOH",
        name: "Google DoH",
        servers: ["https://dns.google/dns-query"],
        tags: ["Google", "General"],
    },
    {
        type: "dot",
        key: "GOOGLE_DOT",
        name: "Google DoT",
        servers: ["tls://dns.google:853"],
        tags: ["Google", "General"],
    },

    // === Quad9 ===
    {
        type: "dns",
        key: "QUAD9_DNS",
        name: "Quad9 DNS",
        servers: ["9.9.9.9", "149.112.112.112"],
        tags: ["Quad9", "Security"],
    },
    {
        type: "doh",
        key: "QUAD9_DOH",
        name: "Quad9 DoH",
        servers: ["https://dns.quad9.net/dns-query"],
        tags: ["Quad9", "Security"],
    },
    {
        type: "dot",
        key: "QUAD9_DOT",
        name: "Quad9 DoT",
        servers: ["tls://dns.quad9.net:853"],
        tags: ["Quad9", "Security"],
    },
    {
        type: "doq",
        key: "QUAD9_DOQ",
        name: "Quad9 DoQ",
        servers: ["quic://dns.quad9.net:853"],
        tags: ["Quad9", "Security"],
    },

    // === AdGuard ===
    {
        type: "dns",
        key: "ADGUARD_DNS",
        name: "AdGuard DNS",
        servers: ["94.140.14.14", "94.140.15.15"],
        tags: ["AdGuard", "AdBlock"],
    },
    {
        type: "doh",
        key: "ADGUARD_DOH",
        name: "AdGuard DoH",
        servers: ["https://dns.adguard-dns.com/dns-query"],
        tags: ["AdGuard", "AdBlock"],
    },
    {
        type: "dot",
        key: "ADGUARD_DOT",
        name: "AdGuard DoT",
        servers: ["tls://dns.adguard-dns.com:853"],
        tags: ["AdGuard", "AdBlock"],
    },
    {
        type: "doq",
        key: "ADGUARD_DOQ",
        name: "AdGuard DoQ",
        servers: ["quic://dns.adguard-dns.com:853"],
        tags: ["AdGuard", "AdBlock"],
    },

    // === ControlD (Free) ===
    {
        type: "dns",
        key: "CONTROLD_DNS",
        name: "ControlD DNS",
        servers: ["76.76.2.0", "76.76.10.0"],
        tags: ["ControlD", "Privacy"],
    },
    {
        type: "doh",
        key: "CONTROLD_DOH",
        name: "ControlD DoH",
        servers: ["https://p2.freedns.controld.com/dns-query"],
        tags: ["ControlD", "Privacy"],
    },
    {
        type: "dot",
        key: "CONTROLD_DOT",
        name: "ControlD DoT",
        servers: ["tls://p2.freedns.controld.com:853"],
        tags: ["ControlD", "Privacy"],
    },
    {
        type: "doq",
        key: "CONTROLD_DOQ",
        name: "ControlD DoQ",
        servers: ["quic://p2.freedns.controld.com:853"],
        tags: ["ControlD", "Privacy"],
    },
    {
        type: "doh3",
        key: "CONTROLD_DOH3",
        name: "ControlD DoH3",
        servers: ["h3://p2.freedns.controld.com:443"],
        tags: ["ControlD", "Privacy"],
    },

    // === Regional / Niche ===
    {
        type: "doh",
        key: "DYNX_ADBLOCK",
        name: "DynX AdBlock DoH",
        servers: ["https://dns.dynx.pro/dns-query"],
        tags: ["AdBlock", "Privacy"],
    },
    {
        type: "doh",
        key: "DYNX_ANTI_BAN_DOH",
        name: "DynX AntiBan DoH",
        servers: ["https://anti-ban.dynx.pro/dns-query"],
        tags: ["Bypass", "AntiBan", "Gaming"],
    },
    {
        type: "dns",
        key: "DYNX_ANTI_BAN_DNS",
        name: "DynX AntiBan DNS",
        servers: ["10.70.95.150", "10.70.95.162"],
        tags: ["Bypass", "AntiBan", "Gaming"],
    },
    {
        type: "dns",
        key: "SHECAN_DNS",
        name: "Shecan DNS",
        servers: ["178.22.122.100", "185.51.200.2"],
        tags: ["Iran", "Gaming", "Web"],
    },
    {
        type: "dns",
        key: "YANDEX_DNS",
        name: "Yandex DNS",
        servers: ["77.88.8.8", "77.88.8.1"],
        tags: ["Yandex", "Web"],
    },
];
