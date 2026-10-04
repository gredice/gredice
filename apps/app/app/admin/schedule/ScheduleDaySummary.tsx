import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { formatMinutes } from './scheduleShared';

interface ScheduleDaySummaryProps {
    approvedTasksCount: number;
    completedTasksCount: number;
    totalTasksCount: number;
    approvedDuration: number;
    completedDuration: number;
    totalDuration: number;
    className?: string;
}

export function ScheduleDaySummary({
    approvedTasksCount,
    completedTasksCount,
    totalTasksCount,
    approvedDuration,
    completedDuration,
    totalDuration,
    className,
}: ScheduleDaySummaryProps) {
    return (
        <Row
            spacing={1}
            className={cx(
                'max-w-full flex-wrap rounded-md border px-2 py-1 text-muted-foreground sm:px-3',
                className,
            )}
            title="Sažetak: završeno / odobreno / ukupno"
        >
            <Typography level="body3" className="hidden sm:inline">
                Zadaci:
            </Typography>
            <Typography level="body2" semiBold>
                {completedTasksCount}
            </Typography>
            <Typography level="body3">/</Typography>
            <Typography level="body2" semiBold>
                {approvedTasksCount}
            </Typography>
            <Typography level="body3" semiBold>
                ({totalTasksCount})
            </Typography>
            <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" />
            <Typography level="body3" className="hidden sm:inline">
                Vrijeme:
            </Typography>
            <Typography level="body2" semiBold>
                {formatMinutes(completedDuration, true)}
            </Typography>
            <Typography level="body3">/</Typography>
            <Typography level="body2" semiBold>
                {formatMinutes(approvedDuration)}
            </Typography>
            <Typography level="body3" semiBold>
                ({formatMinutes(totalDuration)})
            </Typography>
        </Row>
    );
}
