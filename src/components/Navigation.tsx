import { Tabs, Tab } from "@heroui/tabs";
import { Tooltip } from "@heroui/tooltip";
import { DNSServer } from "../components/icons/DNSServer";
import { Setting } from "../components/icons/Setting";
import { Key } from "react";
import { useNavigate } from "react-router";
import { Lan } from "../components/icons/Lan";
import { Server } from "./icons/Server";

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
    const handleTabChange = (key: Key) => {
        const tabKey = key as TabKey;
        const tab = TABS.find((t) => t.key === tabKey);
        if (tab) {
            navigate(tab.path);
        }
    };
    return (
        <div className="flex justify-center fixed top-1/2 left-4 -translate-y-1/2">
            <Tabs
                aria-label="DNS Jumper Tabs"
                aria-labelledby="DNS Jumper Tabs"
                size="sm"
                color="primary"
                radius="lg"
                classNames={{
                    tab: "h-11",
                }}
                isVertical={true}
                onSelectionChange={handleTabChange}
            >
                {TABS.map((tab) => (
                    <Tab
                        key={tab.key}
                        title={
                            <Tooltip aria-label={tab.title} content={tab.title}>
                                {tab.icon}
                            </Tooltip>
                        }
                    />
                ))}
            </Tabs>
        </div>
    );
};

export default Navigation;
