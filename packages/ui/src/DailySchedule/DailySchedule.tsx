import { Divider } from '@signalco/ui-primitives/Divider';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Fragment, type ReactNode } from 'react';

interface DailyScheduleProps {
    days?: number;
    startDate?: Date;
    renderDay: (options: {
        date: Date;
        isToday: boolean;
        index: number;
    }) => ReactNode;
}

export function DailySchedule({
    days = 7,
    startDate,
    renderDay,
}: DailyScheduleProps) {
    const normalizedStartDate = startDate ? new Date(startDate) : new Date();
    normalizedStartDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dates = Array.from({ length: days }, (_, index) => {
        const date = new Date(normalizedStartDate);
        date.setDate(date.getDate() + index);
        return date;
    });

    return (
        <Stack spacing={2}>
            {dates.map((date, index) => (
                <Fragment key={date.toISOString()}>
                    {renderDay({
                        date,
                        isToday: date.toDateString() === today.toDateString(),
                        index,
                    })}
                    {index < dates.length - 1 && <Divider />}
                </Fragment>
            ))}
        </Stack>
    );
}
