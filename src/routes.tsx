import { createHashRouter } from "react-router";
import DefaultLayout from "./layouts/DefaultLayout";
import Main from "./screens/main";
import NetworkInterfaces from "./screens/NetworkInterfaces";
import Servers from "./screens/Servers";
import Setting from "./screens/Setting";

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
                path: "/servers",
                element: <Servers />,
            },
            {
                path: "/network-interfaces",
                element: <NetworkInterfaces />,
            },
            {
                path: "/settings",
                element: <Setting />,
            },
        ],
    },
]);
