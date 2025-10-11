import type { SVGProps } from "react";

export function Ethernet(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            viewBox="0 0 48 48"
            {...props}
        >
            <defs>
                <mask id="SVGtDqkQbSn">
                    <g fill="none" strokeLinecap="round" strokeWidth={4}>
                        <rect
                            width={36}
                            height={36}
                            x={6}
                            y={6}
                            fill="#fff"
                            stroke="#fff"
                            strokeLinejoin="round"
                            rx={3}
                        ></rect>
                        <path
                            fill="#000"
                            stroke="#000"
                            strokeLinejoin="round"
                            d="M19 27h10v6H19zm-5-8h20v8H14z"
                        ></path>
                        <path
                            stroke="#000"
                            d="M33 19v-4m-6 4v-4m-6 4v-4m-6 4v-4"
                        ></path>
                    </g>
                </mask>
            </defs>
            <path
                fill="currentColor"
                d="M0 0h48v48H0z"
                mask="url(#SVGtDqkQbSn)"
            ></path>
        </svg>
    );
}
