import { createHashRouter } from "react-router";
import Main from "./screens/main";
import DefaultLayout from "./layouts/DefaultLayout";
import NetworkInterfaces from "./screens/NetworkInterfaces";
import Servers from "./screens/Servers";
import Setting from "./screens/Setting";
import DnsActivity from "./screens/DnsActivity";
import Logs from "./screens/Logs";

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
                path: "/dns-activity",
                element: <DnsActivity />,
            },
            {
                path: "/logs",
                element: <Logs />,
            },
            {
                path: "/settings",
                element: <Setting />,
            },
        ],
    },
]);
