import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { load } from "@tauri-apps/plugin-store";

let storePromise: ReturnType<typeof load> | null = null;

async function getStore() {
    if (!storePromise) {
        storePromise = load("setting.json", {
            autoSave: true,
            defaults: { test_domain: "youtube.com", bootstrap_resolver_key: null },
        });
    }
    return storePromise;
}

export async function loadTestDomain() {
    const store = await getStore();
    const testDomain = await store.get<string>("test_domain");
    if (!testDomain) {
        await store.set("test_domain", "youtube.com");
        await store.save();
        return "youtube.com";
    }
    return testDomain;
}

export async function saveTestDomain(testDomain: string) {
    const store = await getStore();
    await store.set("test_domain", testDomain);
    await store.save();
}

export const useTestDomain = () => {
    const queryClient = useQueryClient();
    const { data: testDomain, isLoading: isLoadingTestDomain } = useQuery({
        queryKey: ["test_domain"],
        queryFn: loadTestDomain,
    });

    const { mutate: saveTestDomainMutation, isPending: isSavingTestDomain } =
        useMutation({
            mutationFn: (testDomain: string) => saveTestDomain(testDomain),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["test_domain"] });
            },
        });

    return {
        data: testDomain,
        isLoading: isLoadingTestDomain,
        mutate: saveTestDomainMutation,
        isSaving: isSavingTestDomain,
    };
};

export async function loadBootstrapResolverKey(): Promise<string | null> {
    const store = await getStore();
    const key = await store.get<string | null>("bootstrap_resolver_key");
    return key ?? null;
}

export async function saveBootstrapResolverKey(key: string | null) {
    const store = await getStore();
    await store.set("bootstrap_resolver_key", key);
    await store.save();
}

export const useBootstrapResolverKey = () => {
    const queryClient = useQueryClient();
    const { data: bootstrapResolverKey, isLoading: isLoadingBootstrapResolverKey } = useQuery({
        queryKey: ["bootstrap_resolver_key"],
        queryFn: loadBootstrapResolverKey,
    });

    const { mutate: saveBootstrapResolverKeyMutation, isPending: isSavingBootstrapResolverKey } =
        useMutation({
            mutationFn: (key: string | null) => saveBootstrapResolverKey(key),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["bootstrap_resolver_key"] });
            },
        });

    return {
        data: bootstrapResolverKey ?? null,
        isLoading: isLoadingBootstrapResolverKey,
        mutate: saveBootstrapResolverKeyMutation,
        isSaving: isSavingBootstrapResolverKey,
    };
};
