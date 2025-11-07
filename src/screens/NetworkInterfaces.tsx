import { addToast } from "@heroui/toast";
import { CONFIG_MANAGER_ERROR_CODE_DISABLED } from "../constants/interface";
import { useChangeInterfaceState, useInterfaces } from "../hooks/useInterfaces";
import { Button } from "@heroui/button";
import { getInterfaceIcon } from "../utils/interface";

const NetworkInterfaces = () => {
    const { data: interfaces, refetch: refetchInterfaces } = useInterfaces();

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
            <div className="absolute left-20 min-w-10/12 max-w-60 min-h-4/5 bg-zinc-900 rounded-2xl max-h-104  flex flex-col gap-2 overflow-hidden">
                <div className=" overflow-y-auto px-2 py-2 flex flex-col gap-2">
                    {interfaces?.map((iface) => (
                        <div
                            key={iface.adapter.interface_index}
                            className="flex items-center justify-between bg-zinc-800 rounded-xl p-1 pl-2 "
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
                                    onPress={() =>
                                        handleChangeInterfaceState(
                                            iface.adapter.interface_index,
                                            iface.adapter
                                                .config_manager_error_code ===
                                                CONFIG_MANAGER_ERROR_CODE_DISABLED
                                        )
                                    }
                                    isDisabled={isChangingInterfaceState}
                                >
                                    {iface.adapter.config_manager_error_code ===
                                    CONFIG_MANAGER_ERROR_CODE_DISABLED
                                        ? "Enable"
                                        : "Disable"}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default NetworkInterfaces;
