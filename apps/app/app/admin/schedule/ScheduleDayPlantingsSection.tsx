import { getAssignableFarmUsersByRaisedBedFieldIds } from '@gredice/storage';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { RaisedBedPlantingScheduleSection } from './RaisedBedPlantingScheduleSection';
import { getScheduleDayData, getSchedulePlantSorts } from './scheduleData';
import { groupRaisedBedsForSchedule } from './scheduleShared';

interface ScheduleDayPlantingsSectionProps {
    isToday: boolean;
    date: Date;
}

export async function ScheduleDayPlantingsSection({
    isToday,
    date,
}: ScheduleDayPlantingsSectionProps) {
    const [{ raisedBeds, scheduledFields }, plantSorts] = await Promise.all([
        getScheduleDayData(date.toISOString(), isToday),
        getSchedulePlantSorts(),
    ]);
    if (scheduledFields.length === 0) {
        return null;
    }

    const affectedRaisedBedIds = [
        ...new Set(scheduledFields.map((field) => field.raisedBedId)),
    ];
    const assignableFarmUsersByRaisedBedFieldId =
        await getAssignableFarmUsersByRaisedBedFieldIds(
            scheduledFields.map((field) => field.id),
        );
    const raisedBedGroups = groupRaisedBedsForSchedule(
        raisedBeds,
        affectedRaisedBedIds,
    );

    return (
        <Stack spacing={2}>
            <Typography level="h6">Sijanje</Typography>
            {raisedBedGroups.map(({ key, physicalId, raisedBeds: beds }) => {
                return (
                    <RaisedBedPlantingScheduleSection
                        key={key}
                        physicalId={physicalId}
                        raisedBeds={beds}
                        scheduledFields={scheduledFields}
                        plantSorts={plantSorts}
                        assignableFarmUsersByRaisedBedFieldId={
                            assignableFarmUsersByRaisedBedFieldId
                        }
                    />
                );
            })}
        </Stack>
    );
}
