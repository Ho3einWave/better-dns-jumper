import type { SERVER } from "../types";
import { load } from "@tauri-apps/plugin-store";
import { DEFAULT_SERVERS } from "../data/defaultServers";

let storePromise: ReturnType<typeof load> | null = null;

async function getStore() {
    if (!storePromise) {
        storePromise = load("servers.json", {
            autoSave: true,
            defaults: { servers: DEFAULT_SERVERS },
        });
    }
    return storePromise;
}

export async function loadServers(): Promise<SERVER[]> {
    const store = await getStore();
    const servers = await store.get<SERVER[]>("servers");

    if (!servers) {
        await store.set("servers", DEFAULT_SERVERS);
        await store.save();
        return DEFAULT_SERVERS;
    }

    return servers;
}

export async function persistServers(servers: SERVER[]) {
    const store = await getStore();
    await store.set("servers", servers);
    await store.save();
}

export async function resetServers() {
    const store = await getStore();
    await store.set("servers", DEFAULT_SERVERS);
    await store.save();
}
