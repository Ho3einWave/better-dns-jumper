import { useState, useEffect } from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "@heroui/modal";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import type { DnsRule } from "../types";
import { usePredefinedIps } from "../stores/tauriPredefinedIpsStore";
import { useTranslation } from "react-i18next";

const isValidIPv4 = (ip: string): boolean => {
    const ipRegex =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip.trim());
};

const isValidDomainPattern = (domain: string): boolean => {
    const trimmed = domain.trim().toLowerCase();
    if (!trimmed) return false;
    // Allow wildcard pattern like *.example.com
    if (trimmed.startsWith("*.")) {
        const rest = trimmed.slice(2);
        return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(rest);
    }
    // Exact domain
    return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(trimmed);
};

interface DnsRuleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (rule: DnsRule) => Promise<void>;
    rule?: DnsRule | null;
    mode: "add" | "edit";
}

const DnsRuleModal = ({
    isOpen,
    onClose,
    onSave,
    rule,
    mode,
}: DnsRuleModalProps) => {
    const [domain, setDomain] = useState("");
    const [response, setResponse] = useState("0.0.0.0");
    const [recordType, setRecordType] = useState("A");
    const [enabled, setEnabled] = useState(true);
    const [ruleId, setRuleId] = useState("");

    const [domainError, setDomainError] = useState("");
    const [responseError, setResponseError] = useState("");

    const { t } = useTranslation();
    const { ips: predefinedIps } = usePredefinedIps();

    useEffect(() => {
        if (isOpen) {
            if (mode === "edit" && rule) {
                setDomain(rule.domain);
                setResponse(rule.response);
                setRecordType(rule.record_type);
                setEnabled(rule.enabled);
                setRuleId(rule.id);
            } else if (mode === "add" && rule) {
                // Pre-fill from passed partial (e.g. from query log)
                setDomain(rule.domain || "");
                setResponse(rule.response || "0.0.0.0");
                setRecordType(rule.record_type || "A");
                setEnabled(true);
                setRuleId(crypto.randomUUID());
            } else {
                setDomain("");
                setResponse("0.0.0.0");
                setRecordType("A");
                setEnabled(true);
                setRuleId(crypto.randomUUID());
            }
            setDomainError("");
            setResponseError("");
        }
    }, [isOpen, mode, rule]);

    const handleDomainChange = (value: string) => {
        setDomain(value);
        if (value.trim() && !isValidDomainPattern(value)) {
            setDomainError(t("validation.domain_invalid"));
        } else {
            setDomainError("");
        }
    };

    const handleResponseChange = (value: string) => {
        setResponse(value);
        if (value.trim() && !isValidIPv4(value)) {
            setResponseError(t("validation.response_invalid"));
        } else {
            setResponseError("");
        }
    };

    const handleSave = async () => {
        if (!domain.trim()) {
            setDomainError(t("validation.domain_required"));
            return;
        }
        if (!isValidDomainPattern(domain)) {
            setDomainError(t("validation.domain_invalid"));
            return;
        }
        if (!response.trim()) {
            setResponseError(t("validation.response_required"));
            return;
        }
        if (!isValidIPv4(response)) {
            setResponseError(t("validation.response_invalid"));
            return;
        }

        await onSave({
            id: ruleId,
            domain: domain.trim().toLowerCase(),
            response: response.trim(),
            enabled,
            record_type: recordType,
        });
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
                base: "bg-zinc-900",
                header: "text-white",
                body: "text-white",
            }}
        >
            <ModalContent>
                <ModalHeader>
                    {mode === "add" ? t("tooltips.add_rule") : t("tooltips.edit")}
                </ModalHeader>
                <ModalBody>
                    <div className="flex flex-col gap-3">
                        <Input
                            radius="lg"
                            label={t("tooltips.domain")}
                            value={domain}
                            onValueChange={handleDomainChange}
                            size="sm"
                            placeholder={t("placeholders.domain_placeholder")}
                            description={t("descriptions.domain_desc")}
                            isInvalid={!!domainError}
                            errorMessage={domainError}
                        />
                        {predefinedIps.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {predefinedIps.map((p) => (
                                    <Chip
                                        key={p.ip}
                                        size="sm"
                                        variant={response === p.ip ? "solid" : "flat"}
                                        color={response === p.ip ? "primary" : "default"}
                                        className="cursor-pointer"
                                        onClick={() => {
                                            setResponse(p.ip);
                                            setResponseError("");
                                        }}
                                    >
                                        {p.label} ({p.ip})
                                    </Chip>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Input
                                radius="lg"
                                label={t("tooltips.response_ip")}
                                value={response}
                                onValueChange={handleResponseChange}
                                size="sm"
                                placeholder={t("placeholders.response_ip_placeholder")}
                                description={t("descriptions.response_ip_desc")}
                                isInvalid={!!responseError}
                                errorMessage={responseError}
                            />
                            <Select
                                label={t("tooltips.record_type")}
                                radius="lg"
                                selectedKeys={[recordType]}
                                onSelectionChange={(keys) => {
                                    const selected = Array.from(keys)[0] as string;
                                    setRecordType(selected);
                                }}
                                size="sm"
                                className="max-w-24"
                            >
                                <SelectItem key="A">A</SelectItem>
                                <SelectItem key="AAAA">AAAA</SelectItem>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                size="sm"
                                isSelected={enabled}
                                onValueChange={setEnabled}
                            />
                            <span className="text-sm">
                                {enabled ? t("other.enabled") : t("other.disabled")}
                            </span>
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

export default DnsRuleModal;
