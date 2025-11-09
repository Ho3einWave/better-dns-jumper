import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { load } from "@tauri-apps/plugin-store";

let storePromise: ReturnType<typeof load> | null = null;

async function getStore() {
    if (!storePromise) {
        storePromise = load("setting.json", {
            autoSave: true,
            defaults: { test_domain: "youtube.com" },
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
