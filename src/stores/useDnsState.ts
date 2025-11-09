import { create } from "zustand";

interface DnsState {
    isActive: boolean;
    dnsServer: string;
    setIsActive: (isActive: boolean) => void;
    setDnsServer: (dnsServer: string) => void;
    toggleIsActive: () => void;
}

export const useDnsState = create<DnsState>((set) => ({
    isActive: false,
    dnsServer: "",
    setIsActive: (isActive) => set({ isActive }),
    setDnsServer: (dnsServer) => set({ dnsServer }),
    toggleIsActive: () => set((state) => ({ isActive: !state.isActive })),
}));
