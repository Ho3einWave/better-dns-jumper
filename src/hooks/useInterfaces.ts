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
    name: string;
    index: number;
    mac: string | null;
    addrs: {
        ip: string;
        subnet: string | null;
        gateway: string | null;
    }[];
};
