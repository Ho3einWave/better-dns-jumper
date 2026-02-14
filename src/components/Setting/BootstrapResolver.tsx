import { Select, SelectItem } from "@heroui/select";
import { useBootstrapResolverKey } from "../../stores/tauriSettingStore";
import { useServerStore } from "../../stores/useServersStore";
import { useEffect, useMemo } from "react";

const BootstrapResolver = () => {
    const { servers, load } = useServerStore();
    const {
        data: bootstrapResolverKey,
        isLoading,
        mutate: saveBootstrapResolverKey,
        isSaving,
    } = useBootstrapResolverKey();

    useEffect(() => {
        load();
    }, [load]);

    const eligibleServers = useMemo(() => {
        return servers;
    }, [servers]);

    const handleChange = (keys: "all" | Set<React.Key>) => {
        const selected = keys === "all" ? "" : Array.from(keys)[0]?.toString();
        if (!selected || selected === "none") {
            saveBootstrapResolverKey(null);
        } else {
            saveBootstrapResolverKey(selected);
        }
    };

    return (
        <div className="flex items-center justify-between gap-2">
            <div className="flex-shrink-0">
                <span className="text-sm font-medium">Bootstrap Resolver</span>
                <p className="text-xs text-zinc-400 max-w-52">
                    Use a trusted DNS server to resolve encrypted DNS server
                    domains. Helps bypass DNS poisoning.
                </p>
            </div>
            <Select
                aria-label="Bootstrap Resolver"
                isDisabled={isLoading || isSaving}
                size="sm"
                selectedKeys={
                    bootstrapResolverKey ? [bootstrapResolverKey] : ["none"]
                }
                onSelectionChange={handleChange}
                className="max-w-60"
                disallowEmptySelection
            >
                {[
                    <SelectItem key="none" textValue="None (use system DNS)">
                        None (use system DNS)
                    </SelectItem>,
                    ...eligibleServers.map((server) => (
                        <SelectItem key={server.key} textValue={server.name}>
                            <div className="flex items-center gap-1">
                                <span>{server.name}</span>
                                <span className="text-xs text-zinc-400">
                                    {server.type.toUpperCase()}
                                </span>
                            </div>
                        </SelectItem>
                    )),
                ]}
            </Select>
        </div>
    );
};

export default BootstrapResolver;
