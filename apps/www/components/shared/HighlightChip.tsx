import { cx } from '@gredice/ui/utils';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export type HighlightChipHref = Route | `#${string}`;

const chipClassName =
    'inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/70 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 [&>svg]:size-4 [&>svg]:shrink-0';
const linkClassName = cx(
    chipClassName,
    'transition-colors hover:bg-amber-200 dark:hover:bg-amber-900',
);

function isSamePageAnchor(href: HighlightChipHref): href is `#${string}` {
    return href.startsWith('#');
}

/** Small amber chip that surfaces one timely or standout fact above a page title. */
export function HighlightChip({
    href,
    icon,
    children,
}: {
    href?: HighlightChipHref;
    icon: ReactNode;
    children: ReactNode;
}) {
    if (!href) {
        return (
            <span className={chipClassName}>
                {icon}
                {children}
            </span>
        );
    }

    if (isSamePageAnchor(href)) {
        return (
            <a href={href} className={linkClassName}>
                {icon}
                {children}
            </a>
        );
    }

    return (
        <Link href={href} className={linkClassName}>
            {icon}
            {children}
        </Link>
    );
}
