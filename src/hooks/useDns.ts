import type { MutationOptions } from "@tanstack/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_SETTING } from "../data/defaultSetting";
import { loadTestDomain } from "../stores/tauriSettingStore";

export function useSetDns(params?: MutationOptions<
    void,
    Error,
    { path: string; dns_servers: string[]; dns_type: "doh" | "dns" }
>) {
    return useMutation({
        mutationFn: (params: {
            path: string;
            dns_servers: string[];
            dns_type: "doh" | "dns";
        }) => {
            return invoke<void>("set_dns", params);
        },
        ...params,
    });
}

export function useClearDns(params?: MutationOptions<void, Error, { path: string }>) {
    return useMutation({
        mutationFn: (params: { path: string }) => {
            return invoke<void>("clear_dns", params);
        },

        ...params,
    });
}

export function useGetInterfaceDnsInfo(interface_idx: number | null) {
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
}

export function useClearDnsCache(params?: MutationOptions<void, Error, void>) {
    return useMutation({
        mutationFn: () => {
            return invoke<void>("clear_dns_cache");
        },
        ...params,
    });
}

export function useTestDohServer(params?: MutationOptions<
    DoHTestResult,
    Error,
    { server: string; domain: string }
>) {
    return useMutation({
        mutationFn: async (params: { server: string; domain: string }) => {
            const testDomain = await loadTestDomain();
            return invoke<DoHTestResult>("test_doh_server", {
                ...params,
                domain: testDomain || DEFAULT_SETTING.test_domain,
            });
        },
        ...params,
    });
}

export interface DoHTestResult {
    success: boolean;
    latency: number;
    error: string | null;
}

export interface InterfaceDnsInfo {
    interface_index: number;
    dns_servers: string[];
    interface_name: string;
    path: string | null;
}
