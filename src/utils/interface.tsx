import { Bluetooth } from "../components/icons/Bluetooth";
import { Ethernet } from "../components/icons/Ethernet";
import { Network } from "../components/icons/Network";
import { Virtual } from "../components/icons/Virtual";
import { VPN } from "../components/icons/VPN";
import { Wifi } from "../components/icons/Wifi";

export const getInterfaceIcon = (description: string) => {
    if (description.toLowerCase().includes("bluetooth")) {
        return <Bluetooth />;
    } else if (description.toLowerCase().includes("virtual")) {
        return <Virtual />;
    } else if (
        description.toLowerCase().includes("wifi") ||
        description.toLowerCase().includes("wireless") ||
        description.toLowerCase().includes("wi-fi")
    ) {
        return <Wifi />;
    } else if (description.toLowerCase().includes("vpn")) {
        return <VPN />;
    } else if (description.toLowerCase().includes("ethernet")) {
        return <Ethernet />;
    }
    return <Network />;
};
