import { Outlet } from "react-router";
import Titlebar from "../components/Titlebar";
import Navigation from "../components/Navigation";
import Updater from "../components/Updater";
import { useNetworkChangeEvents } from "../hooks/useNetworkChangeEvents";

const DefaultLayout = () => {
    // Refresh network state the moment Windows reports a change, rather than on a timer.
    useNetworkChangeEvents();

    return (
        <div className="flex flex-col h-full">
            <Titlebar />
            <div className="w-full h-full pt-8 flex flex-col">
                <Outlet />
            </div>
            <Navigation />
            <Updater />
        </div>
    );
};

export default DefaultLayout;
