import { Divider } from '@signalco/ui-primitives/Divider';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Fragment, type ReactNode } from 'react';

interface DailyScheduleProps {
    days?: number;
    renderDay: (options: {
        date: Date;
        isToday: boolean;
        index: number;
    }) => ReactNode;
}

export function DailySchedule({ days = 7, renderDay }: DailyScheduleProps) {
    const dates = Array.from({ length: days }, (_, index) => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + index);
        return date;
    });

    return (
        <Stack spacing={2}>
            {dates.map((date, index) => (
                <Fragment key={date.toISOString()}>
                    {renderDay({
                        date,
                        isToday: index === 0,
                        index,
                    })}
                    {index < dates.length - 1 && <Divider />}
                </Fragment>
            ))}
        </Stack>
    );
}
