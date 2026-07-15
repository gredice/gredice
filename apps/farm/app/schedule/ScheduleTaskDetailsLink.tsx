import { Navigate } from '@gredice/ui/icons';
import NextLink from 'next/link';
import type { ReactNode } from 'react';

interface ScheduleTaskDetailsLinkProps {
    actionLabel: string;
    children: ReactNode;
    href: string;
}

export function ScheduleTaskDetailsLink({
    actionLabel,
    children,
    href,
}: ScheduleTaskDetailsLinkProps) {
    return (
        <NextLink
            className="group block min-h-11 min-w-0 rounded-md px-1 py-1 transition-colors hover:bg-muted/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-schedule-task-details-link
            href={{ pathname: href }}
        >
            {children}
            <span className="mt-1.5 inline-flex min-h-6 items-center gap-1 text-xs font-semibold text-primary group-hover:underline">
                {actionLabel}
                <Navigate aria-hidden className="size-3.5 shrink-0" />
            </span>
        </NextLink>
    );
}
