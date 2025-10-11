import { useState } from "react";
import ToggleButton from "../components/ToggleButton";
import { Select, SelectItem } from "@heroui/select";
import { DNS_SERVERS } from "../constants/dns-servers";
import { Button } from "@heroui/button";
import { useInterfaces } from "../hooks/useInterfaces";
import {
    useSetDns,
    useGetInterfaceDnsInfo,
    useClearDns,
} from "../hooks/useDns";
import { DNSServer } from "../components/icons/DNSServer";
import { Network } from "../components/icons/Network";
const Main = () => {
    const [isActive, setIsActive] = useState(false);
    const [dnsServer, setDnsServer] = useState<string>(DNS_SERVERS[0].key);
    const [IfIdx, setIfIdx] = useState<number | null>(0);

    const dnsServerData = DNS_SERVERS.find(
        (server) => server.key === dnsServer
    );

    const { data: interfaces, isLoading: isLoadingInterfaces } =
        useInterfaces();

    const { data: interfaceDnsInfo, refetch: refetchInterfaceDnsInfo } =
        useGetInterfaceDnsInfo(IfIdx);

    const { mutate: setDns } = useSetDns({
        onSuccess: () => {
            refetchInterfaceDnsInfo();
        },
    });
    const { mutate: clearDns } = useClearDns({
        onSuccess: () => {
            refetchInterfaceDnsInfo();
        },
    });

    const handleSetDns = () => {
        setDns({
            path: interfaceDnsInfo?.path ?? "",
            dns_servers: dnsServerData?.servers ?? [],
        });
    };
    const handleClearDns = () => {
        clearDns({
            path: interfaceDnsInfo?.path ?? "",
        });
    };

    const handleToggle = () => {
        if (!isActive) {
            handleSetDns();
        } else {
            handleClearDns();
        }
        setIsActive((prev) => {
            return !prev;
        });
    };
    return (
        <div className="flex  gap-4 items-center flex-1 justify-center">
            <div>
                <ToggleButton isActive={isActive} onClick={handleToggle} />
                <h1>DNS is active</h1>
            </div>
            <div className="min-w-82 flex flex-col gap-2">
                <Select
                    aria-label="Interface"
                    items={[
                        { index: 0, name: "Auto", mac: null, addrs: [] },
                        ...(interfaces ?? []),
                    ]}
                    isLoading={isLoadingInterfaces}
                    selectedKeys={IfIdx ? [IfIdx.toString()] : ["0"]}
                    disallowEmptySelection={true}
                    maxListboxHeight={200}
                    onSelectionChange={(keys) =>
                        setIfIdx(parseInt(keys.currentKey as string))
                    }
                    startContent={<Network className="text-2xl" />}
                    isDisabled={!interfaceDnsInfo?.path || isActive}
                >
                    {(items) => (
                        <SelectItem key={items.index} textValue={items.name}>
                            <div className="flex gap-1 items-center ">
                                <div>{items.name}</div>
                                <div className="text-xs text-zinc-400">
                                    {items.index === 0
                                        ? interfaceDnsInfo?.interface_name
                                        : `#${items.index}`}
                                </div>
                            </div>
                        </SelectItem>
                    )}
                </Select>
                <Select
                    aira-label="Provider"
                    items={DNS_SERVERS}
                    selectedKeys={[dnsServer]}
                    disallowEmptySelection={true}
                    onSelectionChange={(keys) =>
                        setDnsServer(keys.currentKey as string)
                    }
                    maxListboxHeight={200}
                    startContent={<DNSServer className="text-2xl" />}
                    isDisabled={!interfaceDnsInfo?.path || isActive}
                >
                    {(items) => (
                        <SelectItem key={items.key} textValue={items.name}>
                            {items.name}
                        </SelectItem>
                    )}
                </Select>

                <div className="flex flex-col gap-2 bg-zinc-900 rounded-md p-2 text-nowrap text-sm">
                    <div className="flex justify-between">
                        <div>Servers:</div>
                        <div>{dnsServerData?.servers.join(", ")}</div>
                    </div>
                    <div className="flex justify-between">
                        <div>Tags:</div>
                        <div>{dnsServerData?.tags.join(", ")}</div>
                    </div>
                    <div className="flex justify-between">
                        <div>Interface:</div>
                        <div>
                            {IfIdx === 0 ? (
                                <span className="flex gap-1 items-center">
                                    Auto
                                    <span className="text-zinc-400">
                                        ({interfaceDnsInfo?.interface_name})
                                    </span>
                                </span>
                            ) : (
                                `${interfaceDnsInfo?.interface_name}`
                            )}
                        </div>
                    </div>
                    {(interfaceDnsInfo?.dns_servers.length ?? 0) > 0 && (
                        <div className="flex justify-between">
                            <div>Current DNS:</div>
                            <div>
                                {interfaceDnsInfo?.dns_servers.join(", ")}
                            </div>
                        </div>
                    )}
                </div>
                <div>
                    <Button size="sm">Clear Cache</Button>
                </div>
            </div>
        </div>
    );
};

export default Main;
