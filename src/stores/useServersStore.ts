// store/useServerStore.ts
import { create } from "zustand";
import { loadServers, persistServers, resetServers } from "./tauriServersStore";
import type { SERVER } from "../types";

type ServerState = {
    servers: SERVER[];
    isLoading: boolean;
    load: () => Promise<void>;
    addServer: (server: SERVER) => Promise<void>;
    updateServer: (server: SERVER) => Promise<void>;
    removeServer: (key: string) => Promise<void>;
    resetServers: () => Promise<void>;
};

export const useServerStore = create<ServerState>((set, get) => ({
    servers: [],
    isLoading: true,

    load: async () => {
        const data = await loadServers();
        set({ servers: data, isLoading: false });
    },

    addServer: async (server) => {
        const servers = [...get().servers, server];
        set({ servers });
        await persistServers(servers);
    },

    updateServer: async (server) => {
        const servers = get().servers.map((s) =>
            s.key === server.key ? server : s
        );
        set({ servers });
        await persistServers(servers);
    },

    removeServer: async (key) => {
        const servers = get().servers.filter((s) => s.key !== key);
        set({ servers });
        await persistServers(servers);
    },

    resetServers: async () => {
        await resetServers();
        set({ servers: await loadServers() });
    },
}));
