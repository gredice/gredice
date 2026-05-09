import { getAssignableFarmUsersByRaisedBedFieldIds } from '@gredice/storage';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { BulkApproveRaisedBedButton } from './BulkApproveRaisedBedButton';
import { BulkAssignRaisedBedButton } from './BulkAssignRaisedBedButton';
import { RaisedBedPlantingScheduleSection } from './RaisedBedPlantingScheduleSection';
import { getScheduleDayData, getSchedulePlantSorts } from './scheduleData';
import {
    groupRaisedBedsForSchedule,
    isFieldApproved,
    isFieldCompleted,
    isFieldPendingVerification,
} from './scheduleShared';

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

    const dayFieldsToApprove = scheduledFields
        .filter(
            (field) =>
                !isFieldApproved(field.plantStatus) &&
                !isFieldPendingVerification(field.plantStatus) &&
                !isFieldCompleted(field.plantStatus) &&
                !!field.assignedUserId,
        )
        .map((field) => ({
            raisedBedId: field.raisedBedId,
            positionIndex: field.positionIndex,
            label: `${field.positionIndex + 1}`,
        }));

    const dayFieldsToAssign = scheduledFields
        .filter(
            (field) =>
                !field.assignedUserId &&
                !isFieldCompleted(field.plantStatus) &&
                !isFieldPendingVerification(field.plantStatus),
        )
        .map((field) => ({
            id: field.id,
            farmUsers: assignableFarmUsersByRaisedBedFieldId[field.id] ?? [],
        }));

    return (
        <Stack spacing={2}>
            <Row spacing={1} alignItems="center">
                <Typography level="h6">Sijanje</Typography>
                <BulkApproveRaisedBedButton
                    physicalId="dan"
                    fields={dayFieldsToApprove}
                    operations={[]}
                />
                <BulkAssignRaisedBedButton
                    physicalId="dan"
                    fields={dayFieldsToAssign}
                    operations={[]}
                />
            </Row>
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
