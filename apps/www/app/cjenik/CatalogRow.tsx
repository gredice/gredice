import { Navigate } from '@gredice/ui/icons';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function CatalogRow({
    badge,
    currentValue,
    href,
    historyValue,
    subtitle,
    title,
    visual,
}: {
    badge?: ReactNode;
    currentValue: ReactNode;
    href: Route;
    historyValue?: ReactNode;
    subtitle: string;
    title: string;
    visual: ReactNode;
}) {
    return (
        <Link
            className="group grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 bg-card p-3 transition-colors hover:bg-primary/5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[minmax(0,1fr)_17rem_1.25rem]"
            href={href}
        >
            <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                    {visual}
                </span>
                <span className="min-w-0">
                    <span className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                        <span className="line-clamp-2 min-w-0 break-words font-medium group-hover:underline group-hover:underline-offset-2 md:truncate">
                            {title}
                        </span>
                        {badge}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                        {subtitle}
                    </span>
                </span>
            </span>
            <span className="min-w-0 text-right">
                <span className="block font-medium tabular-nums">
                    {currentValue}
                </span>
                {historyValue}
            </span>
            <Navigate className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground md:block" />
        </Link>
    );
}
