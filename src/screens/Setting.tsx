import { Switch } from "@heroui/switch";
import { useAutoStartStore } from "../stores/useAutoStartStore";
import { useEffect } from "react";
import TestDomain from "../components/Setting/TestDomain";
import BootstrapResolver from "../components/Setting/BootstrapResolver";
import { useTranslation } from "react-i18next";

const Setting = () => {
    const { t } = useTranslation();
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
            <div className="absolute left-20 inner-container-size bg-zinc-900/50 rounded-2xl   flex flex-col overflow-hidden gap-2 py-2">
                <div className="px-2 pl-4  flex items-center justify-between">
                    <div>
                        <span>{t("other.setting")}</span>
                    </div>
                </div>

                <div className="px-4 mt-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <span>{t("other.start_on_launch")}</span>
                            <p className="text-sm text-zinc-400">
                                {t("other.auto_start_desc")}
                            </p>
                        </div>
                        <Switch
                            isSelected={isAutoStartEnabled}
                            isDisabled={isLoading}
                            onValueChange={handleToggleAutoStart}
                        />
                    </div>
                    <TestDomain />
                    <BootstrapResolver />
                </div>
            </div>
        </div>
    );
};

export default Setting;
