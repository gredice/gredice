import type { SVGProps } from 'react';

export function Grid9Icon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <rect width="4" height="4" x="3" y="3" rx="0.5" />
            <rect width="4" height="4" x="10" y="3" rx="0.5" />
            <rect width="4" height="4" x="17" y="3" rx="0.5" />
            <rect width="4" height="4" x="3" y="10" rx="0.5" />
            <rect width="4" height="4" x="10" y="10" rx="0.5" />
            <rect width="4" height="4" x="17" y="10" rx="0.5" />
            <rect width="4" height="4" x="3" y="17" rx="0.5" />
            <rect width="4" height="4" x="10" y="17" rx="0.5" />
            <rect width="4" height="4" x="17" y="17" rx="0.5" />
        </svg>
    );
}
