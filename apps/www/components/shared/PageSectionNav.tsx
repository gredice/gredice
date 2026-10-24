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
                'flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:gap-3 sm:overflow-visible sm:pb-0',
                className,
            )}
        >
            {items.map((item) => (
                <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                    {item.icon}
                    <span>{item.label}</span>
                </a>
            ))}
        </nav>
    );
}
