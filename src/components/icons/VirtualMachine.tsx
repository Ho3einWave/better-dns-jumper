import type { SVGProps } from "react";

export function VirtualMachine(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
            {...props}
        >
            <path
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                d="M1 23h13V10H1zm9-4h13V6H10zm-5-5h13V1H5z"
            ></path>
        </svg>
    );
}
