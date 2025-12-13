import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { create } from "zustand";

interface AutoStartStore {
    isLoading: boolean;
    isAutoStartEnabled: boolean;
    load: () => void;
    setIsAutoStartEnabled: (isAutoStartEnabled: boolean) => void;
}

export const useAutoStartStore = create<AutoStartStore>(set => ({
    isLoading: true,
    isAutoStartEnabled: false,
    load: async () => {
        const isAutoStartEnabled = await isEnabled();
        set({ isAutoStartEnabled, isLoading: false });
    },
    setIsAutoStartEnabled: async (isAutoStartEnabled) => {
        if (isAutoStartEnabled) {
            await enable();
        }
        else {
            await disable();
        }
        const newIsAutoStartEnabled = await isEnabled();
        set({ isAutoStartEnabled: newIsAutoStartEnabled });
    },
}));
