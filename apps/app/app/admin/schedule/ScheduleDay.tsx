import { Stack } from '@signalco/ui-primitives/Stack';
import { Suspense } from 'react';
import { ScheduleDayDeliveriesSection } from './ScheduleDayDeliveriesSection';
import { ScheduleDayDeliveriesSkeleton } from './ScheduleDayDeliveriesSkeleton';
import { ScheduleDayEmptyState } from './ScheduleDayEmptyState';
import { ScheduleDayHeaderSection } from './ScheduleDayHeaderSection';
import { ScheduleDayHeaderSkeleton } from './ScheduleDayHeaderSkeleton';
import { ScheduleDayOperationsSection } from './ScheduleDayOperationsSection';
import { ScheduleDayOperationsSkeleton } from './ScheduleDayOperationsSkeleton';
import { ScheduleDayPlantingsSection } from './ScheduleDayPlantingsSection';
import { ScheduleDayPlantingsSkeleton } from './ScheduleDayPlantingsSkeleton';

interface ScheduleDayProps {
    isToday: boolean;
    date: Date;
    userId: string;
}

export function ScheduleDay({ isToday, date, userId }: ScheduleDayProps) {
    return (
        <Stack className="grow" spacing={2}>
            <Suspense fallback={<ScheduleDayHeaderSkeleton />}>
                <ScheduleDayHeaderSection isToday={isToday} date={date} />
            </Suspense>
            <Suspense fallback={null}>
                <ScheduleDayEmptyState isToday={isToday} date={date} />
            </Suspense>
            <Suspense fallback={<ScheduleDayPlantingsSkeleton />}>
                <ScheduleDayPlantingsSection isToday={isToday} date={date} />
            </Suspense>
            <Suspense fallback={<ScheduleDayOperationsSkeleton />}>
                <ScheduleDayOperationsSection
                    isToday={isToday}
                    date={date}
                    userId={userId}
                />
            </Suspense>
            <Suspense fallback={<ScheduleDayDeliveriesSkeleton />}>
                <ScheduleDayDeliveriesSection isToday={isToday} date={date} />
            </Suspense>
        </Stack>
    );
}
