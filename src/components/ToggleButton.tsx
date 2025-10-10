import { cn } from "@heroui/theme";

interface ToggleButtonProps {
    isActive: boolean;
    isLoading?: boolean;
    onClick: () => void;
}

const ToggleButton = ({
    isActive,
    isLoading = false,
    onClick,
}: ToggleButtonProps) => {
    return (
        <div
            role="button"
            onClick={onClick}
            className={cn(
                "flex items-center px-2 w-24 h-12 bg-zinc-800 rounded-full group relative transition-all duration-300",
                isLoading ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                isActive && "bg-green-600 inner-shadow-green-500"
            )}
        >
            <div
                className={cn(
                    "bg-white w-10 h-10 rounded-full group-active:w-12 transition-all duration-300 absolute left-1 flex items-center justify-center",
                    isActive && "left-13 group-active:w-10"
                )}
            >
                {isLoading && (
                    <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
                )}
            </div>
        </div>
    );
};

export default ToggleButton;
