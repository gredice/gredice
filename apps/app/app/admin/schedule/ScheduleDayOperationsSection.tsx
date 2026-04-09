import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { RaisedBedOperationsScheduleSection } from './RaisedBedOperationsScheduleSection';
import {
    getScheduleDayData,
    getScheduleOperationsData,
    getSchedulePlantSorts,
} from './scheduleData';
import { groupRaisedBedsForSchedule } from './scheduleShared';

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
    const [{ raisedBeds, scheduledOperations }, plantSorts, operationsData] =
        await Promise.all([
            getScheduleDayData(date.toISOString(), isToday),
            getSchedulePlantSorts(),
            getScheduleOperationsData(),
        ]);
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
    const raisedBedGroups = groupRaisedBedsForSchedule(
        raisedBeds,
        affectedRaisedBedIds,
    );

    return (
        <Stack spacing={2}>
            <Typography level="h6">Radnje</Typography>
            {raisedBedGroups.map(({ key, physicalId, raisedBeds: beds }) => {
                return (
                    <RaisedBedOperationsScheduleSection
                        key={key}
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
