import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { DnsRule } from "../types";

export const useDnsRules = () => {
    return useQuery({
        queryKey: ["dns_rules"],
        queryFn: () => {
            return invoke<DnsRule[]>("get_dns_rules");
        },
    });
};

export const useSaveDnsRule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (rule: DnsRule) => {
            return invoke<void>("save_dns_rule", { rule });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["dns_rules"] });
        },
    });
};

export const useDeleteDnsRule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => {
            return invoke<void>("delete_dns_rule", { id });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["dns_rules"] });
        },
    });
};

export const useToggleDnsRule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => {
            return invoke<void>("toggle_dns_rule", { id });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["dns_rules"] });
        },
    });
};
