import { ArrowLeft } from '@gredice/ui/icons';
import type { Route } from 'next';
import NextLink from 'next/link';

interface ScheduleTaskReturnLinkProps {
    href: Route;
}

export function ScheduleTaskReturnLink({ href }: ScheduleTaskReturnLinkProps) {
    return (
        <NextLink
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-2 text-base font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            href={href}
            replace
        >
            <ArrowLeft aria-hidden className="size-4 shrink-0" />
            Natrag na raspored
        </NextLink>
    );
}
