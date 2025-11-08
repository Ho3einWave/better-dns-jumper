import type { SVGProps } from "react";

export function Server(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
            {...props}
        >
            <path
                fill="currentColor"
                fillRule="evenodd"
                d="M2 7c0-1.886 0-2.828.586-3.414S4.114 3 6 3h12c1.886 0 2.828 0 3.414.586S22 5.114 22 7s0 2.828-.586 3.414S19.886 11 18 11H6c-1.886 0-2.828 0-3.414-.586S2 8.886 2 7m4-.75a.75.75 0 0 0 0 1.5h2a.75.75 0 0 0 0-1.5zm4.25.75a.75.75 0 0 1 .75-.75h7a.75.75 0 0 1 0 1.5h-7a.75.75 0 0 1-.75-.75M2 17c0-1.886 0-2.828.586-3.414S4.114 13 6 13h12c1.886 0 2.828 0 3.414.586S22 15.114 22 17s0 2.828-.586 3.414S19.886 21 18 21H6c-1.886 0-2.828 0-3.414-.586S2 18.886 2 17m4-.75a.75.75 0 0 0 0 1.5h2a.75.75 0 0 0 0-1.5zm4.25.75a.75.75 0 0 1 .75-.75h7a.75.75 0 0 1 0 1.5h-7a.75.75 0 0 1-.75-.75"
                clipRule="evenodd"
            ></path>
        </svg>
    );
}
