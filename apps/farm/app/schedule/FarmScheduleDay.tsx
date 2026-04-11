import { Stack } from '@signalco/ui-primitives/Stack';
import { FarmScheduleOperationsSection } from './FarmScheduleOperationsSection';
import { FarmSchedulePlantingsSection } from './FarmSchedulePlantingsSection';
import {
    getFarmScheduleDayData,
    getFarmScheduleOperationsData,
    getFarmSchedulePlantSorts,
} from './scheduleData';

interface FarmScheduleDayProps {
    date: Date;
    isToday: boolean;
    userId: string;
}

export async function FarmScheduleDay({
    date,
    isToday,
    userId,
}: FarmScheduleDayProps) {
    const [
        { raisedBeds, scheduledFields, scheduledOperations },
        plantSorts,
        operationsData,
    ] = await Promise.all([
        getFarmScheduleDayData(userId, date.toISOString(), isToday),
        getFarmSchedulePlantSorts(),
        getFarmScheduleOperationsData(),
    ]);

    return (
        <Stack spacing={4}>
            {scheduledFields.length > 0 && (
                <FarmSchedulePlantingsSection
                    raisedBeds={raisedBeds}
                    scheduledFields={scheduledFields}
                    plantSorts={plantSorts}
                />
            )}
            {scheduledOperations.length > 0 && (
                <FarmScheduleOperationsSection
                    raisedBeds={raisedBeds}
                    scheduledOperations={scheduledOperations}
                    plantSorts={plantSorts}
                    operationsData={operationsData}
                    userId={userId}
                />
            )}
            {scheduledFields.length === 0 &&
                scheduledOperations.length === 0 && (
                    <div className="px-6 pb-6 text-sm text-muted-foreground">
                        Nema zakazanih zadataka za ovaj dan.
                    </div>
                )}
        </Stack>
    );
}
