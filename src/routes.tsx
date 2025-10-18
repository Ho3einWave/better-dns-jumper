import { createHashRouter } from "react-router";
import Main from "./screens/main";
import DefaultLayout from "./layouts/DefaultLayout";

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
                element: <h1>Network Interfaces</h1>,
            },
            {
                path: "/settings",
                element: <h1>Settings</h1>,
            },
        ],
    },
]);
