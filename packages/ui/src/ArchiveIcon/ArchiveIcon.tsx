import type * as React from 'react';
import type { JSX } from 'react/jsx-runtime';

export function ArchiveIcon(
    props: JSX.IntrinsicAttributes & React.SVGProps<SVGSVGElement>,
) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={24}
            height={24}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            className="lucide lucide-archive-icon lucide-archive"
            viewBox="0 0 24 24"
            {...props}
        >
            <title>Arhiva</title>
            <rect width={20} height={5} x={2} y={3} rx={1} />
            <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" />
        </svg>
    );
}
