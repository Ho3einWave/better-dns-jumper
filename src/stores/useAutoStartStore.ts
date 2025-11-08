import { create } from "zustand";
import { isEnabled, enable, disable } from "@tauri-apps/plugin-autostart";

interface AutoStartStore {
    isLoading: boolean;
    isAutoStartEnabled: boolean;
    load: () => void;
    setIsAutoStartEnabled: (isAutoStartEnabled: boolean) => void;
}

export const useAutoStartStore = create<AutoStartStore>((set) => ({
    isLoading: true,
    isAutoStartEnabled: false,
    load: async () => {
        const isAutoStartEnabled = await isEnabled();
        set({ isAutoStartEnabled, isLoading: false });
    },
    setIsAutoStartEnabled: async (isAutoStartEnabled) => {
        if (isAutoStartEnabled) {
            await enable();
        } else {
            await disable();
        }
        const newIsAutoStartEnabled = await isEnabled();
        set({ isAutoStartEnabled: newIsAutoStartEnabled });
    },
}));
