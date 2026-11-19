import { Input } from "@heroui/input";
import { useEffect, useState } from "react";
import { useTestDomain } from "../../stores/tauriSettingStore";
import { Button } from "@heroui/button";
import { Save } from "../icons/Save";
import { useTranslation } from "react-i18next";

const TestDomain = () => {
    const { t } = useTranslation();
    const [testDomainValue, setTestDomainValue] = useState<string>("");

    const {
        data: testDomain,
        isLoading: isLoadingTestDomain,
        mutate: saveTestDomainMutation,
        isSaving: isSavingTestDomain,
    } = useTestDomain();

    useEffect(() => {
        if (testDomain) {
            setTestDomainValue(testDomain);
        }
    }, [testDomain]);

    const handleSaveTestDomain = () => {
        saveTestDomainMutation(testDomainValue);
    };

    return (
        <div className="flex items-center justify-between gap-2">
            <div>
                <span className="text-sm font-medium">{t("tooltips.test_domain")}</span>
                <p className="text-xs text-zinc-400">
                    {t("tooltips.test_domain_desc")}
                </p>
            </div>
            <div className="flex items-center gap-1">
                <Input
                    isDisabled={isLoadingTestDomain || isSavingTestDomain}
                    size="sm"
                    value={testDomainValue}
                    onChange={(e) => setTestDomainValue(e.target.value)}
                    placeholder="youtube.com"
                    className="max-w-60"
                />
                <Button
                    isDisabled={
                        isLoadingTestDomain ||
                        isSavingTestDomain ||
                        testDomainValue === testDomain
                    }
                    size="sm"
                    isIconOnly
                    onPress={handleSaveTestDomain}
                >
                    <Save className="text-lg" />
                </Button>
            </div>
        </div>
    );
};

export default TestDomain;
