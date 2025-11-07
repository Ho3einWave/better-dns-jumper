import { Minimize } from "./icons/Minimize";
import { Close } from "./icons/Close";
import { getCurrentWindow } from "@tauri-apps/api/window";

const Titlebar = () => {
    const handleMinimize = () => {
        getCurrentWindow().minimize();
    };
    const handleClose = () => {
        getCurrentWindow().close();
    };
    return (
        <div
            data-tauri-drag-region
            className="flex w-full justify-between items-center bg-zinc-900 fixed top-0 left-0"
        >
            <h1 data-tauri-drag-region className="text-white ml-2">
                <span
                    data-tauri-drag-region
                    className="font-bold text-primary-500"
                >
                    Better
                </span>{" "}
                DNS Jumper
            </h1>
            <div className="flex gap-1">
                <button
                    className="hover:bg-zinc-800 px-2 py-2 cursor-pointer text-zinc-500 hover:text-white"
                    onClick={handleMinimize}
                >
                    <Minimize />
                </button>

                <button
                    className="hover:bg-red-500 px-2 py-2 cursor-pointer text-zinc-500 hover:text-white"
                    onClick={handleClose}
                >
                    <Close />
                </button>
            </div>
        </div>
    );
};

export default Titlebar;
