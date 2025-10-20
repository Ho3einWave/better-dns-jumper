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
            <div className="w-full h-full pt-8 flex flex-col">
                <Outlet />
            </div>
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
