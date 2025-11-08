import { Bluetooth } from "../components/icons/Bluetooth";
import { Ethernet } from "../components/icons/Ethernet";
import { Network } from "../components/icons/Network";
import { VirtualMachine } from "../components/icons/VirtualMachine";
import { VPN } from "../components/icons/VPN";
import { Wifi } from "../components/icons/Wifi";

export const getInterfaceIcon = (description: string) => {
    if (description.toLowerCase().includes("bluetooth")) {
        return <Bluetooth />;
    } else if (description.toLowerCase().includes("virtual")) {
        return <VirtualMachine />;
    } else if (
        description.toLowerCase().includes("wifi") ||
        description.toLowerCase().includes("wireless") ||
        description.toLowerCase().includes("wi-fi")
    ) {
        return <Wifi />;
    } else if (
        description.toLowerCase().includes("vpn") ||
        description.toLowerCase().includes("tap-windows")
    ) {
        return <VPN />;
    } else if (description.toLowerCase().includes("ethernet")) {
        return <Ethernet />;
    }
    return <Network />;
};
