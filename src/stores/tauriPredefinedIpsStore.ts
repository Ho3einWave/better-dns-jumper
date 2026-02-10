import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { load } from "@tauri-apps/plugin-store";

export type PredefinedIp = {
    label: string;
    ip: string;
};

const DEFAULT_IPS: PredefinedIp[] = [
    { label: "Block", ip: "0.0.0.0" },
    { label: "Localhost", ip: "127.0.0.1" },
];

let storePromise: ReturnType<typeof load> | null = null;

async function getStore() {
    if (!storePromise) {
        storePromise = load("setting.json", {
            autoSave: true,
            defaults: {},
        });
    }
    return storePromise;
}

export async function loadPredefinedIps(): Promise<PredefinedIp[]> {
    const store = await getStore();
    const ips = await store.get<PredefinedIp[]>("predefined_ips");
    if (!ips || ips.length === 0) {
        await store.set("predefined_ips", DEFAULT_IPS);
        await store.save();
        return DEFAULT_IPS;
    }
    return ips;
}

export async function savePredefinedIps(ips: PredefinedIp[]) {
    const store = await getStore();
    await store.set("predefined_ips", ips);
    await store.save();
}

export const usePredefinedIps = () => {
    const queryClient = useQueryClient();

    const { data: ips = [], isLoading } = useQuery({
        queryKey: ["predefined_ips"],
        queryFn: loadPredefinedIps,
    });

    const { mutate: save, isPending: isSaving } = useMutation({
        mutationFn: (ips: PredefinedIp[]) => savePredefinedIps(ips),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["predefined_ips"] });
        },
    });

    return {
        ips,
        isLoading,
        save,
        isSaving,
    };
};
