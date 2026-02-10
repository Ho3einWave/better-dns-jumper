import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { useState } from "react";
import {
    usePredefinedIps,
    type PredefinedIp,
} from "../../stores/tauriPredefinedIpsStore";

const isValidIPv4 = (ip: string): boolean => {
    const ipRegex =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip.trim());
};

const PredefinedIps = () => {
    const { ips, isLoading, save, isSaving } = usePredefinedIps();
    const [newLabel, setNewLabel] = useState("");
    const [newIp, setNewIp] = useState("");
    const [error, setError] = useState("");

    const handleAdd = () => {
        const label = newLabel.trim();
        const ip = newIp.trim();
        if (!label) {
            setError("Label is required");
            return;
        }
        if (!isValidIPv4(ip)) {
            setError("Must be a valid IPv4 address");
            return;
        }
        if (ips.some((p) => p.ip === ip)) {
            setError("This IP already exists");
            return;
        }
        save([...ips, { label, ip }]);
        setNewLabel("");
        setNewIp("");
        setError("");
    };

    const handleRemove = (ip: string) => {
        save(ips.filter((p) => p.ip !== ip));
    };

    return (
        <div className="flex flex-col gap-2">
            <div>
                <span className="text-sm font-medium">Predefined IPs</span>
                <p className="text-xs text-zinc-400">
                    Quick-select IPs when creating DNS rules.
                </p>
            </div>
            <div className="flex flex-col gap-1">
                {ips.map((item: PredefinedIp) => (
                    <div
                        key={item.ip}
                        className="flex items-center justify-between bg-zinc-800/30 border-1 border-zinc-800 rounded-xl px-3 py-1.5"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-sm">{item.label}</span>
                            <span className="text-xs text-zinc-400">
                                {item.ip}
                            </span>
                        </div>
                        <Button
                            size="sm"
                            color="danger"
                            variant="light"
                            onPress={() => handleRemove(item.ip)}
                            isDisabled={isLoading || isSaving}
                        >
                            Remove
                        </Button>
                    </div>
                ))}
            </div>
            <div className="flex items-end gap-2">
                <Input
                    size="sm"
                    label="Label"
                    value={newLabel}
                    onValueChange={(v) => {
                        setNewLabel(v);
                        setError("");
                    }}
                    placeholder="e.g. SNI Proxy"
                    className="flex-1"
                    isDisabled={isLoading || isSaving}
                />
                <Input
                    size="sm"
                    label="IP Address"
                    value={newIp}
                    onValueChange={(v) => {
                        setNewIp(v);
                        setError("");
                    }}
                    placeholder="e.g. 10.0.0.1"
                    className="flex-1"
                    isDisabled={isLoading || isSaving}
                />
                <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    onPress={handleAdd}
                    isDisabled={isLoading || isSaving}
                >
                    Add
                </Button>
            </div>
            {error && (
                <span className="text-xs text-danger">{error}</span>
            )}
        </div>
    );
};

export default PredefinedIps;
