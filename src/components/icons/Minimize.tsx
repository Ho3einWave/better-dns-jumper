import type { SVGProps } from "react";

export function Minimize(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            viewBox="0 0 16 16"
            {...props}
        >
            <path fill="currentColor" d="M5 8h6v1H5z"></path>
        </svg>
    );
}
