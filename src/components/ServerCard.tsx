import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { PROTOCOLS, type SERVER } from "../types";
import type { ServerTestResult } from "../hooks/useDns";

interface ServerCardProps {
    server: SERVER;
    testResult: ServerTestResult | "testing" | null;
    onEdit: () => void;
    onRemove: () => void;
}

const ServerCard = ({ server, testResult, onEdit, onRemove }: ServerCardProps) => {
    const protocol = PROTOCOLS.find((p) => p.key === server.type);

    const getLatencyBadge = () => {
        if (testResult === null || testResult === undefined) return null;
        if (testResult === "testing") {
            return (
                <span className="text-xs text-yellow-400">Testing...</span>
            );
        }
        if (testResult.success) {
            return (
                <span className="text-xs text-green-400">{testResult.latency}ms</span>
            );
        }
        return <span className="text-xs text-red-400">Failed</span>;
    };

    return (
        <div className="flex flex-col gap-1.5 bg-zinc-800/30 border-1 border-zinc-800 rounded-xl p-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{server.name}</span>
                    <Chip
                        color={protocol?.color ?? "primary"}
                        variant="flat"
                        size="sm"
                        className={`border-1 border-${protocol?.color ?? "primary"}`}
                    >
                        {protocol?.name ?? server.type.toUpperCase()}
                    </Chip>
                </div>
                {getLatencyBadge()}
            </div>
            <div>
                <span className="text-xs text-zinc-400 truncate block">
                    {server.servers.join(", ")}
                </span>
            </div>
            <div className="flex items-center justify-between">
                <div className="flex gap-1 flex-wrap">
                    {server.tags.map((tag) => (
                        <Chip
                            key={tag}
                            size="sm"
                            variant="flat"
                            className="text-xs"
                        >
                            {tag}
                        </Chip>
                    ))}
                </div>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        onPress={onEdit}
                    >
                        Edit
                    </Button>
                    <Button
                        size="sm"
                        color="danger"
                        variant="flat"
                        onPress={onRemove}
                    >
                        Delete
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ServerCard;
