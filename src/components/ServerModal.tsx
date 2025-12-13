import type { SERVER } from "../types";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { useEffect, useMemo, useState } from "react";

// Generate key from name: convert to uppercase, replace spaces/special chars with underscores
function generateKeyFromName(name: string): string {
    return name
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
}

// Validate IP address (IPv4)
function isValidIP(ip: string): boolean {
    const ipRegex
        = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})$/;
    return ipRegex.test(ip.trim());
}

// Validate URL (for DoH)
function isValidURL(url: string): boolean {
    try {
        const parsed = new URL(url.trim());
        return parsed.protocol === "https:";
    }
    catch {
        return false;
    }
}

// Validate servers based on type
function validateServers(servers: string[], type: "dns" | "doh"): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (servers.length === 0) {
        errors.push("At least one server is required");
        return { isValid: false, errors };
    }

    if (type === "doh" && servers.length > 1) {
        errors.push("DoH only accepts a single URL");
        return { isValid: false, errors };
    }

    if (type === "dns" && servers.length > 2) {
        errors.push("DNS servers can only have a maximum of 2 IP addresses");
        return { isValid: false, errors };
    }

    servers.forEach((server, index) => {
        if (type === "dns") {
            if (!isValidIP(server)) {
                errors.push(`Server ${index + 1} is not a valid IP address`);
            }
        }
        else if (type === "doh") {
            if (!isValidURL(server)) {
                errors.push("Not a valid HTTPS URL");
            }
        }
    });

    return {
        isValid: errors.length === 0,
        errors,
    };
}

interface ServerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (server: SERVER) => Promise<void>;
    server?: SERVER | null;
    mode: "add" | "edit";
}

function ServerModal({
    isOpen,
    onClose,
    onSave,
    server,
    mode,
}: ServerModalProps) {
    const [formData, setFormData] = useState<{
        type: "dns" | "doh";
        key: string;
        name: string;
        servers: string;
        tags: string;
    }>({
        type: "dns",
        key: "",
        name: "",
        servers: "",
        tags: "",
    });

    const [serverErrors, setServerErrors] = useState<string[]>([]);

    // Generate key from name when in add mode
    const generatedKey = useMemo(() => {
        if (mode === "add" && formData.name.trim()) {
            return generateKeyFromName(formData.name);
        }
        return formData.key;
    }, [formData.name, formData.key, mode]);

    useEffect(() => {
        if (isOpen) {
            if (mode === "edit" && server) {
                // For DoH, only show the first server (single URL)
                const serverValue
                    = server.type === "doh"
                        ? server.servers[0] || ""
                        : server.servers.join(", ");
                setFormData({
                    type: server.type,
                    key: server.key,
                    name: server.name,
                    servers: serverValue,
                    tags: server.tags.join(", "),
                });
                setServerErrors([]);
            }
            else {
                setFormData({
                    type: "dns",
                    key: "",
                    name: "",
                    servers: "",
                    tags: "",
                });
                setServerErrors([]);
            }
        }
    }, [isOpen, mode, server]);

    // Update key when name changes in add mode
    useEffect(() => {
        if (mode === "add" && formData.name.trim()) {
            const newKey = generateKeyFromName(formData.name);
            setFormData(prev => ({ ...prev, key: newKey }));
        }
    }, [formData.name, mode]);

    const handleServersChange = (value: string) => {
        setFormData({ ...formData, servers: value });

        // Validate servers in real-time
        // For DoH, treat as single value; for DNS, split by comma
        const serverList
            = formData.type === "doh"
                ? value.trim()
                    ? [value.trim()]
                    : []
                : value
                        .split(",")
                        .map(s => s.trim())
                        .filter(s => s.length > 0);

        if (serverList.length > 0) {
            const validation = validateServers(serverList, formData.type);
            setServerErrors(validation.errors);
        }
        else {
            setServerErrors([]);
        }
    };

    const handleTypeChange = (type: "dns" | "doh") => {
        setFormData({ ...formData, type });

        // Re-validate servers when type changes
        // For DoH, treat as single value; for DNS, split by comma
        const serverList
            = type === "doh"
                ? formData.servers.trim()
                    ? [formData.servers.trim()]
                    : []
                : formData.servers
                        .split(",")
                        .map(s => s.trim())
                        .filter(s => s.length > 0);

        if (serverList.length > 0) {
            const validation = validateServers(serverList, type);
            setServerErrors(validation.errors);
        }
        else {
            setServerErrors([]);
        }
    };

    const handleSave = async () => {
        // For DoH, treat as single value; for DNS, split by comma
        const serverList
            = formData.type === "doh"
                ? formData.servers.trim()
                    ? [formData.servers.trim()]
                    : []
                : formData.servers
                        .split(",")
                        .map(s => s.trim())
                        .filter(s => s.length > 0);

        // Validate before saving
        const validation = validateServers(serverList, formData.type);
        if (!validation.isValid) {
            setServerErrors(validation.errors);
            return;
        }

        const finalKey = mode === "add" ? generatedKey : formData.key;

        const serverData: SERVER = {
            type: formData.type,
            key: finalKey.trim(),
            name: formData.name.trim(),
            servers: serverList,
            tags: formData.tags
                .split(",")
                .map(t => t.trim())
                .filter(t => t.length > 0),
        };

        if (
            !serverData.key
            || !serverData.name
            || serverData.servers.length === 0
        ) {
            return;
        }

        await onSave(serverData);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="sm"
            placement="center"
            classNames={{
                wrapper: "max-h-[100vh] overflow-y-hidden",
                base: "bg-zinc-900 ",
                header: "text-white",
                body: "text-white",
            }}
        >
            <ModalContent>
                <ModalHeader>
                    {mode === "add" ? "Add Server" : "Edit Server"}
                </ModalHeader>
                <ModalBody>
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                            <Select
                                label="Type"
                                radius="lg"
                                selectedKeys={[formData.type]}
                                onSelectionChange={(keys) => {
                                    const selected = Array.from(keys)[0] as
                                        | "dns"
                                        | "doh";
                                    handleTypeChange(selected);
                                }}
                                size="sm"
                            >
                                <SelectItem key="dns">DNS</SelectItem>
                                <SelectItem key="doh">DoH</SelectItem>
                            </Select>
                            <Input
                                radius="lg"
                                label="Name"
                                value={formData.name}
                                onValueChange={value =>
                                    setFormData({ ...formData, name: value })}
                                size="sm"
                                placeholder="e.g., Google DNS"
                            />
                        </div>
                        <Input
                            radius="lg"
                            label="Servers"
                            value={formData.servers}
                            onValueChange={handleServersChange}
                            size="sm"
                            placeholder={
                                formData.type === "dns"
                                    ? "8.8.8.8, 8.8.4.4"
                                    : "https://dns.google/dns-query"
                            }
                            description={
                                formData.type === "dns"
                                    ? "Comma-separated IP addresses (max 2)"
                                    : "HTTPS URL"
                            }
                            isInvalid={serverErrors.length > 0}
                            errorMessage={serverErrors.join(", ")}
                        />
                        <Input
                            label="Tags"
                            value={formData.tags}
                            onValueChange={value =>
                                setFormData({ ...formData, tags: value })}
                            size="sm"
                            placeholder="Web, Gaming"
                            description="Comma-separated list"
                        />
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button size="sm" variant="flat" onPress={onClose}>
                        Cancel
                    </Button>
                    <Button size="sm" color="primary" onPress={handleSave}>
                        {mode === "add" ? "Add" : "Save"}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

export default ServerModal;
