import { getAssignableFarmUsersByRaisedBedFieldIds } from '@gredice/storage';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { RaisedBedPlantingScheduleSection } from './RaisedBedPlantingScheduleSection';
import { ScheduleDayPlantingsBulkActions } from './ScheduleDayPlantingsBulkActions';
import { getScheduleDayData, getSchedulePlantSorts } from './scheduleData';
import {
    groupRaisedBedsForSchedule,
    isFieldApproved,
    isFieldCompleted,
    isFieldPendingVerification,
} from './scheduleShared';
import { OptimisticScheduleActionsProvider } from './useOptimisticScheduleActions';

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
            id: field.id,
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
    const dayFieldsToCancel = scheduledFields
        .filter(
            (field) =>
                !isFieldCompleted(field.plantStatus) &&
                !isFieldPendingVerification(field.plantStatus),
        )
        .map((field) => ({
            id: field.id,
            raisedBedId: field.raisedBedId,
            positionIndex: field.positionIndex,
            label: `${field.positionIndex + 1}`,
        }));

    return (
        <OptimisticScheduleActionsProvider>
            <Stack spacing={4}>
                <Row spacing={2} alignItems="center" className="w-full">
                    <Typography level="h6" className="grow">
                        Sijanje
                    </Typography>
                    <Row spacing={1} className="ml-auto shrink-0">
                        <ScheduleDayPlantingsBulkActions
                            fieldsToApprove={dayFieldsToApprove}
                            fieldsToAssign={dayFieldsToAssign}
                            fieldsToCancel={dayFieldsToCancel}
                        />
                    </Row>
                </Row>
                {raisedBedGroups.map(
                    ({ key, physicalId, raisedBeds: beds }) => {
                        return (
                            <RaisedBedPlantingScheduleSection
                                key={key}
                                date={date}
                                physicalId={physicalId}
                                raisedBeds={beds}
                                scheduledFields={scheduledFields}
                                plantSorts={plantSorts}
                                assignableFarmUsersByRaisedBedFieldId={
                                    assignableFarmUsersByRaisedBedFieldId
                                }
                            />
                        );
                    },
                )}
            </Stack>
        </OptimisticScheduleActionsProvider>
    );
}
