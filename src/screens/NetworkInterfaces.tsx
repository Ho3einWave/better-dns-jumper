import { addToast } from "@heroui/toast";
import { CONFIG_MANAGER_ERROR_CODE_DISABLED } from "../constants/interface";
import { useChangeInterfaceState, useInterfaces } from "../hooks/useInterfaces";
import { Button } from "@heroui/button";
import { getInterfaceIcon } from "../utils/interface";
import { Connected } from "../components/icons/Connected";
import { Disconnect } from "../components/icons/Disconnect";
import { ScrollShadow } from "@heroui/scroll-shadow";

const NetworkInterfaces = () => {
    const { data: interfaces, refetch: refetchInterfaces } = useInterfaces({
        refetchInterval: 5000,
    });

    const {
        mutateAsync: changeInterfaceState,
        isPending: isChangingInterfaceState,
    } = useChangeInterfaceState();

    const handleChangeInterfaceState = async (
        interfaceIdx: number,
        enable: boolean
    ) => {
        addToast({
            title: "Changing interface state...",
            color: "primary",
            promise: changeInterfaceStatePromise(interfaceIdx, enable),
        });
    };

    const changeInterfaceStatePromise = async (
        interfaceIdx: number,
        enable: boolean
    ) => {
        await changeInterfaceState({
            interface_idx: interfaceIdx,
            enable: enable,
        });
        await refetchInterfaces();
    };
    return (
        <div className="flex flex-col items-center justify-center h-full">
            <div className="absolute left-20 min-w-[87%] max-w-[87%] max-h-108 min-h-108 bg-zinc-900/50 rounded-2xl flex flex-col gap-2 overflow-hidden">
                <ScrollShadow className=" overflow-y-auto px-2 py-2 flex flex-col gap-2 scrollbar-hide">
                    {interfaces?.map((iface) => {
                        const isDisabled =
                            iface.adapter.config_manager_error_code ===
                            CONFIG_MANAGER_ERROR_CODE_DISABLED;
                        return (
                            <div
                                key={iface.adapter.interface_index}
                                className="flex items-center justify-between bg-zinc-800 rounded-xl p-1 pl-2"
                            >
                                <div className="text-xs flex items-center gap-1">
                                    <span className="text-xl">
                                        {getInterfaceIcon(
                                            iface.adapter.description ?? ""
                                        )}
                                    </span>
                                    <span>{iface.adapter.name}</span>
                                    <span className="text-zinc-400">
                                        #{iface.adapter.interface_index}
                                    </span>
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
                                                isDisabled
                                            )
                                        }
                                        variant="flat"
                                        isDisabled={isChangingInterfaceState}
                                    >
                                        {isDisabled ? (
                                            <Connected className="text-lg" />
                                        ) : (
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
};

export default NetworkInterfaces;
