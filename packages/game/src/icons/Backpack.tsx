import type { SVGProps } from 'react';

export function BackpackIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d="M9 6.5v-1a3 3 0 0 1 6 0v1" />
            <rect x={5} y={6.5} width={14} height={13} rx={3} />
            <path d="M9 11h6M9 15h2" />
        </svg>
    );
}
