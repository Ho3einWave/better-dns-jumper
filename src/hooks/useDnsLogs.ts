import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { DnsQueryLog } from "../types";

export const useDnsLogs = (filter?: string) => {
    return useQuery({
        queryKey: ["dns_logs", filter],
        queryFn: () => {
            return invoke<DnsQueryLog[]>("get_dns_logs", {
                filter: filter || null,
                offset: null,
                limit: null,
            });
        },
        refetchInterval: 2000,
    });
};

export const useClearDnsLogs = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => {
            return invoke<void>("clear_dns_logs");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["dns_logs"] });
        },
    });
};
