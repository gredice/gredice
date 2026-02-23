import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { DailySchedule } from '@gredice/ui/DailySchedule';
import { Suspense } from 'react';
import { auth } from '../../../lib/auth/auth';
import { ScheduleDay } from './ScheduleDay';
import { ScheduleDayDeliveriesSkeleton } from './ScheduleDayDeliveriesSkeleton';
import { ScheduleDayHeaderSkeleton } from './ScheduleDayHeaderSkeleton';
import { ScheduleDayOperationsSkeleton } from './ScheduleDayOperationsSkeleton';
import { ScheduleDayPlantingsSkeleton } from './ScheduleDayPlantingsSkeleton';

export const dynamic = 'force-dynamic';

export default async function AdminSchedulePage() {
    const { userId } = await auth(['admin']);

    return (
        <Stack spacing={2}>
            <Typography level="h4" component="h1">
                Rasprored
            </Typography>
            <DailySchedule
                renderDay={({ date, isToday }) => (
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
                            isToday={isToday}
                            date={date}
                            userId={userId}
                        />
                    </Suspense>
                )}
            />
        </Stack>
    );
}
