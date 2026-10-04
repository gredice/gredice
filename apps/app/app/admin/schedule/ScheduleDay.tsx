import { Stack } from '@gredice/ui/Stack';
import { Suspense } from 'react';
import { ScheduleDayDeliveriesSection } from './ScheduleDayDeliveriesSection';
import { ScheduleDayDeliveriesSkeleton } from './ScheduleDayDeliveriesSkeleton';
import { ScheduleDayEmptyState } from './ScheduleDayEmptyState';
import { ScheduleDayMarker } from './ScheduleDayMarker';
import { ScheduleDayOperationsSection } from './ScheduleDayOperationsSection';
import { ScheduleDayOperationsSkeleton } from './ScheduleDayOperationsSkeleton';
import { ScheduleDayPlantingsSection } from './ScheduleDayPlantingsSection';
import { ScheduleDayPlantingsSkeleton } from './ScheduleDayPlantingsSkeleton';

interface ScheduleDayProps {
    isToday: boolean;
    date: Date;
}

export function ScheduleDay({ isToday, date }: ScheduleDayProps) {
    return (
        <Stack className="grow" spacing={4}>
            <ScheduleDayMarker isToday={isToday} date={date} />
            <Suspense fallback={null}>
                <ScheduleDayEmptyState isToday={isToday} date={date} />
            </Suspense>
            <Suspense fallback={<ScheduleDayPlantingsSkeleton />}>
                <ScheduleDayPlantingsSection isToday={isToday} date={date} />
            </Suspense>
            <Suspense fallback={<ScheduleDayOperationsSkeleton />}>
                <ScheduleDayOperationsSection isToday={isToday} date={date} />
            </Suspense>
            <Suspense fallback={<ScheduleDayDeliveriesSkeleton />}>
                <ScheduleDayDeliveriesSection isToday={isToday} date={date} />
            </Suspense>
        </Stack>
    );
}
