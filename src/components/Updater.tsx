import { useEffect } from "react";
import { Button } from "@heroui/button";
import {
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
} from "@heroui/modal";
import { useUpdater } from "../hooks/useUpdater";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getReleaseUrl } from "../constants/updater";

const Updater = () => {
    const {
        isDownloading,
        isInstalling,
        isModalOpen,
        update,
        downloaded,
        contentLength,
        checkForUpdates,
        downloadAndInstallUpdate,
        closeModal,
    } = useUpdater();

    useEffect(() => {
        // Check for updates when component mounts
        checkForUpdates();
    }, [checkForUpdates]);

    const handleUpdate = async () => {
        await downloadAndInstallUpdate();
    };

    const handleViewRelease = async () => {
        if (update?.version) {
            await openUrl(getReleaseUrl(update.version));
        }
    };

    const downloadProgress =
        contentLength > 0 ? ((downloaded / contentLength) * 100).toFixed(1) : 0;

    return (
        <>
            {/* Update Modal */}
            <Modal
                isOpen={isModalOpen}
                onOpenChange={(open) => {
                    if (!open) closeModal();
                }}
                placement="center"
                backdrop="opaque"
                classNames={{
                    wrapper: "h-100vh overflow-y-hidden",
                }}
            >
                <ModalContent>
                    {() => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                Update Available
                            </ModalHeader>
                            <ModalBody>
                                {update && (
                                    <div className="space-y-3">
                                        <p className="text-sm">
                                            A new version of the app is
                                            available!
                                        </p>
                                        <div className="bg-default-100 rounded-lg p-3 space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-default-500">
                                                    Current Version:
                                                </span>
                                                <span className="font-medium">
                                                    {update.currentVersion}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-default-500">
                                                    New Version:
                                                </span>
                                                <span className="font-medium text-primary">
                                                    {update.version}
                                                </span>
                                            </div>
                                        </div>

                                        <Button
                                            size="sm"
                                            variant="flat"
                                            color="primary"
                                            onPress={handleViewRelease}
                                            className="w-full"
                                        >
                                            View Release Notes
                                        </Button>

                                        {isDownloading && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span>Downloading...</span>
                                                    <span className="font-medium">
                                                        {downloadProgress}%
                                                    </span>
                                                </div>
                                                <div className="w-full bg-default-200 rounded-full h-2">
                                                    <div
                                                        className="bg-primary h-2 rounded-full "
                                                        style={{
                                                            width: `${downloadProgress}%`,
                                                        }}
                                                    />
                                                </div>
                                                <p className="text-xs text-default-500">
                                                    {(
                                                        downloaded /
                                                        1024 /
                                                        1024
                                                    ).toFixed(2)}{" "}
                                                    MB /{" "}
                                                    {(
                                                        contentLength /
                                                        1024 /
                                                        1024
                                                    ).toFixed(2)}{" "}
                                                    MB
                                                </p>
                                            </div>
                                        )}

                                        {isInstalling && (
                                            <div className="text-center py-4">
                                                <p className="text-sm font-medium text-primary">
                                                    Installing update...
                                                </p>
                                                <p className="text-xs text-default-500 mt-2">
                                                    The app will restart
                                                    automatically
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </ModalBody>
                            <ModalFooter>
                                <Button
                                    color="danger"
                                    variant="light"
                                    onPress={closeModal}
                                    isDisabled={isDownloading || isInstalling}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    color="primary"
                                    onPress={handleUpdate}
                                    isLoading={isDownloading || isInstalling}
                                    isDisabled={isDownloading || isInstalling}
                                >
                                    {isDownloading
                                        ? "Downloading..."
                                        : isInstalling
                                        ? "Installing..."
                                        : "Update Now"}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    );
};

export default Updater;
