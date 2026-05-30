import { DailySchedule } from '@gredice/ui/DailySchedule';
import { ScheduleDateNavigation } from '@gredice/ui/ScheduleDateNavigation';
import { Stack } from '@gredice/ui/Stack';
import { Suspense } from 'react';
import { auth } from '../../../lib/auth/auth';
import { ScheduleDay } from './ScheduleDay';
import { ScheduleDayDeliveriesSkeleton } from './ScheduleDayDeliveriesSkeleton';
import { ScheduleDayHeaderSkeleton } from './ScheduleDayHeaderSkeleton';
import { ScheduleDayOperationsSkeleton } from './ScheduleDayOperationsSkeleton';
import { ScheduleDayPlantingsSkeleton } from './ScheduleDayPlantingsSkeleton';

export const dynamic = 'force-dynamic';

function parseDateParam(dateParam?: string | string[]): Date | undefined {
    const normalizedDateParam = Array.isArray(dateParam)
        ? dateParam[0]
        : dateParam;
    if (!normalizedDateParam) {
        return undefined;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedDateParam);
    if (!match) {
        return undefined;
    }

    const year = Number.parseInt(match[1], 10);
    const monthIndex = Number.parseInt(match[2], 10) - 1;
    const day = Number.parseInt(match[3], 10);
    const parsedDate = new Date(year, monthIndex, day);

    if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.getFullYear() !== year ||
        parsedDate.getMonth() !== monthIndex ||
        parsedDate.getDate() !== day
    ) {
        return undefined;
    }

    return parsedDate;
}

export default async function AdminSchedulePage({
    searchParams,
}: {
    searchParams?: Promise<{ date?: string | string[] }>;
}) {
    await auth(['admin']);
    const resolvedSearchParams = await searchParams;
    const startDate = parseDateParam(resolvedSearchParams?.date);

    const navigationDate = startDate ?? new Date();
    navigationDate.setHours(0, 0, 0, 0);

    return (
        <Stack spacing={4}>
            <ScheduleDateNavigation
                date={navigationDate}
                basePath="/admin/schedule"
            />
            <DailySchedule
                startDate={startDate}
                renderDay={({ date, isToday }) => (
                    <Suspense
                        fallback={
                            <Stack className="grow" spacing={4}>
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
