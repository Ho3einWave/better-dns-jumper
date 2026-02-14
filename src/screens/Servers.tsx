import { useEffect, useMemo, useState } from "react";
import { useServerStore } from "../stores/useServersStore";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Tab, Tabs } from "@heroui/tabs";
import ServerModal from "../components/ServerModal";
import ServerCard from "../components/ServerCard";
import ConfirmModal from "../components/ConfirmModal";
import { PROTOCOLS, type SERVER } from "../types";
import { useTestServer, type ServerTestResult } from "../hooks/useDns";
import { useBootstrapResolverKey } from "../stores/tauriSettingStore";
import { getBootstrapParams } from "../utils/bootstrap";

const Servers = () => {
    const {
        load,
        servers,
        addServer,
        removeServer,
        updateServer,
        resetServers,
    } = useServerStore();
    const { data: bootstrapResolverKey } = useBootstrapResolverKey();

    const [activeTab, setActiveTab] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"add" | "edit">("add");
    const [editingServer, setEditingServer] = useState<SERVER | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [deletingServerKey, setDeletingServerKey] = useState<string | null>(
        null
    );
    const [testResults, setTestResults] = useState<
        Map<string, ServerTestResult | "testing" | null>
    >(new Map());

    const { mutate: testServer } = useTestServer({
        onSuccess: (data, variables) => {
            const serverKey = servers.find(
                (s) =>
                    s.servers[0] === variables.server ||
                    s.servers.includes(variables.server)
            )?.key;
            if (serverKey) {
                setTestResults((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(serverKey, data);
                    return newMap;
                });
            }
        },
        onError: (error, variables) => {
            const serverKey = servers.find(
                (s) =>
                    s.servers[0] === variables.server ||
                    s.servers.includes(variables.server)
            )?.key;
            if (serverKey) {
                setTestResults((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(serverKey, {
                        success: false,
                        latency: 0,
                        error: error.message || "Test failed",
                    });
                    return newMap;
                });
            }
        },
    });

    const filteredServers = useMemo(() => {
        let result = servers;

        // Filter by protocol tab
        if (activeTab !== "all") {
            result = result.filter((server) => server.type === activeTab);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                (server) =>
                    server.name.toLowerCase().includes(query) ||
                    server.servers.some((s) => s.toLowerCase().includes(query)) ||
                    server.tags.some((t) => t.toLowerCase().includes(query))
            );
        }

        return result;
    }, [servers, activeTab, searchQuery]);

    useEffect(() => {
        load();
    }, []);

    // Auto-test servers when tab changes or servers load
    useEffect(() => {
        const serversToTest =
            activeTab === "all"
                ? servers
                : servers.filter((s) => s.type === activeTab);

        // Mark untested servers as testing
        setTestResults((prev) => {
            const newMap = new Map(prev);
            serversToTest.forEach((server) => {
                if (!newMap.has(server.key)) {
                    newMap.set(server.key, "testing");
                }
            });
            return newMap;
        });

        // Test servers that haven't been tested yet
        serversToTest.forEach((server) => {
            if (!testResults.has(server.key)) {
                const bootstrapParams = getBootstrapParams(
                    server,
                    servers,
                    bootstrapResolverKey
                );
                testServer({
                    server: server.servers[0],
                    domain: "google.com",
                    ...bootstrapParams,
                });
            }
        });
    }, [activeTab, servers]);

    const handleResetServers = () => {
        setIsConfirmModalOpen(true);
    };

    const handleConfirmReset = async () => {
        await resetServers();
        load();
        setTestResults(new Map());
        setIsConfirmModalOpen(false);
    };

    const handleRequestDelete = (key: string) => {
        setDeletingServerKey(key);
    };

    const handleConfirmDelete = async () => {
        if (deletingServerKey) {
            await removeServer(deletingServerKey);
            load();
            setTestResults((prev) => {
                const newMap = new Map(prev);
                newMap.delete(deletingServerKey);
                return newMap;
            });
            setDeletingServerKey(null);
        }
    };

    const handleOpenAddModal = () => {
        setModalMode("add");
        setEditingServer(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (server: SERVER) => {
        setModalMode("edit");
        setEditingServer(server);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingServer(null);
    };

    const handleSaveServer = async (server: SERVER) => {
        if (modalMode === "edit") {
            await updateServer(server);
        } else {
            await addServer(server);
        }
        load();
    };

    const deletingServerName = deletingServerKey
        ? servers.find((s) => s.key === deletingServerKey)?.name ?? "this server"
        : "this server";

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <div className="absolute left-20 inner-container-size bg-zinc-900/50 rounded-2xl flex flex-col overflow-hidden">
                {/* Tabs header */}
                <div className="px-3 pt-2">
                    <Tabs
                        variant="underlined"
                        size="sm"
                        color="primary"
                        selectedKey={activeTab}
                        onSelectionChange={(key) =>
                            setActiveTab(key as string)
                        }
                        classNames={{
                            tabList: "gap-3",
                        }}
                    >
                        <Tab key="all" title="All" />
                        {PROTOCOLS.map((protocol) => (
                            <Tab key={protocol.key} title={protocol.name} />
                        ))}
                    </Tabs>
                </div>

                {/* Toolbar */}
                <div className="px-3 py-2 flex items-center gap-2">
                    <Input
                        size="sm"
                        isClearable
                        placeholder="Search servers..."
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                        className="flex-1"
                        classNames={{
                            inputWrapper: "bg-zinc-800/50",
                        }}
                    />
                    <Button
                        size="sm"
                        color="default"
                        variant="flat"
                        onPress={handleResetServers}
                    >
                        Restore Defaults
                    </Button>
                    <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        onPress={handleOpenAddModal}
                    >
                        + Add
                    </Button>
                </div>

                {/* Server list */}
                <div className="overflow-y-auto px-3 pb-3 flex flex-col gap-2 flex-1">
                    {filteredServers.length === 0 ? (
                        <div className="flex items-center justify-center flex-1 text-zinc-500 text-sm">
                            No servers found
                        </div>
                    ) : (
                        filteredServers.map((server) => (
                            <ServerCard
                                key={server.key}
                                server={server}
                                testResult={
                                    testResults.get(server.key) ?? null
                                }
                                onEdit={() => handleOpenEditModal(server)}
                                onRemove={() =>
                                    handleRequestDelete(server.key)
                                }
                            />
                        ))
                    )}
                </div>
            </div>

            <ServerModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveServer}
                server={editingServer}
                mode={modalMode}
                existingKeys={servers.map((s) => s.key)}
            />

            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleConfirmReset}
                title="Restore Default Servers?"
                message="This will replace all your custom servers with the default server list. This action cannot be undone."
                confirmText="Restore"
                cancelText="Cancel"
                confirmColor="danger"
            />

            <ConfirmModal
                isOpen={!!deletingServerKey}
                onClose={() => setDeletingServerKey(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Server?"
                message={`Are you sure you want to delete "${deletingServerName}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                confirmColor="danger"
            />
        </div>
    );
};

export default Servers;
