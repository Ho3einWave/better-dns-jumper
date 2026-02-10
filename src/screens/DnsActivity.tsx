import { useState } from "react";
import { Tabs, Tab } from "@heroui/tabs";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Switch } from "@heroui/switch";
import { useDnsLogs, useClearDnsLogs } from "../hooks/useDnsLogs";
import {
    useDnsRules,
    useSaveDnsRule,
    useDeleteDnsRule,
    useToggleDnsRule,
} from "../hooks/useDnsRules";
import DnsRuleModal from "../components/DnsRuleModal";
import ConfirmModal from "../components/ConfirmModal";
import PredefinedIps from "../components/Setting/PredefinedIps";
import type { DnsQueryLog, DnsRule } from "../types";

const DnsActivity = () => {
    const [searchFilter, setSearchFilter] = useState("");
    const [debouncedFilter, setDebouncedFilter] = useState("");
    const [debounceTimer, setDebounceTimer] = useState<ReturnType<
        typeof setTimeout
    > | null>(null);

    const { data: logs = [] } = useDnsLogs(debouncedFilter || undefined);
    const clearLogs = useClearDnsLogs();

    const { data: rules = [] } = useDnsRules();
    const saveDnsRule = useSaveDnsRule();
    const deleteDnsRule = useDeleteDnsRule();
    const toggleDnsRule = useToggleDnsRule();

    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [ruleModalMode, setRuleModalMode] = useState<"add" | "edit">("add");
    const [editingRule, setEditingRule] = useState<DnsRule | null>(null);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

    const handleSearchChange = (value: string) => {
        setSearchFilter(value);
        if (debounceTimer) clearTimeout(debounceTimer);
        const timer = setTimeout(() => {
            setDebouncedFilter(value);
        }, 300);
        setDebounceTimer(timer);
    };

    const handleAddRule = () => {
        setRuleModalMode("add");
        setEditingRule(null);
        setIsRuleModalOpen(true);
    };

    const handleEditRule = (rule: DnsRule) => {
        setRuleModalMode("edit");
        setEditingRule(rule);
        setIsRuleModalOpen(true);
    };

    const handleSaveRule = async (rule: DnsRule) => {
        await saveDnsRule.mutateAsync(rule);
    };

    const handleDeleteRule = (id: string) => {
        setDeletingRuleId(id);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (deletingRuleId) {
            await deleteDnsRule.mutateAsync(deletingRuleId);
        }
        setIsDeleteModalOpen(false);
        setDeletingRuleId(null);
    };

    const handleToggleRule = async (id: string) => {
        await toggleDnsRule.mutateAsync(id);
    };

    const handleModifyFromLog = (log: DnsQueryLog) => {
        setRuleModalMode("add");
        setEditingRule({
            id: "",
            domain: log.domain,
            response: "0.0.0.0",
            enabled: true,
            record_type: log.record_type === "AAAA" ? "AAAA" : "A",
        });
        setIsRuleModalOpen(true);
    };

    const handleExportRules = () => {
        const json = JSON.stringify(rules, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "dns_rules.json";
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportRules = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const imported = JSON.parse(text) as DnsRule[];
                if (!Array.isArray(imported)) return;
                for (const rule of imported) {
                    if (rule.domain && rule.response) {
                        await saveDnsRule.mutateAsync({
                            ...rule,
                            id: rule.id || crypto.randomUUID(),
                        });
                    }
                }
            } catch {
                // invalid file, silently ignore
            }
        };
        input.click();
    };

    const formatTime = (timestamp: string) => {
        try {
            const date = new Date(timestamp);
            return date.toLocaleTimeString("en-US", { hour12: false });
        } catch {
            return timestamp;
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case "success":
                return "success";
            case "error":
                return "danger";
            case "blocked":
                return "warning";
            default:
                return "default";
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <div className="absolute left-20 inner-container-size bg-zinc-900/50 rounded-2xl flex flex-col overflow-hidden">
                <Tabs
                    aria-label="DNS Activity Tabs"
                    size="sm"
                    color="primary"
                    variant="underlined"
                    classNames={{
                        tabList: "px-4 pt-2",
                        panel: "flex-1 overflow-hidden flex flex-col",
                    }}
                >
                    <Tab key="logs" title="Query Logs">
                        <div className="flex flex-col gap-2 flex-1 min-h-0 px-2 pb-2">
                            <div className="flex items-center gap-2 px-2 shrink-0">
                                <Input
                                    size="sm"
                                    placeholder="Search domains..."
                                    value={searchFilter}
                                    onValueChange={handleSearchChange}
                                    className="flex-1"
                                    radius="lg"
                                    isClearable
                                    onClear={() => {
                                        setSearchFilter("");
                                        setDebouncedFilter("");
                                    }}
                                />
                                <Button
                                    size="sm"
                                    variant="flat"
                                    color="danger"
                                    onPress={() => clearLogs.mutate()}
                                    isLoading={clearLogs.isPending}
                                >
                                    Clear
                                </Button>
                            </div>
                            <div className="overflow-y-auto flex-1 min-h-0 flex flex-col gap-1 px-2">
                                {logs.length === 0 ? (
                                    <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
                                        No DNS queries logged yet
                                    </div>
                                ) : (
                                    logs.map((log) => (
                                        <div
                                            key={log.id}
                                            className="flex items-center justify-between bg-zinc-800/30 border-1 border-zinc-800 rounded-xl px-3 py-1.5 gap-2 shrink-0"
                                        >
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-zinc-500 shrink-0">
                                                        {formatTime(
                                                            log.timestamp,
                                                        )}
                                                    </span>
                                                    <span className="text-sm truncate">
                                                        {log.domain}
                                                    </span>
                                                    <Chip
                                                        size="sm"
                                                        variant="flat"
                                                        className="text-xs shrink-0"
                                                    >
                                                        {log.record_type}
                                                    </Chip>
                                                </div>
                                                <div className="text-xs text-zinc-400 truncate">
                                                    {log.response_records.join(
                                                        ", ",
                                                    ) || "\u2014"}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-xs text-zinc-500">
                                                    {log.latency_ms}ms
                                                </span>
                                                <Chip
                                                    size="sm"
                                                    variant="flat"
                                                    color={statusColor(
                                                        log.status,
                                                    )}
                                                    className="text-xs capitalize"
                                                >
                                                    {log.status}
                                                </Chip>
                                                <Button
                                                    size="sm"
                                                    variant="flat"
                                                    color="primary"
                                                    onPress={() =>
                                                        handleModifyFromLog(
                                                            log,
                                                        )
                                                    }
                                                >
                                                    Modify
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </Tab>
                    <Tab key="rules" title="DNS Rules">
                        <div className="flex flex-col gap-2 flex-1 min-h-0 px-2 pb-2">
                            <div className="flex items-center justify-between px-2 shrink-0">
                                <span className="text-sm text-zinc-400">
                                    {rules.length} rule
                                    {rules.length !== 1 ? "s" : ""}
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        onPress={handleImportRules}
                                    >
                                        Import
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        onPress={handleExportRules}
                                        isDisabled={rules.length === 0}
                                    >
                                        Export
                                    </Button>
                                    <Button
                                        size="sm"
                                        color="primary"
                                        variant="flat"
                                        onPress={handleAddRule}
                                    >
                                        Add Rule
                                    </Button>
                                </div>
                            </div>
                            <div className="overflow-y-auto flex-1 min-h-0 flex flex-col gap-1 px-2">
                                {rules.length === 0 ? (
                                    <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
                                        No DNS rules configured
                                    </div>
                                ) : (
                                    rules.map((rule) => (
                                        <div
                                            key={rule.id}
                                            className="flex items-center justify-between bg-zinc-800/30 border-1 border-zinc-800 rounded-xl px-3 py-2"
                                        >
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm">
                                                        {rule.domain}
                                                    </span>
                                                    <Chip
                                                        size="sm"
                                                        variant="flat"
                                                        className="text-xs"
                                                    >
                                                        {rule.record_type}
                                                    </Chip>
                                                </div>
                                                <span className="text-xs text-zinc-400">
                                                    → {rule.response}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    size="sm"
                                                    isSelected={rule.enabled}
                                                    onValueChange={() =>
                                                        handleToggleRule(
                                                            rule.id,
                                                        )
                                                    }
                                                />
                                                <Button
                                                    size="sm"
                                                    color="primary"
                                                    variant="flat"
                                                    onPress={() =>
                                                        handleEditRule(rule)
                                                    }
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    color="danger"
                                                    variant="flat"
                                                    onPress={() =>
                                                        handleDeleteRule(
                                                            rule.id,
                                                        )
                                                    }
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </Tab>
                    <Tab key="predefined-ips" title="Predefined IPs">
                        <div className="flex flex-col gap-2 flex-1 min-h-0 px-4 py-2">
                            <PredefinedIps />
                        </div>
                    </Tab>
                </Tabs>
            </div>

            <DnsRuleModal
                isOpen={isRuleModalOpen}
                onClose={() => {
                    setIsRuleModalOpen(false);
                    setEditingRule(null);
                }}
                onSave={handleSaveRule}
                rule={editingRule}
                mode={ruleModalMode}
            />

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setDeletingRuleId(null);
                }}
                onConfirm={handleConfirmDelete}
                title="Delete DNS Rule?"
                message="This will permanently remove this DNS rule. This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                confirmColor="danger"
            />
        </div>
    );
};

export default DnsActivity;
