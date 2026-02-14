import { useState, useEffect, useMemo, KeyboardEvent } from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/modal";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { PROTOCOLS, type SERVER } from "../types";

// Generate key from name: convert to uppercase, replace spaces/special chars with underscores
const generateKeyFromName = (name: string): string => {
    return name
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
};

// Validate IP address (IPv4)
const isValidIP = (ip: string): boolean => {
    const ipRegex =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip.trim());
};

// Validate domain name
const isValidDomain = (domain: string): boolean => {
    const domainRegex =
        /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
    return domainRegex.test(domain.trim());
};

// Validate hostname (domain or IP)
const isValidHostname = (hostname: string): boolean => {
    return isValidIP(hostname) || isValidDomain(hostname);
};

// Validate port number (1-65535)
const isValidPort = (port: string): boolean => {
    const portNum = parseInt(port.trim(), 10);
    return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
};

// Validate URL (for DoH)
const isValidURL = (url: string): boolean => {
    try {
        const parsed = new URL(url.trim());
        return parsed.protocol === "https:";
    } catch {
        return false;
    }
};

// Get protocol prefix for server types
const getProtocolPrefix = (type: "dot" | "doq" | "doh3"): string => {
    switch (type) {
        case "dot":
            return "tls://";
        case "doq":
            return "quic://";
        case "doh3":
            return "h3://";
        default:
            return "";
    }
};

// Strip protocol prefix from server string
const stripProtocolPrefix = (server: string): string => {
    return server
        .replace(/^tls:\/\//, "")
        .replace(/^quic:\/\//, "")
        .replace(/^h3:\/\//, "");
};

// Validate hostname:port format (with or without protocol prefix)
const isValidHostnamePort = (hostnamePort: string): boolean => {
    const cleaned = stripProtocolPrefix(hostnamePort.trim());
    const parts = cleaned.split(":");
    if (parts.length !== 2) {
        return false;
    }
    const [hostname, port] = parts;
    return isValidHostname(hostname) && isValidPort(port);
};

// Validate servers based on type
const validateServers = (
    servers: string[],
    type: "dns" | "doh" | "dot" | "doq" | "doh3"
): { isValid: boolean; errors: string[] } => {
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

    if (
        (type === "dot" || type === "doq" || type === "doh3") &&
        servers.length > 1
    ) {
        errors.push(`${type.toUpperCase()} only accepts a single server`);
        return { isValid: false, errors };
    }

    servers.forEach((server, index) => {
        if (type === "dns") {
            if (!isValidIP(server)) {
                errors.push(`Server ${index + 1} is not a valid IP address`);
            }
        } else if (type === "doh") {
            if (!isValidURL(server)) {
                errors.push("Not a valid HTTPS URL");
            }
        } else if (type === "dot" || type === "doq" || type === "doh3") {
            // Validate with protocol prefix support
            if (!isValidHostnamePort(server)) {
                errors.push(
                    `Server ${index + 1} must be in format "${getProtocolPrefix(
                        type
                    )}hostname:port" (hostname can be domain or IP, port 1-65535)`
                );
            }
        }
    });

    return {
        isValid: errors.length === 0,
        errors,
    };
};

// Get default port for a protocol type
const getDefaultPort = (
    type: "dns" | "doh" | "dot" | "doq" | "doh3"
): string => {
    const protocol = PROTOCOLS.find((p) => p.key === type);
    return protocol?.defaultPort?.toString() ?? "";
};

interface ServerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (server: SERVER) => Promise<void>;
    server?: SERVER | null;
    mode: "add" | "edit";
    existingKeys?: string[];
}

const ServerModal = ({
    isOpen,
    onClose,
    onSave,
    server,
    mode,
    existingKeys = [],
}: ServerModalProps) => {
    const [formData, setFormData] = useState<{
        type: "dns" | "doh" | "dot" | "doq" | "doh3";
        key: string;
        name: string;
        servers: string;
        hostname: string;
        port: string;
        tags: string[];
        bootstrapIp: string;
    }>({
        type: "dns",
        key: "",
        name: "",
        servers: "",
        hostname: "",
        port: "",
        tags: [],
        bootstrapIp: "",
    });

    const [tagInput, setTagInput] = useState("");
    const [serverErrors, setServerErrors] = useState<string[]>([]);
    const [hostnameError, setHostnameError] = useState<string>("");
    const [portError, setPortError] = useState<string>("");
    const [duplicateError, setDuplicateError] = useState<string>("");
    const [bootstrapIpError, setBootstrapIpError] = useState<string>("");

    // Get protocol metadata for the current type
    const currentProtocol = useMemo(() => {
        return PROTOCOLS.find((p) => p.key === formData.type);
    }, [formData.type]);

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
                let serverValue = "";
                let hostnameValue = "";
                let portValue = "";

                if (server.type === "doh") {
                    serverValue = server.servers[0] || "";
                } else if (
                    server.type === "dot" ||
                    server.type === "doq" ||
                    server.type === "doh3"
                ) {
                    if (server.servers.length > 0) {
                        const firstServer = server.servers[0];
                        const cleaned = stripProtocolPrefix(firstServer);
                        const parts = cleaned.split(":");
                        if (parts.length === 2) {
                            hostnameValue = parts[0];
                            portValue = parts[1];
                        }
                    }
                } else {
                    serverValue = server.servers.join(", ");
                }

                setFormData({
                    type: server.type,
                    key: server.key,
                    name: server.name,
                    servers: serverValue,
                    hostname: hostnameValue,
                    port: portValue,
                    tags: [...server.tags],
                    bootstrapIp: server.bootstrap_ips?.[0] ?? "",
                });
                setTagInput("");
                setServerErrors([]);
                setHostnameError("");
                setPortError("");
                setDuplicateError("");
                setBootstrapIpError("");
            } else {
                setFormData({
                    type: "dns",
                    key: "",
                    name: "",
                    servers: "",
                    hostname: "",
                    port: "",
                    tags: [],
                    bootstrapIp: "",
                });
                setTagInput("");
                setServerErrors([]);
                setHostnameError("");
                setPortError("");
                setDuplicateError("");
                setBootstrapIpError("");
            }
        }
    }, [isOpen, mode, server]);

    // Update key when name changes in add mode
    useEffect(() => {
        if (mode === "add" && formData.name.trim()) {
            const newKey = generateKeyFromName(formData.name);
            setFormData((prev) => ({ ...prev, key: newKey }));
        }
    }, [formData.name, mode]);

    const handleServersChange = (value: string) => {
        setFormData({ ...formData, servers: value });

        const serverList =
            formData.type === "doh"
                ? value.trim()
                    ? [value.trim()]
                    : []
                : value
                      .split(",")
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0);

        if (serverList.length > 0) {
            const validation = validateServers(serverList, formData.type);
            setServerErrors(validation.errors);
        } else {
            setServerErrors([]);
        }
    };

    const handleTypeChange = (type: "dns" | "doh" | "dot" | "doq" | "doh3") => {
        setFormData({
            ...formData,
            type,
            hostname: "",
            port: getDefaultPort(type),
            servers: "",
            bootstrapIp: "",
        });
        setServerErrors([]);
        setHostnameError("");
        setPortError("");
        setBootstrapIpError("");
    };

    const runCombinedValidation = (hostname: string, port: string) => {
        if (hostname.trim() && port.trim() && isValidHostname(hostname) && isValidPort(port)) {
            const protocolPrefix = getProtocolPrefix(formData.type as "dot" | "doq" | "doh3");
            const combined = `${protocolPrefix}${hostname.trim()}:${port.trim()}`;
            const validation = validateServers([combined], formData.type);
            setServerErrors(validation.errors);
        } else {
            setServerErrors([]);
        }
    };

    const handleHostnameChange = (value: string) => {
        setFormData({ ...formData, hostname: value });
        if (value.trim()) {
            if (!isValidHostname(value)) {
                setHostnameError("Must be a valid domain name or IP address");
            } else {
                setHostnameError("");
            }
        } else {
            setHostnameError("");
        }
        runCombinedValidation(value, formData.port);
    };

    const handlePortChange = (value: string) => {
        setFormData({ ...formData, port: value });
        if (value.trim()) {
            if (!isValidPort(value)) {
                setPortError("Port must be between 1 and 65535");
            } else {
                setPortError("");
            }
        } else {
            setPortError("");
        }
        runCombinedValidation(formData.hostname, value);
    };

    // Tag handling
    const handleTagInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag();
        } else if (e.key === "Backspace" && tagInput === "" && formData.tags.length > 0) {
            setFormData((prev) => ({
                ...prev,
                tags: prev.tags.slice(0, -1),
            }));
        }
    };

    const addTag = () => {
        const tag = tagInput.replace(/,/g, "").trim();
        if (tag && !formData.tags.includes(tag)) {
            setFormData((prev) => ({
                ...prev,
                tags: [...prev.tags, tag],
            }));
        }
        setTagInput("");
    };

    const removeTag = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            tags: prev.tags.filter((_, i) => i !== index),
        }));
    };

    const handleSave = async () => {
        let serverList: string[] = [];

        if (
            formData.type === "dot" ||
            formData.type === "doq" ||
            formData.type === "doh3"
        ) {
            if (!formData.hostname.trim()) {
                setHostnameError("Hostname is required");
                return;
            }
            if (!formData.port.trim()) {
                setPortError("Port is required");
                return;
            }

            if (!isValidHostname(formData.hostname)) {
                setHostnameError("Must be a valid domain name or IP address");
                return;
            }

            if (!isValidPort(formData.port)) {
                setPortError("Port must be between 1 and 65535");
                return;
            }

            const protocolPrefix = getProtocolPrefix(formData.type);
            serverList.push(
                `${protocolPrefix}${formData.hostname.trim()}:${formData.port.trim()}`
            );
        } else if (formData.type === "doh") {
            serverList = formData.servers.trim()
                ? [formData.servers.trim()]
                : [];
        } else {
            serverList = formData.servers
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
        }

        const validation = validateServers(serverList, formData.type);
        if (!validation.isValid) {
            setServerErrors(validation.errors);
            return;
        }

        const finalKey = mode === "add" ? generatedKey : formData.key;

        // Duplicate key check
        if (mode === "add" && existingKeys.includes(finalKey)) {
            setDuplicateError(
                "A server with this name already exists. Please choose a different name."
            );
            return;
        }

        // Validate bootstrap IP if provided
        if (formData.bootstrapIp.trim() && !isValidIP(formData.bootstrapIp)) {
            setBootstrapIpError("Must be a valid IPv4 address");
            return;
        }

        const serverData: SERVER = {
            type: formData.type,
            key: finalKey.trim(),
            name: formData.name.trim(),
            servers: serverList,
            tags: formData.tags,
            ...(formData.bootstrapIp.trim()
                ? { bootstrap_ips: [formData.bootstrapIp.trim()] }
                : {}),
        };

        if (
            !serverData.key ||
            !serverData.name ||
            serverData.servers.length === 0
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
            size="md"
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
                                        | "doh"
                                        | "dot"
                                        | "doq"
                                        | "doh3";
                                    handleTypeChange(selected);
                                }}
                                size="sm"
                            >
                                <SelectItem key="dns">DNS</SelectItem>
                                <SelectItem key="doh">DoH</SelectItem>
                                <SelectItem key="dot">DoT</SelectItem>
                                <SelectItem key="doq">DoQ</SelectItem>
                                <SelectItem key="doh3">DoH3</SelectItem>
                            </Select>
                            <Input
                                radius="lg"
                                label="Name"
                                value={formData.name}
                                onValueChange={(value) => {
                                    setFormData({ ...formData, name: value });
                                    setDuplicateError("");
                                }}
                                size="sm"
                                placeholder="e.g., Google DNS"
                                isInvalid={!!duplicateError}
                                errorMessage={duplicateError}
                            />
                        </div>
                        {currentProtocol && (
                            <p className="text-xs text-zinc-500 -mt-1 px-1">
                                {currentProtocol.description}
                            </p>
                        )}
                        {formData.type === "dot" ||
                        formData.type === "doq" ||
                        formData.type === "doh3" ? (
                            <div className="flex gap-2">
                                <Input
                                    radius="lg"
                                    label="Hostname"
                                    value={formData.hostname}
                                    onValueChange={handleHostnameChange}
                                    size="sm"
                                    placeholder="dns.google or 8.8.8.8"
                                    description="Domain name or IP address"
                                    isInvalid={!!hostnameError}
                                    errorMessage={hostnameError}
                                />
                                <Input
                                    radius="lg"
                                    label="Port"
                                    value={formData.port}
                                    onValueChange={handlePortChange}
                                    size="sm"
                                    placeholder={getDefaultPort(formData.type)}
                                    description="1-65535"
                                    isInvalid={!!portError}
                                    errorMessage={portError}
                                    type="number"
                                />
                            </div>
                        ) : (
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
                        )}
                        {serverErrors.length > 0 &&
                            (formData.type === "dot" ||
                                formData.type === "doq" ||
                                formData.type === "doh3") && (
                                <p className="text-xs text-danger px-1">
                                    {serverErrors.join(", ")}
                                </p>
                            )}
                        {formData.type !== "dns" && (
                            <Input
                                radius="lg"
                                label="Server IP (optional)"
                                value={formData.bootstrapIp}
                                onValueChange={(value) => {
                                    setFormData({
                                        ...formData,
                                        bootstrapIp: value,
                                    });
                                    if (value.trim() && !isValidIP(value)) {
                                        setBootstrapIpError(
                                            "Must be a valid IPv4 address"
                                        );
                                    } else {
                                        setBootstrapIpError("");
                                    }
                                }}
                                size="sm"
                                placeholder="e.g., 1.1.1.1"
                                description="IP address to connect directly, bypassing DNS resolution"
                                isInvalid={!!bootstrapIpError}
                                errorMessage={bootstrapIpError}
                            />
                        )}
                        {/* Chip-based tags input */}
                        <div>
                            <div className="flex flex-wrap gap-1 items-center bg-zinc-800/50 rounded-xl p-2 min-h-10 border-1 border-zinc-700 focus-within:border-zinc-500 transition-colors">
                                {formData.tags.map((tag, index) => (
                                    <Chip
                                        key={`${tag}-${index}`}
                                        size="sm"
                                        variant="flat"
                                        onClose={() => removeTag(index)}
                                    >
                                        {tag}
                                    </Chip>
                                ))}
                                <input
                                    className="bg-transparent outline-none text-sm text-white flex-1 min-w-20 px-1"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleTagInputKeyDown}
                                    onBlur={addTag}
                                    placeholder={
                                        formData.tags.length === 0
                                            ? "Type a tag and press Enter..."
                                            : ""
                                    }
                                />
                            </div>
                            <p className="text-xs text-zinc-500 mt-1 px-1">
                                Press Enter or comma to add a tag
                            </p>
                        </div>
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
};

export default ServerModal;
