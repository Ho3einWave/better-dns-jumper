import { useMutation, useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export const useDns = () => {
    return useMutation({
        mutationFn: (params: {
            interface_idx: number;
            dns_servers: string[];
        }) => {
            return invoke<void>("set_dns", params);
        },
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
        enabled: interface_idx !== null,
    });
};

export type InterfaceDnsInfo = {
    interface_index: number;
    dns_servers: string[];
    interface_name: string;
};
