import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';

export type PageSectionNavItem = {
    id: string;
    label: ReactNode;
    icon?: ReactNode;
};

/**
 * Links to the separate themes of a page, placed above the page title.
 * Hidden when there is nothing to choose between.
 */
export function PageSectionNav({
    label,
    items,
    className,
}: {
    label: string;
    items: PageSectionNavItem[];
    className?: string;
}) {
    if (items.length < 2) {
        return null;
    }

    return (
        <nav
            aria-label={label}
            className={cx(
                // On phones the row scrolls edge to edge through the page
                // gutter (Container's px-4) instead of clipping at it.
                '-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden',
                className,
            )}
        >
            {items.map((item) => (
                <a
                    key={item.id}
                    href={`#${item.id}`}
                    // A solid surface keeps the chips readable over every
                    // time-of-day sky behind the public pages.
                    className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-tertiary border-b-2 bg-card py-1.5 pr-4 pl-2.5 text-sm font-medium text-card-foreground shadow-sm transition-colors hover:border-brand/50 hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                    {item.icon}
                    <span>{item.label}</span>
                </a>
            ))}
        </nav>
    );
}
