import React from "react";
import {
    useBestInterface,
    useChangeInterfaceState,
    useInterfaces,
} from "../hooks/useInterfaces";
import { Button } from "@heroui/button";

const NetworkInterfaces = () => {
    const { data: interfaces, isLoading: isLoadingInterfaces } =
        useInterfaces();
    const { data: bestInterface, isLoading: isLoadingBestInterface } =
        useBestInterface();

    const { mutate: changeInterfaceState } = useChangeInterfaceState();

    const handleChangeInterfaceState = (interfaceIdx: number) => {
        changeInterfaceState({
            interface_idx: interfaceIdx,
            enable: true,
        });
    };
    return (
        <div className="flex flex-col items-center justify-center h-full">
            <div className="min-w-3/4 max-w-60 min-h-3/4 bg-zinc-900 rounded-2xl max-h-96 overflow-y-auto px-4 py-2 flex flex-col gap-2">
                {interfaces?.map((ifaces) => (
                    <div
                        key={ifaces.index}
                        className="flex items-center justify-between"
                    >
                        <div>{ifaces.name}</div>
                        <div>
                            <Button
                                onPress={() =>
                                    handleChangeInterfaceState(ifaces.index)
                                }
                            >
                                {ifaces.index === bestInterface?.index
                                    ? "Best"
                                    : "Not Best"}
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NetworkInterfaces;
