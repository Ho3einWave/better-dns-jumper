import { useState } from "react";
import ToggleButton from "../components/ToggleButton";
import { Select, SelectItem } from "@heroui/select";
import { Tooltip } from "@heroui/tooltip";
import { DNS_SERVERS, PROTOCOLS } from "../constants/dns-servers";
import { Button } from "@heroui/button";
import { useInterfaces } from "../hooks/useInterfaces";
import {
    useSetDns,
    useGetInterfaceDnsInfo,
    useClearDns,
    useClearDnsCache,
} from "../hooks/useDns";
import { DNSServer } from "../components/icons/DNSServer";
import { Network } from "../components/icons/Network";
import { Broom } from "../components/icons/Broom";
import { addToast } from "@heroui/toast";
import { Reset } from "../components/icons/Reset";
import { Texture } from "../components/icons/Texture";

const Main = () => {
    const [isActive, setIsActive] = useState(false);
    const [dnsServer, setDnsServer] = useState<string>(DNS_SERVERS[0].key);
    const [IfIdx, setIfIdx] = useState<number | null>(0);
    const [protocol, setProtocol] = useState<string>(PROTOCOLS[0].key);

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
    const { mutate: clearDnsCache } = useClearDnsCache({
        onSuccess: () => {
            console.log("DNS cleared");
            addToast({
                title: "DNS cleared",
                color: "success",
                icon: <Broom className="text-xl" />,
            });
        },
        onError: (error) => {
            console.log(
                "[handleClearDnsCache] Error clearing DNS cache",
                error
            );
            addToast({
                title: "Error clearing DNS cache",
                color: "danger",
                icon: <Broom className="text-xl" />,
            });
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

    const handleClearDnsCache = () => {
        clearDnsCache();
    };

    const handleResetDns = () => {
        clearDns({
            path: interfaceDnsInfo?.path ?? "",
        });
    };

    return (
        <div className="flex flex-col gap-4 items-center flex-1 justify-center">
            <div>
                <ToggleButton isActive={isActive} onClick={handleToggle} />
            </div>
            <div className="min-w-82 flex flex-col gap-2">
                <Select
                    aria-label="Interface"
                    aria-labelledby="Interface"
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
                <div className="grid grid-cols-6 gap-2">
                    <Select
                        aira-label="Provider"
                        className="col-span-4"
                        aria-labelledby="Provider"
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
                    <Select
                        aria-label="Protocol"
                        className="col-span-2"
                        aria-labelledby="Protocol"
                        items={PROTOCOLS}
                        selectedKeys={[protocol]}
                        disallowEmptySelection={true}
                        onSelectionChange={(keys) =>
                            setProtocol(keys.currentKey as string)
                        }
                        maxListboxHeight={200}
                    >
                        {(items) => (
                            <SelectItem key={items.key} textValue={items.name}>
                                {items.name}
                            </SelectItem>
                        )}
                    </Select>
                </div>

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
                <div className="flex gap-2">
                    <Tooltip
                        aria-label="Clear DNS Cache"
                        content="Clear DNS Cache"
                        placement="top"
                    >
                        <Button isIconOnly onPress={handleClearDnsCache}>
                            <Broom className="text-xl" />
                        </Button>
                    </Tooltip>
                    <Tooltip
                        aria-label="Reset DNS"
                        content="Reset DNS"
                        placement="top"
                    >
                        <Button isIconOnly onPress={handleResetDns}>
                            <Reset className="text-xl" />
                        </Button>
                    </Tooltip>
                    {new Array(5).fill(0).map((_, index) => (
                        <Button isDisabled isIconOnly key={index}>
                            <Texture className="text-xl opacity-50" />
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Main;
