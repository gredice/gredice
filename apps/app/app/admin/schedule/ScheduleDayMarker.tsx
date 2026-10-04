import { Calendar } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';

interface ScheduleDayMarkerProps {
    date: Date;
    isToday: boolean;
}

export function ScheduleDayMarker({ date, isToday }: ScheduleDayMarkerProps) {
    const isCurrentDay = new Date().toDateString() === date.toDateString();

    return (
        <Row spacing={2} alignItems="start">
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
            </Stack>
        </Row>
    );
}
