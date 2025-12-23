import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { RaisedBedOperationsScheduleSection } from './RaisedBedOperationsScheduleSection';
import {
    getScheduleOperations,
    getScheduleOperationsData,
    getSchedulePlantSorts,
    getScheduleRaisedBeds,
} from './scheduleData';
import { getScheduledOperationsForDay } from './scheduleDayFilters';

interface ScheduleDayOperationsSectionProps {
    isToday: boolean;
    date: Date;
    userId: string;
}

export async function ScheduleDayOperationsSection({
    isToday,
    date,
    userId,
}: ScheduleDayOperationsSectionProps) {
    const [raisedBeds, operations, plantSorts, operationsData] =
        await Promise.all([
            getScheduleRaisedBeds(),
            getScheduleOperations(),
            getSchedulePlantSorts(),
            getScheduleOperationsData(),
        ]);

    const scheduledOperations = getScheduledOperationsForDay(
        isToday,
        date,
        operations,
    );
    if (scheduledOperations.length === 0) {
        return null;
    }

    const affectedRaisedBedIds = [
        ...new Set(
            scheduledOperations
                .map((operation) => operation.raisedBedId)
                .filter((id): id is number => id !== null),
        ),
    ];
    const physicalIds = [
        ...new Set(
            raisedBeds
                .filter((raisedBed) =>
                    affectedRaisedBedIds.includes(raisedBed.id),
                )
                .map((raisedBed) => raisedBed.physicalId)
                .filter(
                    (physicalId): physicalId is string => physicalId !== null,
                ),
        ),
    ].sort((a, b) => Number(a) - Number(b));

    return (
        <Stack spacing={2}>
            <Typography level="h6">Radnje</Typography>
            {physicalIds.map((physicalId) => {
                const beds = raisedBeds
                    .filter((raisedBed) => raisedBed.physicalId === physicalId)
                    .sort((a, b) => a.id - b.id);

                return (
                    <RaisedBedOperationsScheduleSection
                        key={physicalId}
                        physicalId={physicalId}
                        raisedBeds={beds}
                        scheduledOperations={scheduledOperations}
                        plantSorts={plantSorts}
                        operationsData={operationsData}
                        userId={userId}
                    />
                );
            })}
        </Stack>
    );
}
