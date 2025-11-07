import { useState, useEffect } from "react";
import ToggleButton from "../components/ToggleButton";
import { Select, SelectItem } from "@heroui/select";
import { Tooltip } from "@heroui/tooltip";
import {
    DNS_SERVERS,
    DOH_SERVERS,
    PROTOCOLS,
    SERVER,
} from "../constants/dns-servers";
import { Button } from "@heroui/button";
import { useInterfaces } from "../hooks/useInterfaces";
import {
    useSetDns,
    useGetInterfaceDnsInfo,
    useClearDns,
    useClearDnsCache,
    useTestDohServer,
    type DoHTestResult,
} from "../hooks/useDns";
import { DNSServer } from "../components/icons/DNSServer";
import { Network } from "../components/icons/Network";
import { Broom } from "../components/icons/Broom";
import { addToast } from "@heroui/toast";
import { Reset } from "../components/icons/Reset";
import { Texture } from "../components/icons/Texture";
import { Tab, Tabs } from "@heroui/tabs";
import { Test } from "../components/icons/Test";

const Main = () => {
    const [isActive, setIsActive] = useState(false);
    const [dnsServer, setDnsServer] = useState<string>(DNS_SERVERS[0].key);
    const [IfIdx, setIfIdx] = useState<number | null>(0);
    const [protocol, setProtocol] = useState<string>(PROTOCOLS[0].key);
    const [dohTestResults, setDohTestResults] = useState<
        Map<string, DoHTestResult | "testing" | null>
    >(new Map());

    // Get the appropriate server list based on selected protocol
    const serverList: SERVER[] = protocol === "doh" ? DOH_SERVERS : DNS_SERVERS;
    const dnsServerData = serverList.find((server) => server.key === dnsServer);

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

    const { mutate: testDohServer, isPending } = useTestDohServer({
        onSuccess: (data, variables) => {
            // Find the server key from the server URL
            const serverKey = DOH_SERVERS.find(
                (s) => s.servers[0] === variables.server
            )?.key;
            if (serverKey) {
                setDohTestResults((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(serverKey, data);
                    return newMap;
                });
            }
        },
        onError: (error, variables) => {
            // Find the server key from the server URL
            const serverKey = DOH_SERVERS.find(
                (s) => s.servers[0] === variables.server
            )?.key;
            if (serverKey) {
                setDohTestResults((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(serverKey, {
                        success: false,
                        latency: 0,
                        error: error.message || "Test failed",
                    });
                    return newMap;
                });
            }
        },
    });

    // Test all DoH servers when switching to DoH tab
    useEffect(() => {
        if (protocol === "doh") {
            // Mark all DoH servers as testing
            setDohTestResults((prev) => {
                const newMap = new Map(prev);
                DOH_SERVERS.forEach((server) => {
                    if (!newMap.has(server.key)) {
                        newMap.set(server.key, "testing");
                    }
                });
                return newMap;
            });

            // Test all DoH servers
            DOH_SERVERS.forEach((server) => {
                testDohServer({
                    server: server.servers[0],
                    domain: "google.com",
                });
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [protocol]);
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

    const handleCopyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            addToast({
                title: "Copied to clipboard",
                color: "success",
            });
        } catch (error) {
            addToast({
                title: "Failed to copy",
                color: "danger",
            });
        }
    };

    const renderDnsServers = () => {
        if (dnsServerData?.type === "doh") {
            return dnsServerData?.servers.map((server) => {
                const url = new URL(server);
                return (
                    <Tooltip
                        key={server}
                        content="Click to copy"
                        placement="top"
                    >
                        <div
                            className="text-zinc-400 max-w-60 truncate cursor-pointer hover:text-white transition-colors"
                            onClick={() => handleCopyToClipboard(server)}
                        >
                            {url.hostname}
                        </div>
                    </Tooltip>
                );
            });
        } else {
            return dnsServerData?.servers.join(", ");
        }
    };
    const handleSetDns = () => {
        if (!dnsServerData) return;
        setDns({
            path: interfaceDnsInfo?.path ?? "",
            dns_servers: dnsServerData?.servers,
            dns_type: dnsServerData?.type,
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

    const handleTestDohServer = () => {
        testDohServer({
            server: dnsServerData?.servers[0] ?? "",
            domain: "google.com",
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
                        {
                            adapter: {
                                index: 0,
                                name: "Auto",
                                interface_index: 0,
                                mac_address: null,
                                addrs: [],
                            },
                            config: {},
                        },
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
                        <SelectItem
                            key={items.adapter.interface_index}
                            textValue={items.adapter.name ?? ""}
                        >
                            <div className="flex gap-1 items-center ">
                                <div>{items.adapter.name}</div>
                                <div className="text-xs text-zinc-400">
                                    {items.adapter.interface_index === 0
                                        ? interfaceDnsInfo?.interface_name
                                        : `#${items.adapter.interface_index}`}
                                </div>
                            </div>
                        </SelectItem>
                    )}
                </Select>
                <Select
                    aira-label="Provider"
                    className="col-span-4"
                    aria-labelledby="Provider"
                    items={serverList}
                    selectedKeys={[dnsServer]}
                    disallowEmptySelection={true}
                    onSelectionChange={(keys) =>
                        setDnsServer(keys.currentKey as string)
                    }
                    maxListboxHeight={200}
                    startContent={<DNSServer className="text-2xl" />}
                    isDisabled={!interfaceDnsInfo?.path || isActive}
                >
                    {serverList.map((server) => {
                        const testResult = dohTestResults.get(server.key);
                        const latencyText =
                            testResult === "testing"
                                ? "Testing..."
                                : testResult?.success
                                ? `${testResult.latency}ms`
                                : testResult === null
                                ? null
                                : "-";

                        // Determine color based on availability
                        const getColorClass = () => {
                            if (testResult === "testing") {
                                return "text-yellow-400";
                            } else if (
                                testResult &&
                                typeof testResult === "object" &&
                                testResult.success
                            ) {
                                return "text-green-400";
                            } else if (
                                testResult &&
                                typeof testResult === "object" &&
                                !testResult.success
                            ) {
                                return "text-red-400";
                            } else {
                                return "text-zinc-400";
                            }
                        };

                        return (
                            <SelectItem
                                key={server.key}
                                textValue={server.name}
                            >
                                <div className="flex items-center justify-between w-full gap-2">
                                    <span>{server.name}</span>
                                    {protocol === "doh" && latencyText && (
                                        <span
                                            className={`text-[10px] ${getColorClass()}`}
                                        >
                                            {latencyText}
                                        </span>
                                    )}
                                </div>
                            </SelectItem>
                        );
                    })}
                </Select>

                <Tabs
                    size="sm"
                    classNames={{
                        base: "w-full",
                        tabList: "w-full",
                    }}
                    selectedKey={protocol}
                    onSelectionChange={(key) => {
                        setProtocol(key as string);
                        // Reset to first server of the selected protocol
                        const newServerList =
                            key === "doh" ? DOH_SERVERS : DNS_SERVERS;
                        setDnsServer(newServerList[0].key);
                    }}
                    color="primary"
                    isDisabled={!interfaceDnsInfo?.path || isActive}
                >
                    {PROTOCOLS.map((protocol) => (
                        <Tab key={protocol.key} title={protocol.name} />
                    ))}
                </Tabs>

                <div className="flex flex-col gap-2 bg-zinc-900 rounded-md p-2 text-nowrap text-sm">
                    <div className="flex justify-between">
                        <div>
                            Server
                            {dnsServerData?.type === "doh" ? "" : "s"}:
                        </div>
                        <div>{renderDnsServers()}</div>
                    </div>
                    {/* <div className="flex justify-between">
                        <div>Tags:</div>
                        <div>{dnsServerData?.tags.join(", ")}</div>
                    </div> */}
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
                    <Tooltip
                        aria-label="Test DoH Server"
                        content="Test DoH Server"
                        placement="top"
                    >
                        <Button
                            isIconOnly
                            onPress={handleTestDohServer}
                            isDisabled={dnsServerData?.type !== "doh"}
                            isLoading={isPending}
                        >
                            <Test className="text-xl" />
                        </Button>
                    </Tooltip>
                    {new Array(4).fill(0).map((_, index) => (
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
