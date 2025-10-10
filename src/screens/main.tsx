import { useEffect, useState } from "react";
import ToggleButton from "../components/ToggleButton";
import { Select, SelectItem } from "@heroui/select";
import { DNS_SERVERS } from "../constants/dns-servers";
import { Button } from "@heroui/button";
import { invoke } from "@tauri-apps/api/core";
const Main = () => {
    const [isActive, setIsActive] = useState(false);
    const [dnsServer, setDnsServer] = useState<string>(DNS_SERVERS[0].key);
    const handleToggle = () => {
        setIsActive(!isActive);
    };
    const dnsServerData = DNS_SERVERS.find(
        (server) => server.key === dnsServer
    );

    useEffect(() => {
        invoke("get_best_interface");
    }, []);

    return (
        <div className="flex  gap-4 items-center flex-1 justify-center">
            <div>
                <ToggleButton isActive={isActive} onClick={handleToggle} />
                <h1>DNS is active</h1>
            </div>
            <div className="min-w-82 flex flex-col gap-2">
                <Select
                    items={DNS_SERVERS}
                    selectedKeys={[dnsServer]}
                    disallowEmptySelection={true}
                    onSelectionChange={(keys) =>
                        setDnsServer(keys.currentKey as string)
                    }
                    maxListboxHeight={200}
                >
                    {(items) => (
                        <SelectItem key={items.key} textValue={items.name}>
                            {items.name}
                        </SelectItem>
                    )}
                </Select>
                <div className="flex flex-col gap-2 bg-zinc-900 rounded-md p-2 text-nowrap text-sm">
                    <div className="flex justify-between">
                        <div>Provider:</div>
                        <div>{dnsServerData?.name}</div>
                    </div>
                    <div className="flex justify-between">
                        <div>Servers:</div>
                        <div>{dnsServerData?.servers.join(", ")}</div>
                    </div>
                    <div className="flex justify-between">
                        <div>Tags:</div>
                        <div>{dnsServerData?.tags.join(", ")}</div>
                    </div>
                </div>
                <div>
                    <Button size="sm">Clear Cache</Button>
                </div>
            </div>
        </div>
    );
};

export default Main;
