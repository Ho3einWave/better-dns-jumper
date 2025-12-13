import { getCurrentWindow } from "@tauri-apps/api/window";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router";
import Providers from "./providers";
import { router } from "./routes";
import "./styles/main.css";

getCurrentWindow().setDecorations(false);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <Providers>
            <RouterProvider router={router} />
        </Providers>
    </React.StrictMode>,
);
