import { create } from "zustand";

interface DnsState {
    isActive: boolean;
    dnsServer: string;
    protocol: "dns" | "doh";
    setProtocol: (protocol: "dns" | "doh") => void;
    setIsActive: (isActive: boolean) => void;
    setDnsServer: (dnsServer: string) => void;
    toggleIsActive: () => void;
}

export const useDnsState = create<DnsState>(set => ({
    isActive: false,
    dnsServer: "",
    protocol: "dns",
    setProtocol: protocol => set({ protocol }),
    setIsActive: isActive => set({ isActive }),
    setDnsServer: dnsServer => set({ dnsServer }),
    toggleIsActive: () => set(state => ({ isActive: !state.isActive })),
}));
