/**
 * Turns whatever a failed `invoke()` rejected with into a message worth showing.
 *
 * Tauri commands reject with the serialized `AppError`, which is a plain string. React
 * Query hands that through untouched, so `error.message` is `undefined` for command
 * failures — which is why several toasts used to fall back to a generic "Something went
 * wrong" and threw away the actual cause. This normalizes every shape we can receive so
 * the real reason reaches the user.
 */
export function errorMessage(error: unknown, fallback = "Unexpected error"): string {
    if (typeof error === "string") {
        return error.trim() || fallback;
    }
    if (error instanceof Error) {
        return error.message.trim() || fallback;
    }
    if (error && typeof error === "object") {
        const message = (error as { message?: unknown }).message;
        if (typeof message === "string" && message.trim()) {
            return message.trim();
        }
        try {
            return JSON.stringify(error);
        } catch {
            return fallback;
        }
    }
    return fallback;
}
