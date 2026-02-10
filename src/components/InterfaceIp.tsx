import { Tooltip } from "@heroui/tooltip";
import { Copy } from "./icons/Copy";
import { addToast } from "@heroui/toast";

enum IpVersion {
    IPv4 = "IPv4",
    IPv6 = "IPv6",
}
const InterfaceIp = ({ ip }: { ip: string }) => {
    console.log(ip);
    const ipVersion = ip.includes(":") ? IpVersion.IPv6 : IpVersion.IPv4;

    const formattedIp =
        ipVersion === IpVersion.IPv4
            ? ip
            : ip.slice(0, ip.indexOf(":")) +
              ":...:" +
              ip.slice(ip.lastIndexOf(":") + 1);

    const handleCopy = () => {
        navigator.clipboard.writeText(ip);
        addToast({
            title: "Copied to clipboard",
            color: "success",
        });
    };
    return (
        <Tooltip
            showArrow={true}
            content={
                <div className="text-xs flex gap-1 items-center">
                    <span>{ip}</span>{" "}
                    <Copy onClick={handleCopy} className="cursor-pointer" />
                </div>
            }
        >
            <div className="w-fit bg-zinc-900/50 rounded-md p-1 px-2">
                {formattedIp}
            </div>
        </Tooltip>
    );
};

export default InterfaceIp;
