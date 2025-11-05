import { createHashRouter } from "react-router";
import Main from "./screens/main";
import DefaultLayout from "./layouts/DefaultLayout";
import NetworkInterfaces from "./screens/NetworkInterfaces";

export const router = createHashRouter([
    {
        path: "/",
        element: <DefaultLayout />,
        children: [
            {
                path: "/",
                element: <Main />,
            },
            {
                path: "/network-interfaces",
                element: <NetworkInterfaces />,
            },
            {
                path: "/settings",
                element: <h1>Settings</h1>,
            },
        ],
    },
]);
