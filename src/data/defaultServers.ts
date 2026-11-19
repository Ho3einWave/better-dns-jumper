import { SERVER } from "../types";

export const DEFAULT_SERVERS: SERVER[] = [
    // === Cloudflare (Istanbul PoP — fastest in Turkey) ===
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
        bootstrap_ips: ["1.1.1.1"],
    },
    {
        type: "dot",
        key: "CLOUDFLARE_DOT",
        name: "Cloudflare DoT",
        servers: ["tls://one.one.one.one:853"],
        tags: ["Cloudflare", "Privacy"],
        bootstrap_ips: ["1.1.1.1"],
    },
    {
        type: "doq",
        key: "CLOUDFLARE_DOQ",
        name: "Cloudflare DoQ",
        servers: ["quic://one.one.one.one:853"],
        tags: ["Cloudflare", "Privacy"],
        bootstrap_ips: ["1.1.1.1"],
    },
    {
        type: "doh3",
        key: "CLOUDFLARE_DOH3",
        name: "Cloudflare DoH3",
        servers: ["h3://cloudflare-dns.com:443"],
        tags: ["Cloudflare", "Privacy"],
        bootstrap_ips: ["1.1.1.1"],
    },

    // === Cloudflare Security (malware blocking) ===
    {
        type: "dns",
        key: "CLOUDFLARE_SECURITY_DNS",
        name: "Cloudflare Security",
        servers: ["1.1.1.2", "1.0.0.2"],
        tags: ["Cloudflare", "Security"],
    },
    {
        type: "doh",
        key: "CLOUDFLARE_SECURITY_DOH",
        name: "Cloudflare Security DoH",
        servers: ["https://security.cloudflare-dns.com/dns-query"],
        tags: ["Cloudflare", "Security"],
        bootstrap_ips: ["1.1.1.2"],
    },
    {
        type: "dot",
        key: "CLOUDFLARE_SECURITY_DOT",
        name: "Cloudflare Security DoT",
        servers: ["tls://security.cloudflare-dns.com:853"],
        tags: ["Cloudflare", "Security"],
        bootstrap_ips: ["1.1.1.2"],
    },

    // === Cloudflare Family (malware + adult blocking) ===
    {
        type: "dns",
        key: "CLOUDFLARE_FAMILY_DNS",
        name: "Cloudflare Family",
        servers: ["1.1.1.3", "1.0.0.3"],
        tags: ["Cloudflare", "Family"],
    },
    {
        type: "doh",
        key: "CLOUDFLARE_FAMILY_DOH",
        name: "Cloudflare Family DoH",
        servers: ["https://family.cloudflare-dns.com/dns-query"],
        tags: ["Cloudflare", "Family"],
        bootstrap_ips: ["1.1.1.3"],
    },
    {
        type: "dot",
        key: "CLOUDFLARE_FAMILY_DOT",
        name: "Cloudflare Family DoT",
        servers: ["tls://family.cloudflare-dns.com:853"],
        tags: ["Cloudflare", "Family"],
        bootstrap_ips: ["1.1.1.3"],
    },

    // === Google (Istanbul cache — very fast in Turkey) ===
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
        bootstrap_ips: ["8.8.8.8"],
    },
    {
        type: "dot",
        key: "GOOGLE_DOT",
        name: "Google DoT",
        servers: ["tls://dns.google:853"],
        tags: ["Google", "General"],
        bootstrap_ips: ["8.8.8.8"],
    },

    // === Quad9 (malware blocking + DNSSEC) ===
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
        bootstrap_ips: ["9.9.9.9"],
    },
    {
        type: "dot",
        key: "QUAD9_DOT",
        name: "Quad9 DoT",
        servers: ["tls://dns.quad9.net:853"],
        tags: ["Quad9", "Security"],
        bootstrap_ips: ["9.9.9.9"],
    },
    {
        type: "doq",
        key: "QUAD9_DOQ",
        name: "Quad9 DoQ",
        servers: ["quic://dns.quad9.net:853"],
        tags: ["Quad9", "Security"],
        bootstrap_ips: ["9.9.9.9"],
    },

    // === AdGuard (ads + trackers blocking) ===
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
        bootstrap_ips: ["94.140.14.14"],
    },
    {
        type: "dot",
        key: "ADGUARD_DOT",
        name: "AdGuard DoT",
        servers: ["tls://dns.adguard-dns.com:853"],
        tags: ["AdGuard", "AdBlock"],
        bootstrap_ips: ["94.140.14.14"],
    },
    {
        type: "doq",
        key: "ADGUARD_DOQ",
        name: "AdGuard DoQ",
        servers: ["quic://dns.adguard-dns.com:853"],
        tags: ["AdGuard", "AdBlock"],
        bootstrap_ips: ["94.140.14.14"],
    },

    // === AdGuard Family (ads + trackers + adult blocking, safe search) ===
    {
        type: "dns",
        key: "ADGUARD_FAMILY_DNS",
        name: "AdGuard Family",
        servers: ["94.140.14.15", "94.140.15.16"],
        tags: ["AdGuard", "Family"],
    },
    {
        type: "doh",
        key: "ADGUARD_FAMILY_DOH",
        name: "AdGuard Family DoH",
        servers: ["https://family.adguard-dns.com/dns-query"],
        tags: ["AdGuard", "Family"],
        bootstrap_ips: ["94.140.14.15"],
    },
    {
        type: "dot",
        key: "ADGUARD_FAMILY_DOT",
        name: "AdGuard Family DoT",
        servers: ["tls://family.adguard-dns.com:853"],
        tags: ["AdGuard", "Family"],
        bootstrap_ips: ["94.140.14.15"],
    },
    {
        type: "doq",
        key: "ADGUARD_FAMILY_DOQ",
        name: "AdGuard Family DoQ",
        servers: ["quic://family.adguard-dns.com:853"],
        tags: ["AdGuard", "Family"],
        bootstrap_ips: ["94.140.14.15"],
    },

    // === OpenDNS (Cisco — phishing protection) ===
    {
        type: "dns",
        key: "OPENDNS_DNS",
        name: "OpenDNS",
        servers: ["208.67.222.222", "208.67.220.220"],
        tags: ["OpenDNS", "Security"],
    },
    {
        type: "doh",
        key: "OPENDNS_DOH",
        name: "OpenDNS DoH",
        servers: ["https://doh.opendns.com/dns-query"],
        tags: ["OpenDNS", "Security"],
        bootstrap_ips: ["208.67.222.222"],
    },

    // === OpenDNS FamilyShield (blocks adult + proxy/anonymizer) ===
    {
        type: "dns",
        key: "OPENDNS_FAMILY_DNS",
        name: "OpenDNS Family",
        servers: ["208.67.222.123", "208.67.220.123"],
        tags: ["OpenDNS", "Family"],
    },
    {
        type: "doh",
        key: "OPENDNS_FAMILY_DOH",
        name: "OpenDNS Family DoH",
        servers: ["https://doh.familyshield.opendns.com/dns-query"],
        tags: ["OpenDNS", "Family"],
        bootstrap_ips: ["208.67.222.123"],
    },

    // === CleanBrowsing Security (malware + phishing blocking) ===
    {
        type: "dns",
        key: "CLEANBROWSING_SECURITY_DNS",
        name: "CleanBrowsing Security",
        servers: ["185.228.168.9", "185.228.169.9"],
        tags: ["CleanBrowsing", "Security"],
    },
    {
        type: "doh",
        key: "CLEANBROWSING_SECURITY_DOH",
        name: "CleanBrowsing Security DoH",
        servers: ["https://doh.cleanbrowsing.org/doh/security-filter/"],
        tags: ["CleanBrowsing", "Security"],
        bootstrap_ips: ["185.228.168.9"],
    },
    {
        type: "dot",
        key: "CLEANBROWSING_SECURITY_DOT",
        name: "CleanBrowsing Security DoT",
        servers: ["tls://security-filter-dns.cleanbrowsing.org:853"],
        tags: ["CleanBrowsing", "Security"],
        bootstrap_ips: ["185.228.168.9"],
    },

    // === CleanBrowsing Family (adult + VPN/proxy blocking, safe search) ===
    {
        type: "dns",
        key: "CLEANBROWSING_FAMILY_DNS",
        name: "CleanBrowsing Family",
        servers: ["185.228.168.168", "185.228.169.168"],
        tags: ["CleanBrowsing", "Family"],
    },
    {
        type: "doh",
        key: "CLEANBROWSING_FAMILY_DOH",
        name: "CleanBrowsing Family DoH",
        servers: ["https://doh.cleanbrowsing.org/doh/family-filter/"],
        tags: ["CleanBrowsing", "Family"],
        bootstrap_ips: ["185.228.168.168"],
    },
    {
        type: "dot",
        key: "CLEANBROWSING_FAMILY_DOT",
        name: "CleanBrowsing Family DoT",
        servers: ["tls://family-filter-dns.cleanbrowsing.org:853"],
        tags: ["CleanBrowsing", "Family"],
        bootstrap_ips: ["185.228.168.168"],
    },

    // === CleanBrowsing Adult (adult content blocking) ===
    {
        type: "dns",
        key: "CLEANBROWSING_ADULT_DNS",
        name: "CleanBrowsing Adult Filter",
        servers: ["185.228.168.10", "185.228.169.11"],
        tags: ["CleanBrowsing", "Family"],
    },
    {
        type: "doh",
        key: "CLEANBROWSING_ADULT_DOH",
        name: "CleanBrowsing Adult DoH",
        servers: ["https://doh.cleanbrowsing.org/doh/adult-filter/"],
        tags: ["CleanBrowsing", "Family"],
        bootstrap_ips: ["185.228.168.10"],
    },
    {
        type: "dot",
        key: "CLEANBROWSING_ADULT_DOT",
        name: "CleanBrowsing Adult DoT",
        servers: ["tls://adult-filter-dns.cleanbrowsing.org:853"],
        tags: ["CleanBrowsing", "Family"],
        bootstrap_ips: ["185.228.168.10"],
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
        bootstrap_ips: ["76.76.2.0"],
    },
    {
        type: "dot",
        key: "CONTROLD_DOT",
        name: "ControlD DoT",
        servers: ["tls://p2.freedns.controld.com:853"],
        tags: ["ControlD", "Privacy"],
        bootstrap_ips: ["76.76.2.0"],
    },
    {
        type: "doq",
        key: "CONTROLD_DOQ",
        name: "ControlD DoQ",
        servers: ["quic://p2.freedns.controld.com:853"],
        tags: ["ControlD", "Privacy"],
        bootstrap_ips: ["76.76.2.0"],
    },
    {
        type: "doh3",
        key: "CONTROLD_DOH3",
        name: "ControlD DoH3",
        servers: ["h3://p2.freedns.controld.com:443"],
        tags: ["ControlD", "Privacy"],
        bootstrap_ips: ["76.76.2.0"],
    },

    // === Mullvad (privacy-first, no logging) ===
    {
        type: "doh",
        key: "MULLVAD_DOH",
        name: "Mullvad DoH",
        servers: ["https://dns.mullvad.net/dns-query"],
        tags: ["Mullvad", "Privacy"],
    },
    {
        type: "doh",
        key: "MULLVAD_ADBLOCK_DOH",
        name: "Mullvad AdBlock DoH",
        servers: ["https://adblock.dns.mullvad.net/dns-query"],
        tags: ["Mullvad", "AdBlock"],
    },

    // === Yandex (Istanbul presence, fast in Turkey) ===
    {
        type: "dns",
        key: "YANDEX_DNS",
        name: "Yandex DNS",
        servers: ["77.88.8.8", "77.88.8.1"],
        tags: ["Yandex", "Web"],
    },
];
