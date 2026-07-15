import { getAssignableFarmUsersByRaisedBedFieldIds } from '@gredice/storage';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { RaisedBedPlantingScheduleSection } from './RaisedBedPlantingScheduleSection';
import { ScheduleDayPlantingsBulkActions } from './ScheduleDayPlantingsBulkActions';
import { getScheduleDayData, getSchedulePlantSorts } from './scheduleData';
import {
    activePlantCycleEventId,
    activePlantCycleVersionEventId,
    groupRaisedBedsForSchedule,
    isFieldApproved,
    isFieldBlocked,
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
    const [{ dateKey, raisedBeds, scheduledFields, timeZone }, plantSorts] =
        await Promise.all([
            getScheduleDayData(date, isToday),
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
                !isFieldBlocked(field.plantStatus) &&
                !isFieldApproved(field.plantStatus) &&
                !isFieldPendingVerification(field.plantStatus) &&
                !isFieldCompleted(field.plantStatus) &&
                !!field.assignedUserId,
        )
        .flatMap((field) => {
            const expectedPlantCycleEventId = activePlantCycleEventId(field);
            const expectedPlantCycleVersionEventId =
                activePlantCycleVersionEventId(field);
            return expectedPlantCycleEventId &&
                expectedPlantCycleVersionEventId &&
                field.plantSortId
                ? [
                      {
                          id: field.id,
                          raisedBedId: field.raisedBedId,
                          positionIndex: field.positionIndex,
                          expectedPlantCycleEventId,
                          expectedPlantCycleVersionEventId,
                          expectedPlantSortId: field.plantSortId,
                          label: `${field.positionIndex + 1}`,
                      },
                  ]
                : [];
        });

    const dayFieldsToAssign = scheduledFields
        .filter(
            (field) =>
                !field.assignedUserId &&
                !isFieldBlocked(field.plantStatus) &&
                !isFieldCompleted(field.plantStatus) &&
                !isFieldPendingVerification(field.plantStatus),
        )
        .flatMap((field) => {
            const expectedPlantCycleEventId = activePlantCycleEventId(field);
            const expectedPlantCycleVersionEventId =
                activePlantCycleVersionEventId(field);
            return expectedPlantCycleEventId &&
                expectedPlantCycleVersionEventId &&
                field.plantSortId
                ? [
                      {
                          id: field.id,
                          expectedPlantCycleEventId,
                          expectedPlantCycleVersionEventId,
                          expectedPlantSortId: field.plantSortId,
                          farmUsers:
                              assignableFarmUsersByRaisedBedFieldId[field.id] ??
                              [],
                      },
                  ]
                : [];
        });
    const dayFieldsToCancel = scheduledFields
        .filter(
            (field) =>
                !isFieldBlocked(field.plantStatus) &&
                !isFieldCompleted(field.plantStatus) &&
                !isFieldPendingVerification(field.plantStatus),
        )
        .flatMap((field) => {
            const expectedPlantCycleEventId = activePlantCycleEventId(field);
            const expectedPlantCycleVersionEventId =
                activePlantCycleVersionEventId(field);
            return expectedPlantCycleEventId &&
                expectedPlantCycleVersionEventId &&
                field.plantSortId
                ? [
                      {
                          id: field.id,
                          raisedBedId: field.raisedBedId,
                          positionIndex: field.positionIndex,
                          expectedPlantCycleEventId,
                          expectedPlantCycleVersionEventId,
                          expectedPlantSortId: field.plantSortId,
                          label: `${field.positionIndex + 1}`,
                      },
                  ]
                : [];
        });

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
                                dateKey={dateKey}
                                timeZone={timeZone}
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
