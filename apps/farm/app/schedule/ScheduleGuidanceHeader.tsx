import { Typography } from '@gredice/ui/Typography';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import { HomeButton } from '../../components/HomeButton';
import { ScheduleTaskReturnLink } from './ScheduleTaskReturnLink';

interface ScheduleGuidanceHeaderProps {
    fallbackHref: string;
    fallbackTitle: string;
    scheduleReturnHref: Route | null;
    title: string;
    trailingAction?: ReactNode;
}

export function ScheduleGuidanceHeader({
    fallbackHref,
    fallbackTitle,
    scheduleReturnHref,
    title,
    trailingAction,
}: ScheduleGuidanceHeaderProps) {
    return (
        <div className="min-w-0 space-y-2" data-schedule-guidance-header>
            {scheduleReturnHref && (
                <ScheduleTaskReturnLink href={scheduleReturnHref} />
            )}
            <div className="flex min-w-0 items-start gap-2">
                {!scheduleReturnHref && (
                    <HomeButton href={fallbackHref} title={fallbackTitle} />
                )}
                <Typography
                    className="min-w-0 flex-1 [overflow-wrap:anywhere]"
                    component="h1"
                    level="h4"
                    semiBold
                >
                    {title}
                </Typography>
                {trailingAction}
            </div>
        </div>
    );
}
