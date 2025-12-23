import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { RaisedBedPlantingScheduleSection } from './RaisedBedPlantingScheduleSection';
import { getSchedulePlantSorts, getScheduleRaisedBeds } from './scheduleData';
import { getScheduledFieldsForDay } from './scheduleDayFilters';

interface ScheduleDayPlantingsSectionProps {
    isToday: boolean;
    date: Date;
}

export async function ScheduleDayPlantingsSection({
    isToday,
    date,
}: ScheduleDayPlantingsSectionProps) {
    const [raisedBeds, plantSorts] = await Promise.all([
        getScheduleRaisedBeds(),
        getSchedulePlantSorts(),
    ]);

    const scheduledFields = getScheduledFieldsForDay(isToday, date, raisedBeds);
    if (scheduledFields.length === 0) {
        return null;
    }

    const affectedRaisedBedIds = [
        ...new Set(scheduledFields.map((field) => field.raisedBedId)),
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
            <Typography level="h6">Sijanje</Typography>
            {physicalIds.map((physicalId) => {
                const beds = raisedBeds
                    .filter((raisedBed) => raisedBed.physicalId === physicalId)
                    .sort((a, b) => a.id - b.id);

                return (
                    <RaisedBedPlantingScheduleSection
                        key={physicalId}
                        physicalId={physicalId}
                        raisedBeds={beds}
                        scheduledFields={scheduledFields}
                        plantSorts={plantSorts}
                    />
                );
            })}
        </Stack>
    );
}
