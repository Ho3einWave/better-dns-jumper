import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { AppLogEntry, LogLevel } from "../types";

type UseAppLogsOptions = {
    filter?: string;
    levels?: LogLevel[];
    /** Pauses polling while the user is reading, so the list stops jumping. */
    enabled?: boolean;
};

export const useAppLogs = ({
    filter,
    levels,
    enabled = true,
}: UseAppLogsOptions = {}) => {
    return useQuery({
        queryKey: ["app_logs", filter, levels],
        queryFn: () =>
            invoke<AppLogEntry[]>("get_app_logs", {
                filter: filter || null,
                levels: levels && levels.length > 0 ? levels : null,
                offset: null,
                limit: null,
            }),
        refetchInterval: enabled ? 2000 : false,
        // The log file is read from disk on every poll; keeping the previous page
        // visible avoids a flash of "no entries" between refreshes.
        placeholderData: (previous) => previous,
    });
};

export const useClearAppLogs = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => invoke<void>("clear_app_logs"),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["app_logs"] });
        },
    });
};

export const useLogFilePath = () => {
    return useQuery({
        queryKey: ["log_file_path"],
        queryFn: () => invoke<string>("get_log_file_path"),
        staleTime: Infinity,
    });
};

export const useOpenLogDir = () => {
    return useMutation({
        mutationFn: () => invoke<void>("open_log_dir"),
    });
};
