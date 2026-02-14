import { MutationOptions, useMutation, useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { loadTestDomain } from "../stores/tauriSettingStore";
import { DEFAULT_SETTING } from "../data/defaultSetting";

export type BootstrapResolverInfo = {
    server: string;
    bootstrap_ip?: string;
};

export const useSetDns = (
    params?: MutationOptions<
        void,
        Error,
        {
            path: string;
            dns_servers: string[];
            dns_type: "doh" | "dns" | "dot" | "doq" | "doh3";
            bootstrap_ip?: string;
            bootstrap_resolver?: BootstrapResolverInfo;
        }
    >
) => {
    return useMutation({
        mutationFn: (params: {
            path: string;
            dns_servers: string[];
            dns_type: "doh" | "dns" | "dot" | "doq" | "doh3";
            bootstrap_ip?: string;
            bootstrap_resolver?: BootstrapResolverInfo;
        }) => {
            return invoke<void>("set_dns", params);
        },
        ...params,
    });
};

export const useClearDns = (
    params?: MutationOptions<void, Error, { path: string }>
) => {
    return useMutation({
        mutationFn: (params: { path: string }) => {
            return invoke<void>("clear_dns", params);
        },

        ...params,
    });
};

export const useGetInterfaceDnsInfo = (interface_idx: number | null) => {
    return useQuery({
        queryKey: ["interface_info", interface_idx],
        queryFn: () => {
            return invoke<InterfaceDnsInfo>("get_interface_dns_info", {
                interface_idx,
            });
        },
        refetchInterval: 10000,
        enabled: interface_idx !== null,
    });
};

export const useClearDnsCache = (
    params?: MutationOptions<void, Error, void>
) => {
    return useMutation({
        mutationFn: () => {
            return invoke<void>("clear_dns_cache");
        },
        ...params,
    });
};

export const useTestServer = (
    params?: MutationOptions<
        ServerTestResult,
        Error,
        {
            server: string;
            domain: string;
            bootstrap_ip?: string;
            bootstrap_resolver?: BootstrapResolverInfo;
        }
    >
) => {
    return useMutation({
        mutationFn: async (params: {
            server: string;
            domain: string;
            bootstrap_ip?: string;
            bootstrap_resolver?: BootstrapResolverInfo;
        }) => {
            const testDomain = await loadTestDomain();
            return invoke<ServerTestResult>("test_server", {
                ...params,
                domain: testDomain || DEFAULT_SETTING.test_domain,
            });
        },
        ...params,
    });
};

export type ServerTestResult = {
    success: boolean;
    latency: number;
    error: string | null;
};

export type InterfaceDnsInfo = {
    interface_index: number;
    dns_servers: string[];
    interface_name: string;
    path: string | null;
};
