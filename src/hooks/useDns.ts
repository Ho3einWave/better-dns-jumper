import { MutationOptions, useMutation, useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export const useSetDns = (
    params?: MutationOptions<
        void,
        Error,
        { path: string; dns_servers: string[] }
    >
) => {
    return useMutation({
        mutationFn: (params: { path: string; dns_servers: string[] }) => {
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

export const useClearDnsCache = () => {
    return useMutation({
        mutationFn: () => {
            return invoke<void>("clear_dns_cache");
        },
    });
};

export type InterfaceDnsInfo = {
    interface_index: number;
    dns_servers: string[];
    interface_name: string;
    path: string | null;
};
