import { useMutation, useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export const useInterfaces = () => {
    return useQuery({
        queryKey: ["interfaces"],
        queryFn: () => invoke<Interface[]>("get_interfaces"),
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
    adapter: {
        description: string | null;
        device_id: number;
        guid: string | null;
        index: number;
        interface_index: number;
        mac_address: string | null;
        manufacturer: string | null;
        name: string | null;
        net_connection_id: string | null;
        net_enabled: boolean;
        config_manager_error_code: number | null;
        service_name: string | null;
        path: string | null;
    };
    config: {
        default_ip_gateway: string[] | null;
        description: string | null;
        dhcp_enabled: boolean;
        dhcp_server: string | null;
        dns_host_name: string | null;
        dns_server_search_order: string[] | null;
        index: number;
        interface_index: number;
        ip_address: string[] | null;
        ip_connection_metric: number | null;
        ip_enabled: boolean;
        ip_subnet: string[] | null;
        mac_address: string | null;
    };
};
