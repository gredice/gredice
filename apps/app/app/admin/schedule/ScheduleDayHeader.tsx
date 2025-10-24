import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Calendar } from '@signalco/ui-icons';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { CopySummaryButton } from './CopySummaryButton';
import { formatMinutes } from './scheduleShared';

interface ScheduleDayHeaderProps {
    date: Date;
    isToday: boolean;
    approvedTasksCount: number;
    completedTasksCount: number;
    totalTasksCount: number;
    approvedDuration: number;
    completedDuration: number;
    totalDuration: number;
    summaryCopyText: string;
}

export function ScheduleDayHeader({
    date,
    isToday,
    approvedTasksCount,
    completedTasksCount,
    totalTasksCount,
    approvedDuration,
    completedDuration,
    totalDuration,
    summaryCopyText,
}: ScheduleDayHeaderProps) {
    const isCurrentDay = new Date().toDateString() === date.toDateString();

    return (
        <Stack>
            <Row spacing={2} alignItems="start" justifyContent="space-between">
                <Row spacing={1} alignItems="start">
                    <Calendar className="size-4 shrink-0 text-muted-foreground" />
                    <Stack>
                        <Typography level="body2">
                            <LocalDateTime time={false}>{date}</LocalDateTime>
                        </Typography>
                        <Typography level="body1" uppercase semiBold>
                            {isToday && isCurrentDay
                                ? 'Danas'
                                : new Intl.DateTimeFormat('hr-HR', {
                                      weekday: 'long',
                                  })
                                      .format(date)
                                      .substring(0, 3)}
                        </Typography>
                        <CopySummaryButton
                            disabled={approvedTasksCount === 0}
                            summaryText={summaryCopyText}
                        />
                    </Stack>
                </Row>
                <Stack className="border p-4 py-3 rounded-lg">
                    <Row spacing={0.5}>
                        <Typography level="body3">Zadaci:</Typography>
                        <Typography level="body1" semiBold>
                            {completedTasksCount}
                        </Typography>
                        <Typography level="body3">/</Typography>
                        <Typography level="body1" semiBold>
                            {approvedTasksCount}
                        </Typography>
                        <Typography level="body3" semiBold>
                            ({totalTasksCount})
                        </Typography>
                    </Row>
                    <Row spacing={0.5}>
                        <Typography level="body3">Vrijeme:</Typography>
                        <Typography level="body1" semiBold>
                            {formatMinutes(completedDuration, true)}
                        </Typography>
                        <Typography level="body3">/</Typography>
                        <Typography level="body1" semiBold>
                            {formatMinutes(approvedDuration)}
                        </Typography>
                        <Typography level="body3" semiBold>
                            ({formatMinutes(totalDuration)})
                        </Typography>
                    </Row>
                    <Typography level="body3">
                        (završeno/odobreno/ukupno)
                    </Typography>
                </Stack>
            </Row>
        </Stack>
    );
}
