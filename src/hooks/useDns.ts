import { useMutation } from "@tanstack/react-query";
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
