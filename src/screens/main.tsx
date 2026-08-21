import { useState, useEffect, useMemo } from "react";
import ToggleButton from "../components/ToggleButton";
import { Select, SelectItem } from "@heroui/select";
import { Tooltip } from "@heroui/tooltip";
import { Button } from "@heroui/button";
import { useInterfaces } from "../hooks/useInterfaces";
import {
    useSetDns,
    useGetInterfaceDnsInfo,
    useClearDns,
    useClearDnsCache,
    useTestServer,
    type ServerTestResult,
} from "../hooks/useDns";
import { DNSServer } from "../components/icons/DNSServer";
import { Network } from "../components/icons/Network";
import { Broom } from "../components/icons/Broom";
import { addToast } from "@heroui/toast";
import { Reset } from "../components/icons/Reset";
import { Texture } from "../components/icons/Texture";
import { Tab, Tabs } from "@heroui/tabs";
import { Test } from "../components/icons/Test";
import { PROTOCOLS, PROXY_V4, PROXY_V6, SERVER } from "../types";
import { errorMessage } from "../utils/errorMessage";
import { useServerStore } from "../stores/useServersStore";
import { useDnsState } from "../hooks/useDnsState";
import { useBootstrapResolverKey } from "../stores/tauriSettingStore";
import { getBootstrapParams } from "../utils/bootstrap";

const Main = () => {
    const { servers, isLoading: isLoadingServers, load } = useServerStore();
    const { data: bootstrapResolverKey } = useBootstrapResolverKey();

    const {
        isActive,
        toggleIsActive,
        setIsActive,
        dnsServer,
        setDnsServer,
        protocol,
        setProtocol,
    } = useDnsState();
    const [IfIdx, setIfIdx] = useState<number | null>(0);
    const [testResults, setTestResults] = useState<
        Map<string, ServerTestResult | "testing" | null>
    >(new Map());

    // Load servers on mount
    useEffect(() => {
        load();
    }, [load]);

    // Get the appropriate server list based on selected protocol
    const serverList: SERVER[] = useMemo(() => {
        return servers.filter((server) => server.type === protocol);
    }, [servers, protocol]);

    // Set initial DNS server when servers are loaded or protocol changes
    useEffect(() => {
        if (!isLoadingServers && serverList.length > 0) {
            // If current server is not in the list, or no server is selected, select the first one
            if (!dnsServer || !serverList.find((s) => s.key === dnsServer)) {
                setDnsServer(serverList[0].key);
            }
        }
    }, [serverList, isLoadingServers, dnsServer]);

    const dnsServerData = serverList.find((server) => server.key === dnsServer);

    const { data: interfaces, isLoading: isLoadingInterfaces } =
        useInterfaces();

    const {
        data: interfaceDnsInfo,
        refetch: refetchInterfaceDnsInfo,
        isFetching: isFetchingInterfaceDnsInfo,
    } = useGetInterfaceDnsInfo(IfIdx);

    // Is the local proxy currently written onto the adapter?
    //
    // Deliberately narrow: it asks only about 127.0.0.2 / ::1, which are unambiguously
    // ours. It is NOT a general "are we active" check — plain DNS writes the server's
    // own addresses onto the adapter, so a broader check would have to guess, and
    // guessing wrong is what made the toggle fight the user.
    const isProxyApplied = useMemo(
        () =>
            (interfaceDnsInfo?.dns_servers ?? []).some(
                (server) => server === PROXY_V4 || server === PROXY_V6,
            ),
        [interfaceDnsInfo],
    );

    const { mutate: setDns, isPending: isSettingDns } = useSetDns({
        onSuccess: () => {
            // The command succeeded, so the adapter is configured whether or not the
            // refetch has landed yet. Waiting for the refetch to decide would let a
            // stale read flip the switch back.
            setIsActive(true);
            refetchInterfaceDnsInfo();
        },
        onError: (error) => {
            // The optimistic toggle already flipped to "connected"; the DNS change did
            // not happen, so put the switch back rather than showing a state the
            // adapter is not actually in.
            setIsActive(false);
            refetchInterfaceDnsInfo();
            addToast({
                title: "Could not apply DNS settings",
                description: errorMessage(error),
                color: "danger",
                timeout: 8000,
            });
        },
    });
    const { mutate: clearDns, isPending: isClearingDns } = useClearDns({
        onSuccess: () => {
            setIsActive(false);
            refetchInterfaceDnsInfo();
        },
        onError: (error) => {
            // Leave the toggle on: clear_dns only reports failure when the adapter is
            // still pointed at the proxy, which means DNS is still being served by it.
            setIsActive(true);
            refetchInterfaceDnsInfo();
            addToast({
                title: "Could not restore DNS settings",
                description: errorMessage(error),
                color: "danger",
                timeout: 8000,
            });
        },
    });

    useEffect(() => {
        // Correct the switch in one direction only: if the proxy loopback is still on
        // the adapter, we ARE active, whatever the flag says.
        //
        // That is the case that matters for safety. A failed disconnect used to leave
        // the UI reading "off" while 127.0.0.2 was still applied, so the user would
        // close the app believing they had already disconnected and be left without
        // working DNS.
        //
        // The opposite direction is deliberately not reconciled. Turning the switch off
        // because the proxy is absent is wrong for plain DNS, which never sets the proxy
        // at all, and racy for the rest, since a refetch can land before the adapter
        // reflects the change. Those transitions are owned by the mutations below.
        if (isSettingDns || isClearingDns || isFetchingInterfaceDnsInfo) return;
        if (isProxyApplied && !isActive) {
            setIsActive(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isProxyApplied,
        isSettingDns,
        isClearingDns,
        isFetchingInterfaceDnsInfo,
    ]);

    const { mutate: testServer, isPending } = useTestServer({
        onSuccess: (data, variables) => {
            // Find the server key from the server string
            const serverKey = servers.find(
                (s) =>
                    s.servers[0] === variables.server ||
                    s.servers.includes(variables.server)
            )?.key;
            if (serverKey) {
                setTestResults((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(serverKey, data);
                    return newMap;
                });
            }
        },
        onError: (error, variables) => {
            // Find the server key from the server string
            const serverKey = servers.find(
                (s) =>
                    s.servers[0] === variables.server ||
                    s.servers.includes(variables.server)
            )?.key;
            if (serverKey) {
                setTestResults((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(serverKey, {
                        success: false,
                        latency: 0,
                        error: errorMessage(error, "Test failed"),
                    });
                    return newMap;
                });
            }
        },
    });

    // Test all servers of the current protocol when switching tabs
    useEffect(() => {
        if (!isLoadingServers) {
            const protocolServers = servers.filter((s) => s.type === protocol);

            // Mark all servers of this protocol as testing
            setTestResults((prev) => {
                const newMap = new Map(prev);
                protocolServers.forEach((server) => {
                    if (!newMap.has(server.key)) {
                        newMap.set(server.key, "testing");
                    }
                });
                return newMap;
            });

            // Test all servers — for plain DNS, pass the first IP; for others, pass the URL
            protocolServers.forEach((server) => {
                const bootstrapParams = getBootstrapParams(
                    server,
                    servers,
                    bootstrapResolverKey
                );
                testServer({
                    server: server.servers[0],
                    domain: "google.com",
                    ...bootstrapParams,
                });
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [protocol, servers, isLoadingServers]);
    const { mutate: clearDnsCache } = useClearDnsCache({
        onSuccess: () => {
            addToast({
                title: "DNS cleared",
                color: "success",
                icon: <Broom className="text-xl" />,
            });
        },
        onError: (error) => {
            addToast({
                title: "Could not clear the DNS cache",
                description: errorMessage(error),
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
                description: errorMessage(error),
                color: "danger",
            });
        }
    };

    const renderDnsServers = () => {
        const urlTypes = ["doh", "dot", "doq", "doh3"];
        if (dnsServerData && urlTypes.includes(dnsServerData.type)) {
            return dnsServerData.servers.map((server) => {
                let displayName = server;
                try {
                    const url = new URL(server);
                    displayName = url.hostname || server;
                } catch {
                    // For non-standard protocols (tls://, quic://, h3://), parse manually
                    displayName = server
                        .replace(/^(tls|quic|h3):\/\//, "")
                        .replace(/:\d+$/, "");
                }
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
                            {displayName}
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
        const bootstrapParams = getBootstrapParams(
            dnsServerData,
            servers,
            bootstrapResolverKey
        );
        setDns({
            interface_index: IfIdx ?? 0,
            dns_servers: dnsServerData?.servers,
            dns_type: dnsServerData?.type,
            ...bootstrapParams,
        });
    };
    const handleClearDns = () => {
        clearDns({
            interface_index: IfIdx ?? 0,
        });
    };

    const handleToggle = () => {
        if (!isActive) {
            handleSetDns();
        } else {
            handleClearDns();
        }
        // Flip immediately so the switch feels responsive, then let the mutation's
        // onError put it back and the reconciliation effect above confirm it against
        // the adapter. Previously this was the *only* thing that set the state, so a
        // failed clear left the UI showing "off" while 127.0.0.2 was still applied —
        // and the user would close the app believing they had disconnected.
        toggleIsActive();
    };

    const handleClearDnsCache = () => {
        clearDnsCache();
    };

    const handleResetDns = () => {
        clearDns({
            interface_index: IfIdx ?? 0,
        });
    };

    const handleTestServer = () => {
        if (!dnsServerData) return;
        const bootstrapParams = getBootstrapParams(
            dnsServerData,
            servers,
            bootstrapResolverKey
        );
        testServer({
            server: dnsServerData.servers[0] ?? "",
            domain: "google.com",
            ...bootstrapParams,
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
                            interface_index: 0,
                            name: "Auto",
                            mac_address: null,
                            ip_addresses: [],
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
                    isDisabled={!interfaceDnsInfo || isActive}
                >
                    {(items) => (
                        <SelectItem
                            key={items.interface_index}
                            textValue={items.name ?? ""}
                        >
                            <div className="flex gap-1 items-center ">
                                <div>{items.name}</div>
                                <div className="text-xs text-zinc-400">
                                    {items.interface_index === 0
                                        ? interfaceDnsInfo?.interface_name
                                        : `#${items.interface_index}`}
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
                    selectedKeys={dnsServer ? [dnsServer] : []}
                    disallowEmptySelection={true}
                    onSelectionChange={(keys) =>
                        setDnsServer(keys.currentKey as string)
                    }
                    maxListboxHeight={200}
                    startContent={<DNSServer className="text-2xl" />}
                    isDisabled={
                        !interfaceDnsInfo || isActive || isLoadingServers
                    }
                    isLoading={isLoadingServers}
                >
                    {serverList.map((server) => {
                        const testResult = testResults.get(server.key);
                        const latencyText =
                            testResult === "testing"
                                ? "Testing..."
                                : testResult?.success
                                ? `${testResult.latency}ms`
                                : testResult === null
                                ? null
                                : testResult
                                ? "Failed"
                                : null;

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
                                    {latencyText && (
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
                        setProtocol(key as "dns" | "doh" | "dot" | "doq" | "doh3");
                        // Reset to first server of the selected protocol
                        const newServerList = servers.filter(
                            (s) => s.type === key
                        );
                        if (newServerList.length > 0) {
                            setDnsServer(newServerList[0].key);
                        }
                    }}
                    color="primary"
                    isDisabled={
                        !interfaceDnsInfo || isActive || isLoadingServers
                    }
                >
                    {PROTOCOLS.map((protocol) => (
                        <Tab key={protocol.key} title={protocol.name} />
                    ))}
                </Tabs>

                <div className="flex flex-col gap-2 bg-zinc-900 rounded-md p-2 text-nowrap text-sm">
                    <div className="flex justify-between">
                        <div>
                            Server
                            {dnsServerData?.type === "dns" ? "s" : ""}:
                        </div>
                        <div>{renderDnsServers()}</div>
                    </div>
                    <div className="flex justify-between">
                        <div>Ping:</div>
                        <div>
                            {(() => {
                                const result = dnsServerData
                                    ? testResults.get(dnsServerData.key)
                                    : null;
                                if (result === "testing") {
                                    return (
                                        <span className="text-yellow-400">
                                            Testing...
                                        </span>
                                    );
                                } else if (
                                    result &&
                                    typeof result === "object" &&
                                    result.success
                                ) {
                                    return (
                                        <span className="text-green-400">
                                            {result.latency}ms
                                        </span>
                                    );
                                } else if (
                                    result &&
                                    typeof result === "object" &&
                                    !result.success
                                ) {
                                    return (
                                        <span className="text-red-400">
                                            Failed
                                        </span>
                                    );
                                } else {
                                    return (
                                        <span className="text-zinc-400">
                                            -
                                        </span>
                                    );
                                }
                            })()}
                        </div>
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
                        <Button
                            isDisabled={isActive}
                            isIconOnly
                            onPress={handleResetDns}
                        >
                            <Reset className="text-xl" />
                        </Button>
                    </Tooltip>
                    <Tooltip
                        aria-label="Test Server"
                        content="Test Server"
                        placement="top"
                    >
                        <Button
                            isIconOnly
                            onPress={handleTestServer}
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
