import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { addToast } from "@heroui/toast";
import { useState } from "react";
import { Connected } from "../components/icons/Connected";
import { Disconnect } from "../components/icons/Disconnect";
import InterfaceIp from "../components/InterfaceIp";
import { CONFIG_MANAGER_ERROR_CODE_DISABLED } from "../constants/interface";
import { useChangeInterfaceState, useInterfaces } from "../hooks/useInterfaces";
import {
    getInterfaceIcon,
    getInterfaceType,
    InterfaceType,
} from "../utils/interface";

function NetworkInterfaces() {
    const [search, setSearch] = useState("");
    const { data: interfaces, refetch: refetchInterfaces } = useInterfaces({
        refetchInterval: 5000,
    });

    const {
        mutateAsync: changeInterfaceState,
        isPending: isChangingInterfaceState,
    } = useChangeInterfaceState();

    const changeInterfaceStatePromise = async (
        interfaceIdx: number,
        enable: boolean,
    ) => {
        await changeInterfaceState({
            interface_idx: interfaceIdx,
            enable,
        });
        await refetchInterfaces();
    };

    const handleChangeInterfaceState = async (
        interfaceIdx: number,
        enable: boolean,
    ) => {
        addToast({
            title: "Changing interface state...",
            color: "primary",
            promise: changeInterfaceStatePromise(interfaceIdx, enable),
        });
    };

    const getTypePriority = (type: InterfaceType | undefined): number => {
        switch (type) {
            case InterfaceType.Vpn:
                return 0;
            case InterfaceType.Wifi:
                return 1;
            case InterfaceType.Ethernet:
                return 2;
            case InterfaceType.Virtual:
                return 3;
            case InterfaceType.Bluetooth:
                return 4;
            default:
                return 5;
        }
    };

    const processedInterfaces = interfaces
        ?.sort((a, b) => {
            // First sort by net_enabled status
            const enabledDiff
                = Number(b.adapter.net_enabled) - Number(a.adapter.net_enabled);
            if (enabledDiff !== 0) {
                return enabledDiff;
            }

            // Then sort by type priority
            const typeA = getInterfaceType(a.adapter.description ?? "");
            const typeB = getInterfaceType(b.adapter.description ?? "");
            const priorityA = getTypePriority(typeA);
            const priorityB = getTypePriority(typeB);
            return priorityA - priorityB;
        })
        .filter(
            iface =>
                iface.adapter.name
                    ?.toLowerCase()
                    .includes(search.toLowerCase())
                    || iface.adapter.description
                        ?.toLowerCase()
                        .includes(search.toLowerCase())
                        || iface.config.ip_address?.some(ip => ip.includes(search)),
        );

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <div className="absolute left-20 min-w-[87%] max-w-[87%] max-h-108 min-h-108 bg-zinc-900/50 rounded-2xl flex flex-col gap-2 overflow-hidden px-2 py-2">
                <div>
                    <Input
                        placeholder="Search name, description or IP"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <ScrollShadow className=" overflow-y-auto  flex flex-col gap-2 scrollbar-hide">
                    {processedInterfaces?.map((iface) => {
                        const isDisabled
                            = iface.adapter.config_manager_error_code
                                === CONFIG_MANAGER_ERROR_CODE_DISABLED;
                        return (
                            <div
                                key={iface.adapter.interface_index}
                                className="flex justify-between bg-zinc-800 rounded-xl p-2 pl-2"
                            >
                                <div className="text-xs flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                        <span className="text-xl">
                                            {getInterfaceIcon(
                                                iface.adapter.description ?? "",
                                            )}
                                        </span>
                                        <span>{iface.adapter.name}</span>
                                        <span className="text-zinc-400">
                                            #
                                            {iface.adapter.interface_index}
                                        </span>
                                    </div>
                                    <div className="text-zinc-400">
                                        {iface.adapter.description}
                                    </div>
                                    <div className="text-zinc-400 flex gap-1">
                                        {iface.config.ip_address?.map(ip => (
                                            <InterfaceIp key={ip} ip={ip} />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <Button
                                        size="sm"
                                        color={
                                            isDisabled ? "primary" : "danger"
                                        }
                                        onPress={() =>
                                            handleChangeInterfaceState(
                                                iface.adapter.interface_index,
                                                isDisabled,
                                            )}
                                        variant="flat"
                                        isDisabled={isChangingInterfaceState}
                                    >
                                        {isDisabled
                                            ? (
                                                    <Connected className="text-lg" />
                                                )
                                            : (
                                                    <Disconnect className="text-lg" />
                                                )}
                                        {isDisabled ? "Enable" : "Disable"}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </ScrollShadow>
            </div>
        </div>
    );
}

export default NetworkInterfaces;
