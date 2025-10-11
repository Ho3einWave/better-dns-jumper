import { useQuery } from "@tanstack/react-query";
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
