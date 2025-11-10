import { Tabs, Tab } from "@heroui/tabs";
import { Tooltip } from "@heroui/tooltip";
import { DNSServer } from "../components/icons/DNSServer";
import { Setting } from "../components/icons/Setting";
import { Key, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { Lan } from "../components/icons/Lan";
import { Server } from "./icons/Server";
import { Update } from "./icons/Update";
import { useUpdater } from "../hooks/useUpdater";

const TABS = [
    {
        key: "main",
        title: "DNS",
        icon: <DNSServer className="text-xl" />,
        path: "/",
    },
    {
        key: "servers",
        title: "Servers",
        icon: <Server className="text-xl" />,
        path: "/servers",
    },
    {
        key: "network-interfaces",
        title: "Network Interfaces",
        icon: <Lan className="text-xl" />,
        path: "/network-interfaces",
    },
    {
        key: "settings",
        title: "Settings",
        icon: <Setting className="text-xl" />,
        path: "/settings",
    },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const Navigation = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isUpdateAvailable, openModal } = useUpdater();
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
                                aria-label={tab.title}
                                content={tab.title}
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
                                aria-label="Update Available"
                                content="Update Available"
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
