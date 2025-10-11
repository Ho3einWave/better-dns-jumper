import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export const useInterfaces = () => {
    return useQuery({
        queryKey: ["interfaces"],
        queryFn: () => invoke<Interface[]>("get_interfaces"),
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
