'use client';

import type { RaisedBedFieldAssignableFarmUser } from '@gredice/storage';
import {
    acceptRaisedBedFieldAction,
    assignRaisedBedFieldUserAction,
    cancelRaisedBedFieldAction,
    rescheduleRaisedBedFieldAction,
} from '../../(actions)/raisedBedFieldsActions';
import { BulkApproveRaisedBedButton } from './BulkApproveRaisedBedButton';
import { BulkAssignRaisedBedButton } from './BulkAssignRaisedBedButton';
import {
    BulkCancelRaisedBedButton,
    buildFieldCancelFormData,
} from './BulkCancelRaisedBedButton';
import { BulkRescheduleRaisedBedButton } from './BulkRescheduleRaisedBedButton';
import {
    resolveScheduleFormVersion,
    settleScheduleActions,
} from './scheduleActionQueue';
import {
    isDayBulkFieldApprovalTargetVisible,
    isDayBulkFieldAssignmentTargetVisible,
    isDayBulkFieldCancelTargetVisible,
    isDayBulkFieldRescheduleTargetVisible,
    parseScheduledDateInput,
} from './scheduleOptimisticHelpers';
import { useOptimisticScheduleActions } from './useOptimisticScheduleActions';

type FieldApprovalTarget = {
    id: number;
    raisedBedId: number;
    positionIndex: number;
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
    label: string;
};

type FieldAssignmentTarget = {
    id: number;
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
    farmUsers: RaisedBedFieldAssignableFarmUser[];
};

type FieldRescheduleTarget = {
    id: number;
    raisedBedId: number;
    positionIndex: number;
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
};

type FieldCancelTarget = {
    id: number;
    raisedBedId: number;
    positionIndex: number;
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
    label: string;
};

interface ScheduleDayPlantingsBulkActionsProps {
    fieldsToApprove: FieldApprovalTarget[];
    fieldsToAssign: FieldAssignmentTarget[];
    fieldsToReschedule: FieldRescheduleTarget[];
    fieldsToCancel: FieldCancelTarget[];
}

export function ScheduleDayPlantingsBulkActions({
    fieldsToApprove,
    fieldsToAssign,
    fieldsToReschedule,
    fieldsToCancel,
}: ScheduleDayPlantingsBulkActionsProps) {
    const { getFieldPatch, runOptimisticAction } =
        useOptimisticScheduleActions();
    const visibleFieldsToApprove = fieldsToApprove.filter((field) =>
        isDayBulkFieldApprovalTargetVisible(getFieldPatch(field.id)),
    );
    const visibleFieldsToAssign = fieldsToAssign.filter((field) =>
        isDayBulkFieldAssignmentTargetVisible(getFieldPatch(field.id)),
    );
    const visibleFieldsToReschedule = fieldsToReschedule.filter((field) =>
        isDayBulkFieldRescheduleTargetVisible(getFieldPatch(field.id)),
    );
    const visibleFieldsToCancel = fieldsToCancel.filter((field) =>
        isDayBulkFieldCancelTargetVisible(getFieldPatch(field.id)),
    );

    return (
        <>
            <BulkApproveRaisedBedButton
                physicalId="dan"
                fields={visibleFieldsToApprove}
                operations={[]}
                onConfirm={() =>
                    runOptimisticAction({
                        fieldPatches: visibleFieldsToApprove.map((field) => ({
                            id: field.id,
                            patch: { plantStatus: 'planned' },
                        })),
                        action: (getVersion) =>
                            settleScheduleActions(
                                visibleFieldsToApprove.map((field) =>
                                    acceptRaisedBedFieldAction(
                                        field.raisedBedId,
                                        field.positionIndex,
                                        field.expectedPlantCycleEventId,
                                        field.expectedPlantSortId,
                                        getVersion(
                                            `field:${field.id}`,
                                            field.expectedPlantCycleVersionEventId,
                                        ),
                                    ),
                                ),
                            ),
                        errorLogMessage:
                            'Failed to approve all day planting items:',
                        errorAlertMessage:
                            'Skupna potvrda sijanja nije uspjela. Promjena je vraćena.',
                    })
                }
            />
            <BulkAssignRaisedBedButton
                physicalId="dan"
                fields={visibleFieldsToAssign}
                operations={[]}
                onSubmit={(assignedUserIds) =>
                    runOptimisticAction({
                        fieldPatches: visibleFieldsToAssign.map((field) => ({
                            id: field.id,
                            patch: {
                                assignedUserId: assignedUserIds[0] ?? null,
                                assignedUserIds,
                            },
                        })),
                        action: (getVersion) =>
                            settleScheduleActions(
                                visibleFieldsToAssign.map((field) =>
                                    assignRaisedBedFieldUserAction(
                                        field.id,
                                        field.expectedPlantCycleEventId,
                                        field.expectedPlantSortId,
                                        getVersion(
                                            `field:${field.id}`,
                                            field.expectedPlantCycleVersionEventId,
                                        ),
                                        assignedUserIds,
                                    ),
                                ),
                            ),
                        errorLogMessage:
                            'Failed to assign users for all day planting items:',
                        errorAlertMessage:
                            'Skupna dodjela sijanja nije uspjela. Promjena je vraćena.',
                    })
                }
            />
            <BulkRescheduleRaisedBedButton
                physicalId="dan"
                fields={visibleFieldsToReschedule}
                operations={[]}
                onSubmit={(scheduledDate) =>
                    runOptimisticAction({
                        fieldPatches: visibleFieldsToReschedule.map(
                            (field) => ({
                                id: field.id,
                                patch: {
                                    plantScheduledDate:
                                        parseScheduledDateInput(scheduledDate),
                                },
                            }),
                        ),
                        action: (getVersion) =>
                            settleScheduleActions(
                                visibleFieldsToReschedule.map((field) => {
                                    const formData = new FormData();
                                    formData.set(
                                        'raisedBedId',
                                        field.raisedBedId.toString(),
                                    );
                                    formData.set(
                                        'positionIndex',
                                        field.positionIndex.toString(),
                                    );
                                    formData.set(
                                        'expectedPlantCycleEventId',
                                        field.expectedPlantCycleEventId.toString(),
                                    );
                                    formData.set(
                                        'expectedPlantCycleVersionEventId',
                                        field.expectedPlantCycleVersionEventId.toString(),
                                    );
                                    formData.set(
                                        'expectedPlantSortId',
                                        field.expectedPlantSortId.toString(),
                                    );
                                    formData.set(
                                        'scheduledDate',
                                        scheduledDate,
                                    );
                                    return rescheduleRaisedBedFieldAction(
                                        resolveScheduleFormVersion(
                                            formData,
                                            `field:${field.id}`,
                                            'expectedPlantCycleVersionEventId',
                                            getVersion,
                                        ),
                                    );
                                }),
                            ),
                        errorLogMessage:
                            'Failed to reschedule all day planting items:',
                        errorAlertMessage:
                            'Skupno zakazivanje sijanja nije uspjelo. Promjena je vraćena.',
                    })
                }
            />
            <BulkCancelRaisedBedButton
                physicalId="dan"
                fields={visibleFieldsToCancel}
                operations={[]}
                onSubmit={(formData) =>
                    runOptimisticAction({
                        fieldPatches: visibleFieldsToCancel.map((field) => ({
                            id: field.id,
                            patch: { isDeleted: true },
                        })),
                        action: (getVersion) =>
                            settleScheduleActions(
                                visibleFieldsToCancel.map((field) =>
                                    cancelRaisedBedFieldAction(
                                        buildFieldCancelFormData(
                                            {
                                                ...field,
                                                expectedPlantCycleVersionEventId:
                                                    getVersion(
                                                        `field:${field.id}`,
                                                        field.expectedPlantCycleVersionEventId,
                                                    ),
                                            },
                                            formData,
                                        ),
                                    ),
                                ),
                            ),
                        errorLogMessage:
                            'Failed to cancel all day planting items:',
                        errorAlertMessage:
                            'Skupno otkazivanje sijanja nije uspjelo. Promjena je vraćena.',
                    })
                }
            />
        </>
    );
}
