import type { SVGProps } from "react";

export function Texture(props: SVGProps<SVGSVGElement>) {
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
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 3L3 6m18 12l-3 3M11 3l-8 8m13-8L3 16M21 3L3 21M21 8L8 21m13-8l-8 8"
            ></path>
        </svg>
    );
}
