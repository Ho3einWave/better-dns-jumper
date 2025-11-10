import { Outlet } from "react-router";
import Titlebar from "../components/Titlebar";
import Navigation from "../components/Navigation";
import Updater from "../components/Updater";

const DefaultLayout = () => {
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
