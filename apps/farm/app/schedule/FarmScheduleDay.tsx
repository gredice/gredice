import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Calendar } from '@signalco/ui-icons';
import {
    Card,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';

interface FarmScheduleDayProps {
    date: Date;
    isToday: boolean;
}

export function FarmScheduleDay({ date, isToday }: FarmScheduleDayProps) {
    const isCurrentDay = new Date().toDateString() === date.toDateString();
    const dayLabel = isToday && isCurrentDay
        ? 'Danas'
        : new Intl.DateTimeFormat('hr-HR', {
              weekday: 'long',
          })
              .format(date)
              .substring(0, 3);

    return (
        <Card>
            <CardHeader>
                <Stack spacing={1}>
                    <div className="flex items-start gap-2">
                        <Calendar className="size-4 shrink-0 text-muted-foreground" />
                        <Stack spacing={0.5}>
                            <Typography level="body2">
                                <LocalDateTime time={false}>{date}</LocalDateTime>
                            </Typography>
                            <CardTitle>{dayLabel}</CardTitle>
                        </Stack>
                    </div>
                </Stack>
            </CardHeader>
            <CardOverflow>
                <div className="px-6 pb-6 text-sm text-muted-foreground">
                    Nema zakazanih zadataka za ovaj dan.
                </div>
            </CardOverflow>
        </Card>
    );
}
