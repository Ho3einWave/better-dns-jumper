import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/dropdown";
import { useTranslation } from "react-i18next";
import { Languages } from "./icons/Languages";

const LANGS = [
    { key: "en", label: "EN", full: "English" },
    { key: "tr", label: "TR", full: "Türkçe" },
];

const LanguageSwitcher = () => {
    const { i18n } = useTranslation();
    const [current, setCurrent] = useState(i18n.resolvedLanguage || "en");

    useEffect(() => {
        setCurrent(i18n.resolvedLanguage || "en");
    }, [i18n.resolvedLanguage]);

    const changeLanguage = (key: string) => {
        i18n.changeLanguage(key);
        try {
            localStorage.setItem("better-dns-jumper-lang", key);
        } catch {}
    };

    const currentLabel = LANGS.find((l) => l.key === current)?.label ?? "EN";

    return (
        <Dropdown>
            <DropdownTrigger>
                <Button
                    size="sm"
                    variant="light"
                    isIconOnly
                    aria-label="Change language"
                    className="min-w-0"
                >
                    <Languages className="text-lg" />
                    <span className="text-xs font-medium ml-0.5">{currentLabel}</span>
                </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Language selection">
                {LANGS.map((lang) => (
                    <DropdownItem
                        key={lang.key}
                        onPress={() => changeLanguage(lang.key)}
                        className={current === lang.key ? "font-semibold" : ""}
                    >
                        {lang.full}
                    </DropdownItem>
                ))}
            </DropdownMenu>
        </Dropdown>
    );
};

export default LanguageSwitcher;
