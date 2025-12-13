import { Outlet } from "react-router";
import Navigation from "../components/Navigation";
import Titlebar from "../components/Titlebar";
import Updater from "../components/Updater";

function DefaultLayout() {
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
}

export default DefaultLayout;
