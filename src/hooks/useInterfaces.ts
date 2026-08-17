import { useMutation, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export const useInterfaces = (
    options?: Omit<
        UseQueryOptions<Interface[], Error, Interface[], readonly unknown[]>,
        "queryKey" | "queryFn"
    >
) => {
    return useQuery({
        queryKey: ["interfaces"],
        queryFn: () => invoke<Interface[]>("get_interfaces"),
        ...options,
    });
};

export const useBestInterface = () => {
    return useQuery({
        queryKey: ["best_interface"],
        queryFn: () => invoke<Interface>("get_best_interface"),
    });
};

export const useChangeInterfaceState = () => {
    return useMutation({
        mutationFn: (params: { interface_idx: number; enable: boolean }) =>
            invoke<void>("change_interface_state", {
                interface_idx: params.interface_idx,
                enable: params.enable,
            }),
    });
};

type Interface = {
    interface_index: number;
    ipv6_interface_index: number;
    name: string;
    description: string;
    mac_address: string | null;
    if_type: number;
    is_up: boolean;
    is_admin_disabled: boolean;
    ip_addresses: string[];
    gateways: string[];
    dns_servers: string[];
};
