import { DailySchedule } from '@gredice/ui/DailySchedule';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { Suspense } from 'react';
import { auth } from '../../../lib/auth/auth';
import { ScheduleDay } from './ScheduleDay';
import { ScheduleDayDeliveriesSkeleton } from './ScheduleDayDeliveriesSkeleton';
import { ScheduleDayHeaderSkeleton } from './ScheduleDayHeaderSkeleton';
import { ScheduleDayOperationsSkeleton } from './ScheduleDayOperationsSkeleton';
import { ScheduleDayPlantingsSkeleton } from './ScheduleDayPlantingsSkeleton';

export const dynamic = 'force-dynamic';

function parseDateParam(dateParam?: string): Date | undefined {
    if (!dateParam) {
        return undefined;
    }

    const parsedDate = new Date(dateParam);
    if (Number.isNaN(parsedDate.getTime())) {
        return undefined;
    }

    parsedDate.setHours(0, 0, 0, 0);
    return parsedDate;
}

export default async function AdminSchedulePage({
    searchParams,
}: {
    searchParams?: Promise<{ date?: string }>;
}) {
    await auth(['admin']);
    const resolvedSearchParams = await searchParams;
    const startDate = parseDateParam(resolvedSearchParams?.date);

    return (
        <Stack spacing={2}>
            <Typography level="h4" component="h1">
                Rasprored
            </Typography>
            <DailySchedule
                startDate={startDate}
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
                        <ScheduleDay isToday={isToday} date={date} />
                    </Suspense>
                )}
            />
        </Stack>
    );
}
