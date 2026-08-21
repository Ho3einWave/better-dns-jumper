import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Event emitted by the Rust side from `NotifyIpInterfaceChange` whenever the IP
 * interface table changes — link up/down, address change, adapter added or removed.
 */
const NETWORK_CHANGED_EVENT = "network-changed";

/** Queries whose data becomes stale the moment the network changes. */
const NETWORK_DEPENDENT_KEYS = [
    ["interfaces"],
    ["best_interface"],
    ["interface_info"],
];

/**
 * Refreshes network state as soon as Windows reports a change, instead of waiting for
 * the next poll tick.
 *
 * The queries keep a slow poll as a safety net — a missed or unregistered notification
 * would otherwise leave the UI stale indefinitely, and `NotifyIpInterfaceChange`
 * registration is explicitly allowed to fail on the Rust side.
 *
 * Mount once, near the root.
 */
export const useNetworkChangeEvents = () => {
    const queryClient = useQueryClient();

    useEffect(() => {
        // `listen` resolves to an unlisten function; the component can unmount before
        // that promise settles, so guard against a late registration leaking.
        let unlisten: (() => void) | undefined;
        let cancelled = false;

        listen(NETWORK_CHANGED_EVENT, () => {
            for (const queryKey of NETWORK_DEPENDENT_KEYS) {
                queryClient.invalidateQueries({ queryKey });
            }
        }).then((fn) => {
            if (cancelled) {
                fn();
            } else {
                unlisten = fn;
            }
        });

        return () => {
            cancelled = true;
            unlisten?.();
        };
    }, [queryClient]);
};
