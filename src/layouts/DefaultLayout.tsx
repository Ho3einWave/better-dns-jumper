import { Outlet } from "react-router";
import Titlebar from "../components/Titlebar";

const DefaultLayout = () => {
    return (
        <div className="flex flex-col h-full">
            <Titlebar />
            <Outlet />
        </div>
    );
};

export default DefaultLayout;
