import { Switch } from "@heroui/switch";
import { useAutoStartStore } from "../stores/useAutoStartStore";
import { useEffect } from "react";

const Setting = () => {
    const { isAutoStartEnabled, isLoading, setIsAutoStartEnabled, load } =
        useAutoStartStore();

    useEffect(() => {
        load();
    }, []);

    const handleToggleAutoStart = async () => {
        await setIsAutoStartEnabled(!isAutoStartEnabled);
    };

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <div className="absolute left-20 min-w-[87%] max-w-[87%] max-h-108 min-h-108 bg-zinc-900/50 rounded-2xl   flex flex-col overflow-hidden gap-2 py-2">
                <div className="px-2 pl-4  flex items-center justify-between">
                    <div>
                        <span>Setting</span>
                    </div>
                </div>

                <div className="px-4 mt-4">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <span>Start on system launch</span>
                            <p className="text-sm text-zinc-400">
                                Automatically open Better DNS Jumper when you
                                log in to your computer.
                            </p>
                        </div>
                        <Switch
                            isSelected={isAutoStartEnabled}
                            isDisabled={isLoading}
                            onValueChange={handleToggleAutoStart}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Setting;
