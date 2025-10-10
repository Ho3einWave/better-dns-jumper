import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/main.css";
import { router } from "./routes";
import { RouterProvider } from "react-router";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);
