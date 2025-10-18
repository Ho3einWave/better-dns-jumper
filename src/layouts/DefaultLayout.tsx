import { Outlet } from "react-router";
import Titlebar from "../components/Titlebar";
import { Tabs, Tab } from "@heroui/tabs";
import { Tooltip } from "@heroui/tooltip";
import { DNSServer } from "../components/icons/DNSServer";
import { Setting } from "../components/icons/Setting";
import { Key } from "react";
import { useNavigate } from "react-router";
import { Lan } from "../components/icons/Lan";

type TabKey = "main" | "network-interfaces" | "settings";
const DefaultLayout = () => {
    const navigate = useNavigate();
    const handleTabChange = (key: Key) => {
        const tabKey = key as TabKey;
        switch (tabKey) {
            case "main":
                navigate("/");
                break;
            case "network-interfaces":
                navigate("/network-interfaces");
                break;
            case "settings":
                navigate("/settings");
                break;
        }
    };
    return (
        <div className="flex flex-col h-full">
            <Titlebar />
            <Outlet />
            <div className="flex justify-center absolute bottom-4 left-1/2 -translate-x-1/2">
                <Tabs
                    aria-label="DNS Jumper Tabs"
                    aria-labelledby="DNS Jumper Tabs"
                    size="sm"
                    radius="full"
                    color="primary"
                    onSelectionChange={handleTabChange}
                >
                    <Tab
                        key="main"
                        title={
                            <Tooltip aria-label="DNS" content="DNS">
                                <DNSServer className="text-xl" />
                            </Tooltip>
                        }
                    />
                    <Tab
                        key="network-interfaces"
                        title={
                            <Tooltip
                                aria-label="Network Interfaces"
                                content="Network Interfaces"
                            >
                                <Lan className="text-xl" />
                            </Tooltip>
                        }
                    />
                    <Tab
                        key="settings"
                        title={
                            <Tooltip aria-label="Settings" content="Settings">
                                <Setting className="text-xl" />
                            </Tooltip>
                        }
                    />
                </Tabs>
            </div>
        </div>
    );
};

export default DefaultLayout;
