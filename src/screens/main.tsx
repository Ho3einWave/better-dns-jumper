import { useState } from "react";
import ToggleButton from "../components/ToggleButton";
import { Select, SelectItem } from "@heroui/select";
import { DNS_SERVERS } from "../constants/dns-servers";
import { Button } from "@heroui/button";
import { useInterfaces } from "../hooks/useInterfaces";
import { useDns } from "../hooks/useDns";
const Main = () => {
    const [isActive, setIsActive] = useState(false);
    const [dnsServer, setDnsServer] = useState<string>(DNS_SERVERS[0].key);
    const [IfIdx, setIfIdx] = useState<number | null>(null);

    const dnsServerData = DNS_SERVERS.find(
        (server) => server.key === dnsServer
    );

    const { data: interfaces, isLoading: isLoadingInterfaces } =
        useInterfaces();

    const { mutate: setDns } = useDns();

    const handleSetDns = () => {
        setDns({
            interface_idx: IfIdx ?? -1,
            dns_servers: dnsServerData?.servers ?? [],
        });
    };
    const handleToggle = () => {
        console.log("toggle");
        if (!isActive) {
            handleSetDns();
        }
        setIsActive((prev) => {
            return !prev;
        });
    };
    return (
        <div className="flex  gap-4 items-center flex-1 justify-center">
            <div>
                <ToggleButton isActive={isActive} onClick={handleToggle} />
                <h1>DNS is active</h1>
            </div>
            <div className="min-w-82 flex flex-col gap-2">
                <Select
                    label="Provider"
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
                <Select
                    label="Interface"
                    items={[
                        { index: -1, name: "Auto", mac: null, addrs: [] },
                        ...(interfaces ?? []),
                    ]}
                    isLoading={isLoadingInterfaces}
                    selectedKeys={IfIdx ? [IfIdx.toString()] : ["-1"]}
                    disallowEmptySelection={true}
                    maxListboxHeight={200}
                    onSelectionChange={(keys) =>
                        setIfIdx(parseInt(keys.currentKey as string))
                    }
                >
                    {(items) => (
                        <SelectItem key={items.index} textValue={items.name}>
                            <div className="flex gap-1 items-center ">
                                <div>{items.name}</div>
                                <div className="text-xs text-zinc-400">
                                    {items.index === -1
                                        ? "Auto"
                                        : items.index.toString()}
                                </div>
                            </div>
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
