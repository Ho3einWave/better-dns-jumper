import type { SERVER } from "../types";
import type { BootstrapResolverInfo } from "../hooks/useDns";

export function getBootstrapParams(
    server: SERVER,
    servers: SERVER[],
    bootstrapResolverKey: string | null
): { bootstrap_ip?: string; bootstrap_resolver?: BootstrapResolverInfo } {
    // Priority 1: server has its own bootstrap_ips
    if (server.bootstrap_ips?.[0]) {
        return { bootstrap_ip: server.bootstrap_ips[0] };
    }
    // Priority 2: global bootstrap resolver from settings
    if (bootstrapResolverKey) {
        const resolver = servers.find((s) => s.key === bootstrapResolverKey);
        if (resolver) {
            if (resolver.type === "dns") {
                // Plain DNS — pass the IP directly, no bootstrap needed for the resolver itself
                return {
                    bootstrap_resolver: { server: resolver.servers[0] },
                };
            }
            // Encrypted DNS resolver — pass its bootstrap_ip if available,
            // otherwise it will resolve via system DNS (fine if that resolver's
            // domain isn't poisoned)
            return {
                bootstrap_resolver: {
                    server: resolver.servers[0],
                    ...(resolver.bootstrap_ips?.[0]
                        ? { bootstrap_ip: resolver.bootstrap_ips[0] }
                        : {}),
                },
            };
        }
    }
    // Priority 3: fall back to system DNS (no params)
    return {};
}
