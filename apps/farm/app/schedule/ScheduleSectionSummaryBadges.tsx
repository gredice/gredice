import { Chip } from '@gredice/ui/Chip';
import { ListTodo, Timer } from '@gredice/ui/icons';
import { formatMinutes } from './scheduleShared';

interface ScheduleSectionSummaryBadgesProps {
    count: number;
    countLabel: string;
    durationMinutes: number;
}

export function ScheduleSectionSummaryBadges({
    count,
    countLabel,
    durationMinutes,
}: ScheduleSectionSummaryBadgesProps) {
    return (
        <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
            <Chip
                size="sm"
                color="neutral"
                variant="soft"
                title="Broj zadataka"
                className="bg-muted/60 text-muted-foreground"
                startDecorator={<ListTodo aria-hidden="true" />}
            >
                {count} {countLabel}
            </Chip>
            {durationMinutes > 0 && (
                <Chip
                    size="sm"
                    color="neutral"
                    variant="soft"
                    title="Vrijeme"
                    className="bg-muted/60 text-muted-foreground"
                    startDecorator={<Timer aria-hidden="true" />}
                >
                    {formatMinutes(durationMinutes)}
                </Chip>
            )}
        </span>
    );
}
