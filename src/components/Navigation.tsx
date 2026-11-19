import { Tabs, Tab } from "@heroui/tabs";
import { Tooltip } from "@heroui/tooltip";
import { DNSServer } from "../components/icons/DNSServer";
import { Setting } from "../components/icons/Setting";
import { Key, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { Lan } from "../components/icons/Lan";
import { Server } from "./icons/Server";
import { Activity } from "./icons/Activity";
import { Logs } from "./icons/Logs";
import { Test } from "./icons/Test";
import { Update } from "./icons/Update";
import { useUpdater } from "../hooks/useUpdater";
import { useTranslation } from "react-i18next";

const TABS = [
    {
        key: "main",
        icon: <DNSServer className="text-xl" />,
        path: "/",
        tooltipKey: "dns_tab",
    },
    {
        key: "servers",
        icon: <Server className="text-xl" />,
        path: "/servers",
        tooltipKey: "servers_tab",
    },
    {
        key: "network-interfaces",
        icon: <Lan className="text-xl" />,
        path: "/network-interfaces",
        tooltipKey: "network_interfaces_tab",
    },
    {
        key: "dns-activity",
        icon: <Activity className="text-xl" />,
        path: "/dns-activity",
        tooltipKey: "dns_activity_tab",
    },
    {
        key: "logs",
        icon: <Logs className="text-xl" />,
        path: "/logs",
        tooltipKey: "logs_tab",
    },
    {
        key: "benchmark",
        icon: <Test className="text-xl" />,
        path: "/benchmark",
        tooltipKey: "benchmark_tab",
    },
    {
        key: "settings",
        icon: <Setting className="text-xl" />,
        path: "/settings",
        tooltipKey: "settings_tab",
    },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const Navigation = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isUpdateAvailable, openModal } = useUpdater();
    const { t } = useTranslation();
    const [selectedKey, setSelectedKey] = useState<string>("main");

    // Update selected key based on current route
    useEffect(() => {
        const currentTab = TABS.find((tab) => tab.path === location.pathname);
        if (currentTab) {
            setSelectedKey(currentTab.key);
        }
    }, [location.pathname]);

    const handleTabChange = (key: Key) => {
        if (key === "update") {
            openModal();
            return;
        }

        const tabKey = key as TabKey;
        const tab = TABS.find((t) => t.key === tabKey);
        if (tab) {
            setSelectedKey(tabKey);
            navigate(tab.path);
        }
    };

    return (
        <div className="flex justify-center fixed top-1/2 left-4 -translate-y-1/2">
            <Tabs
                aria-label="Better DNS Jumper Tabs"
                aria-labelledby="Better DNS Jumper Tabs"
                size="sm"
                color="primary"
                radius="lg"
                classNames={{
                    tab: "h-11",
                }}
                isVertical={true}
                selectedKey={selectedKey}
                onSelectionChange={handleTabChange}
            >
                {TABS.map((tab) => (
                    <Tab
                        key={tab.key}
                        title={
                            <Tooltip
                                aria-label={t(tab.tooltipKey)}
                                content={t(tab.tooltipKey)}
                                placement="right"
                            >
                                {tab.icon}
                            </Tooltip>
                        }
                    />
                ))}
                {isUpdateAvailable && (
                    <Tab
                        key="update"
                        title={
                            <Tooltip
                                aria-label={t("nav.updateAvailable")}
                                content={t("nav.updateAvailable")}
                                placement="right"
                            >
                                <div className="relative">
                                    <Update className="text-xl" />
                                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-danger"></span>
                                    </span>
                                </div>
                            </Tooltip>
                        }
                    />
                )}
            </Tabs>
        </div>
    );
};

export default Navigation;
