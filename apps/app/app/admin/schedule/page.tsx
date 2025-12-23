import { Divider } from '@signalco/ui-primitives/Divider';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { Fragment, Suspense } from 'react';
import { auth } from '../../../lib/auth/auth';
import { ScheduleDay } from './ScheduleDay';
import { ScheduleDayDeliveriesSkeleton } from './ScheduleDayDeliveriesSkeleton';
import { ScheduleDayHeaderSkeleton } from './ScheduleDayHeaderSkeleton';
import { ScheduleDayOperationsSkeleton } from './ScheduleDayOperationsSkeleton';
import { ScheduleDayPlantingsSkeleton } from './ScheduleDayPlantingsSkeleton';

export const dynamic = 'force-dynamic';

export default async function AdminSchedulePage() {
    const { userId } = await auth(['admin']);
    const dates = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + i);
        return date;
    });

    return (
        <Stack spacing={2}>
            <Typography level="h4" component="h1">
                Rasprored
            </Typography>
            <Stack spacing={2}>
                {dates.map((date, dateIndex) => (
                    <Fragment key={date.toISOString()}>
                        <Suspense
                            fallback={
                                <Stack className="grow" spacing={2}>
                                    <ScheduleDayHeaderSkeleton />
                                    <ScheduleDayPlantingsSkeleton />
                                    <ScheduleDayOperationsSkeleton />
                                    <ScheduleDayDeliveriesSkeleton />
                                </Stack>
                            }
                        >
                            <ScheduleDay
                                isToday={dateIndex === 0}
                                date={date}
                                userId={userId}
                            />
                        </Suspense>
                        {dateIndex < dates.length - 1 && <Divider />}
                    </Fragment>
                ))}
            </Stack>
        </Stack>
    );
}
