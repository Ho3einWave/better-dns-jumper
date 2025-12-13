import { Button } from "@heroui/button";
import {
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
} from "@heroui/modal";

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?:
        | "default"
        | "primary"
        | "secondary"
        | "success"
        | "warning"
        | "danger";
}

function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    confirmColor = "danger",
}: ConfirmModalProps) {
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
                <ModalHeader>{title}</ModalHeader>
                <ModalBody>
                    <p className="text-sm text-zinc-400">{message}</p>
                </ModalBody>
                <ModalFooter>
                    <Button size="sm" variant="flat" onPress={onClose}>
                        {cancelText}
                    </Button>
                    <Button size="sm" color={confirmColor} onPress={onConfirm}>
                        {confirmText}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

export default ConfirmModal;
