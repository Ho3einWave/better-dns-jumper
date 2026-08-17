import { useMemo, useState } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Switch } from "@heroui/switch";
import { Tooltip } from "@heroui/tooltip";
import { addToast } from "@heroui/toast";
import {
    useAppLogs,
    useClearAppLogs,
    useLogFilePath,
    useOpenLogDir,
} from "../hooks/useAppLogs";
import ConfirmModal from "../components/ConfirmModal";
import { Copy } from "../components/icons/Copy";
import { Broom } from "../components/icons/Broom";
import { LOG_LEVELS, type AppLogEntry, type LogLevel } from "../types";
import { errorMessage } from "../utils/errorMessage";

const LEVEL_COLOR: Record<
    string,
    "danger" | "warning" | "primary" | "default" | "secondary"
> = {
    ERROR: "danger",
    WARN: "warning",
    INFO: "primary",
    DEBUG: "default",
    TRACE: "secondary",
};

/** Strips the crate prefix so the target column stays readable at this width. */
const shortTarget = (target: string) =>
    target.replace(/^better_dns_jumper_lib::/, "");

const Logs = () => {
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [debounceTimer, setDebounceTimer] = useState<ReturnType<
        typeof setTimeout
    > | null>(null);
    const [activeLevels, setActiveLevels] = useState<LogLevel[]>([]);
    const [isLive, setIsLive] = useState(true);
    const [isClearModalOpen, setIsClearModalOpen] = useState(false);

    const {
        data: logs = [],
        isLoading,
        error,
    } = useAppLogs({
        filter: debouncedSearch || undefined,
        levels: activeLevels,
        enabled: isLive,
    });
    const clearLogs = useClearAppLogs();
    const { data: logPath } = useLogFilePath();
    const openLogDir = useOpenLogDir();

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceTimer) clearTimeout(debounceTimer);
        setDebounceTimer(setTimeout(() => setDebouncedSearch(value), 300));
    };

    const toggleLevel = (level: LogLevel) => {
        setActiveLevels((current) =>
            current.includes(level)
                ? current.filter((l) => l !== level)
                : [...current, level],
        );
    };

    const counts = useMemo(() => {
        const result: Record<string, number> = {};
        for (const entry of logs) {
            result[entry.level] = (result[entry.level] ?? 0) + 1;
        }
        return result;
    }, [logs]);

    const formatLine = (entry: AppLogEntry) =>
        `${entry.timestamp} [${entry.level}] [${entry.target}] ${entry.message}`;

    const handleCopyAll = async () => {
        try {
            await navigator.clipboard.writeText(
                logs.map(formatLine).join("\n"),
            );
            addToast({
                title: `Copied ${logs.length} log line${logs.length === 1 ? "" : "s"}`,
                color: "success",
                icon: <Copy className="text-xl" />,
            });
        } catch (e) {
            addToast({
                title: "Could not copy logs",
                description: errorMessage(e),
                color: "danger",
            });
        }
    };

    const handleCopyPath = async () => {
        if (!logPath) return;
        try {
            await navigator.clipboard.writeText(logPath);
            addToast({ title: "Log file path copied", color: "success" });
        } catch (e) {
            addToast({
                title: "Could not copy path",
                description: errorMessage(e),
                color: "danger",
            });
        }
    };

    const handleOpenFolder = () => {
        openLogDir.mutate(undefined, {
            onError: (e) =>
                addToast({
                    title: "Could not open the log folder",
                    description: errorMessage(e),
                    color: "danger",
                }),
        });
    };

    const handleConfirmClear = () => {
        clearLogs.mutate(undefined, {
            onSuccess: () =>
                addToast({
                    title: "Log file cleared",
                    color: "success",
                    icon: <Broom className="text-xl" />,
                }),
            onError: (e) =>
                addToast({
                    title: "Could not clear the log file",
                    description: errorMessage(e),
                    color: "danger",
                }),
        });
        setIsClearModalOpen(false);
    };

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <div className="absolute left-20 inner-container-size bg-zinc-900/50 rounded-2xl flex flex-col overflow-hidden gap-2 py-2">
                <div className="px-4 flex items-center justify-between shrink-0">
                    <span>Application Logs</span>
                    <div className="flex items-center gap-2">
                        <Tooltip
                            content={isLive ? "Pause updates" : "Resume updates"}
                            placement="bottom"
                        >
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-zinc-400">
                                    Live
                                </span>
                                <Switch
                                    size="sm"
                                    isSelected={isLive}
                                    onValueChange={setIsLive}
                                    aria-label="Live log updates"
                                />
                            </div>
                        </Tooltip>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-4 shrink-0">
                    <Input
                        size="sm"
                        placeholder="Search messages and targets..."
                        value={search}
                        onValueChange={handleSearchChange}
                        className="flex-1"
                        radius="lg"
                        isClearable
                        onClear={() => {
                            setSearch("");
                            setDebouncedSearch("");
                        }}
                    />
                    <Button size="sm" variant="flat" onPress={handleOpenFolder}>
                        Open Folder
                    </Button>
                    <Button
                        size="sm"
                        variant="flat"
                        onPress={handleCopyAll}
                        isDisabled={logs.length === 0}
                    >
                        Copy
                    </Button>
                    <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        onPress={() => setIsClearModalOpen(true)}
                        isLoading={clearLogs.isPending}
                    >
                        Clear
                    </Button>
                </div>

                <div className="flex items-center gap-1.5 px-4 shrink-0 flex-wrap">
                    {LOG_LEVELS.map((level) => {
                        const isActive = activeLevels.includes(level);
                        return (
                            <Chip
                                key={level}
                                size="sm"
                                variant={isActive ? "solid" : "flat"}
                                color={
                                    isActive ? LEVEL_COLOR[level] : "default"
                                }
                                className="cursor-pointer text-xs"
                                onClick={() => toggleLevel(level)}
                            >
                                {level}
                                {counts[level] ? ` ${counts[level]}` : ""}
                            </Chip>
                        );
                    })}
                    {activeLevels.length > 0 && (
                        <Button
                            size="sm"
                            variant="light"
                            className="h-6 min-w-0 px-2 text-xs"
                            onPress={() => setActiveLevels([])}
                        >
                            Reset
                        </Button>
                    )}
                </div>

                <div className="overflow-y-auto flex-1 min-h-0 flex flex-col gap-1 px-4">
                    {error ? (
                        <div className="flex items-center justify-center h-32 text-danger text-sm text-center px-4">
                            {errorMessage(error, "Could not read the log file")}
                        </div>
                    ) : isLoading ? (
                        <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
                            Reading log file...
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
                            {debouncedSearch || activeLevels.length > 0
                                ? "No log entries match the current filter"
                                : "No log entries yet"}
                        </div>
                    ) : (
                        logs.map((entry) => (
                            <div
                                key={entry.id}
                                className="flex items-start gap-2 bg-zinc-800/30 border-1 border-zinc-800 rounded-xl px-3 py-1.5 shrink-0"
                            >
                                <span className="text-xs text-zinc-500 shrink-0 font-mono pt-0.5">
                                    {entry.timestamp.slice(11)}
                                </span>
                                <Chip
                                    size="sm"
                                    variant="flat"
                                    color={
                                        LEVEL_COLOR[entry.level] ?? "default"
                                    }
                                    className="text-xs shrink-0"
                                >
                                    {entry.level}
                                </Chip>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-sm break-words whitespace-pre-wrap">
                                        {entry.message}
                                    </span>
                                    <span className="text-xs text-zinc-500 truncate">
                                        {shortTarget(entry.target)}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {logPath && (
                    <Tooltip content="Click to copy" placement="top">
                        <button
                            type="button"
                            onClick={handleCopyPath}
                            className="px-4 text-xs text-zinc-500 truncate text-left shrink-0 hover:text-zinc-300 transition-colors"
                        >
                            {logPath}
                        </button>
                    </Tooltip>
                )}
            </div>

            <ConfirmModal
                isOpen={isClearModalOpen}
                onClose={() => setIsClearModalOpen(false)}
                onConfirm={handleConfirmClear}
                title="Clear the log file?"
                message="This permanently empties better-dns-jumper.log. Do this only after you have saved anything you need for a bug report."
                confirmText="Clear"
                cancelText="Cancel"
                confirmColor="danger"
            />
        </div>
    );
};

export default Logs;
