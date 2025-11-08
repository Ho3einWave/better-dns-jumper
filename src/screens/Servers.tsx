import { useEffect, useMemo, useState } from "react";
import { useServerStore } from "../stores/useServersStore";
import { Button } from "@heroui/button";
import ServerModal from "../components/ServerModal";
import { PROTOCOLS, type SERVER } from "../types";
import { Chip } from "@heroui/chip";
import { Select, SelectItem } from "@heroui/select";

const Servers = () => {
    const {
        load,
        servers,
        addServer,
        removeServer,
        updateServer,
        resetServers,
    } = useServerStore();

    const [activeTab, setActiveTab] = useState("all");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"add" | "edit">("add");
    const [editingServer, setEditingServer] = useState<SERVER | null>(null);

    const filteredServers = useMemo(() => {
        if (activeTab === "all") {
            return servers;
        } else {
            return servers.filter((server) => server.type === activeTab);
        }
    }, [servers, activeTab]);

    useEffect(() => {
        load();
    }, []);

    const handleResetServers = async () => {
        await resetServers();
        load();
    };

    const handleRemoveServer = async (key: string) => {
        await removeServer(key);
        load();
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

    const getServerType = (type: string) => {
        return PROTOCOLS.find((p) => p.key === type)?.name;
    };

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <div className="absolute left-20 min-w-[87%] max-w-[87%] max-h-108 min-h-108 bg-zinc-900/50 rounded-2xl   flex flex-col overflow-hidden gap-2 py-2">
                <div className="px-2 pl-4  flex items-center justify-between">
                    <div>
                        <span>Servers</span>
                    </div>
                    <div className="flex gap-2">
                        <div>
                            <Select
                                selectedKeys={[activeTab]}
                                onSelectionChange={(key) =>
                                    setActiveTab(key.currentKey as string)
                                }
                                size="sm"
                                variant="flat"
                                aria-label="Select a protocol"
                                aria-labelledby="Select a protocol"
                                className="min-w-24"
                            >
                                <SelectItem key="all">All</SelectItem>
                                <SelectItem key="dns">DNS</SelectItem>
                                <SelectItem key="doh">DoH</SelectItem>
                            </Select>
                        </div>
                        <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            onPress={handleOpenAddModal}
                        >
                            Add Server
                        </Button>
                        <Button
                            size="sm"
                            color="default"
                            variant="flat"
                            onPress={handleResetServers}
                        >
                            Restore Defaults
                        </Button>
                    </div>
                </div>

                <div className=" overflow-y-auto px-2  flex flex-col gap-2">
                    {filteredServers.map((server) => (
                        <div
                            key={server.key}
                            className="flex items-center justify-between bg-zinc-800/30 border-1 border-zinc-800 rounded-2xl p-2 pl-3"
                        >
                            <div className="flex flex-col">
                                <div className="text-sm">
                                    <span>{server.name} </span>
                                    <Chip
                                        color="primary"
                                        variant="flat"
                                        size="sm"
                                        className="border-1 border-primary"
                                    >
                                        {getServerType(server.type)}
                                    </Chip>
                                </div>
                                <div>
                                    <span className="text-xs text-zinc-400">
                                        {server.servers.join(", ")}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    color="primary"
                                    variant="flat"
                                    onPress={() => handleOpenEditModal(server)}
                                >
                                    Edit
                                </Button>
                                <Button
                                    size="sm"
                                    color="danger"
                                    variant="flat"
                                    onPress={() =>
                                        handleRemoveServer(server.key)
                                    }
                                >
                                    Remove
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <ServerModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveServer}
                server={editingServer}
                mode={modalMode}
            />
        </div>
    );
};

export default Servers;
