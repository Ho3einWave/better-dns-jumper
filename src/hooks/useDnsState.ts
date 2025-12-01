import { create } from "zustand";

interface DnsState {
    isActive: boolean;
    dnsServer: string;
    protocol: "dns" | "doh" | "dot" | "doq" | "doh3";
    setProtocol: (protocol: "dns" | "doh" | "dot" | "doq" | "doh3") => void;
    setIsActive: (isActive: boolean) => void;
    setDnsServer: (dnsServer: string) => void;
    toggleIsActive: () => void;
}

export const useDnsState = create<DnsState>((set) => ({
    isActive: false,
    dnsServer: "",
    protocol: "dns",
    setProtocol: (protocol) => set({ protocol }),
    setIsActive: (isActive) => set({ isActive }),
    setDnsServer: (dnsServer) => set({ dnsServer }),
    toggleIsActive: () => set((state) => ({ isActive: !state.isActive })),
}));
