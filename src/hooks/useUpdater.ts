import type { Update } from "@tauri-apps/plugin-updater";
import { check } from "@tauri-apps/plugin-updater";
import { create } from "zustand";

interface UpdaterStore {
    isCheckingForUpdates: boolean;
    isDownloading: boolean;
    isReadyForInstall: boolean;
    isInstalling: boolean;
    isUpdateAvailable: boolean;
    isModalOpen: boolean;
    update: Update | null;
    downloaded: number;
    contentLength: number;
    checkForUpdates: () => Promise<void>;
    downloadUpdate: () => Promise<void>;
    installUpdate: () => Promise<void>;
    downloadAndInstallUpdate: () => Promise<void>;
    openModal: () => void;
    closeModal: () => void;
}

export const useUpdater = create<UpdaterStore>((set, get) => ({
    isCheckingForUpdates: false,
    isDownloading: false,
    isReadyForInstall: false,
    isInstalling: false,
    isUpdateAvailable: false,
    isModalOpen: false,
    downloaded: 0,
    contentLength: 0,
    update: null,
    checkForUpdates: async () => {
        set({ isCheckingForUpdates: true });
        const result = await check();
        if (result) {
            set({
                isUpdateAvailable: true,
                update: result,
                isCheckingForUpdates: false,
            });
        }
        else {
            set({ isCheckingForUpdates: false, isUpdateAvailable: false });
        }
    },
    downloadUpdate: async () => {
        const { update } = get();
        if (!update)
            return;
        await update.download((event) => {
            switch (event.event) {
                case "Started":
                    set({
                        isDownloading: true,
                        downloaded: 0,
                        contentLength: event.data.contentLength ?? 0,
                    });
                    break;
                case "Progress":
                { const downloaded = get().downloaded;
                    set({
                        downloaded: downloaded + (event.data.chunkLength ?? 0),
                    });
                    break; }
                case "Finished":
                    set({ isDownloading: false, isReadyForInstall: true });
                    break;
            }
        });
    },
    installUpdate: async () => {
        const { update, isReadyForInstall } = get();
        if (!update || !isReadyForInstall)
            return;
        await update.install();
        set({ isInstalling: true });
    },
    downloadAndInstallUpdate: async () => {
        const { update } = get();
        if (!update)
            return;
        await update.downloadAndInstall((event) => {
            switch (event.event) {
                case "Started":
                    set({
                        isDownloading: true,
                        downloaded: 0,
                        contentLength: event.data.contentLength ?? 0,
                    });
                    break;
                case "Progress":
                { const downloaded = get().downloaded;
                    set({
                        downloaded: downloaded + (event.data.chunkLength ?? 0),
                    });
                    break; }
                case "Finished":
                    set({ isDownloading: false, isInstalling: true });
                    break;
            }
        });
    },
    openModal: () => {
        set({ isModalOpen: true });
    },
    closeModal: () => {
        set({ isModalOpen: false });
    },
}));
