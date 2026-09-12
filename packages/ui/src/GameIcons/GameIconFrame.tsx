/// <reference types="next/image-types/global" />

import type { StaticImageData } from 'next/image';
import type { SVGProps } from 'react';

/** Preserve the SVG icon API while bundling transparent rendered artwork. */
export function GameIconFrame({
    label,
    source,
    insetTop = 0,
    children,
    ...props
}: SVGProps<SVGSVGElement> & {
    label?: string;
    source: string | StaticImageData;
    insetTop?: number;
}) {
    // Next.js static imports carry metadata; Vite's imports are asset URLs.
    const href = typeof source === 'string' ? source : source.src;
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={24}
            height={24}
            viewBox="0 0 48 48"
            fill="none"
            role="img"
            aria-label={label}
            {...props}
        >
            {label && <title>{label}</title>}
            <image
                href={href}
                x={0}
                y={insetTop}
                width={48}
                height={48 - insetTop}
                preserveAspectRatio="xMidYMid meet"
            />
            {children}
        </svg>
    );
}
