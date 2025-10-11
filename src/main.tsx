import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/main.css";
import { router } from "./routes";
import { RouterProvider } from "react-router";
import Providers from "./providers";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <Providers>
            <RouterProvider router={router} />
        </Providers>
    </React.StrictMode>
);
