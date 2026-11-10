'use client';

import type { OperationAssignableFarmUser } from '@gredice/storage';
import {
    acceptOperationAction,
    assignOperationUserAction,
    cancelOperationAction,
    rescheduleOperationAction,
} from '../../(actions)/operationActions';
import { BulkApproveRaisedBedButton } from './BulkApproveRaisedBedButton';
import { BulkAssignRaisedBedButton } from './BulkAssignRaisedBedButton';
import {
    BulkCancelRaisedBedButton,
    buildOperationCancelFormData,
} from './BulkCancelRaisedBedButton';
import { BulkPhotoOperationImportModal } from './BulkPhotoOperationImportModal';
import { BulkRescheduleRaisedBedButton } from './BulkRescheduleRaisedBedButton';
import type { BulkPhotoOperationTarget } from './bulkPhotoOperationImportModel';
import {
    resolveScheduleFormVersion,
    settleScheduleActions,
} from './scheduleActionQueue';
import {
    createOperationAssignedUsers,
    isDayBulkOperationApprovalTargetVisible,
    isDayBulkOperationAssignmentTargetVisible,
    isDayBulkOperationCancelTargetVisible,
    isDayBulkOperationRescheduleTargetVisible,
    parseScheduledDateInput,
} from './scheduleOptimisticHelpers';
import { useOptimisticScheduleActions } from './useOptimisticScheduleActions';

type OperationApprovalTarget = {
    id: number;
    entityId: number;
    taskVersionEventId: number;
    label: string;
};

type OperationAssignmentTarget = {
    id: number;
    expectedEntityId: number;
    expectedTaskVersionEventId: number;
    farmUsers: OperationAssignableFarmUser[];
};

type OperationRescheduleTarget = {
    id: number;
    entityId: number;
    taskVersionEventId: number;
};

type OperationCancelTarget = {
    id: number;
    entityId: number;
    taskVersionEventId: number;
    label: string;
};

interface ScheduleDayOperationsBulkActionsProps {
    photoOperationTargets: BulkPhotoOperationTarget[];
    operationsToApprove: OperationApprovalTarget[];
    operationsToAssign: OperationAssignmentTarget[];
    operationsToReschedule: OperationRescheduleTarget[];
    operationsToCancel: OperationCancelTarget[];
}

export function ScheduleDayOperationsBulkActions({
    photoOperationTargets,
    operationsToApprove,
    operationsToAssign,
    operationsToReschedule,
    operationsToCancel,
}: ScheduleDayOperationsBulkActionsProps) {
    const { getOperationPatch, runOptimisticAction } =
        useOptimisticScheduleActions();
    const visibleOperationsToApprove = operationsToApprove.filter((operation) =>
        isDayBulkOperationApprovalTargetVisible(
            getOperationPatch(operation.id),
        ),
    );
    const visibleOperationsToAssign = operationsToAssign.filter((operation) =>
        isDayBulkOperationAssignmentTargetVisible(
            getOperationPatch(operation.id),
        ),
    );
    const visibleOperationsToReschedule = operationsToReschedule.filter(
        (operation) =>
            isDayBulkOperationRescheduleTargetVisible(
                getOperationPatch(operation.id),
            ),
    );
    const visibleOperationsToCancel = operationsToCancel.filter((operation) =>
        isDayBulkOperationCancelTargetVisible(getOperationPatch(operation.id)),
    );

    return (
        <>
            <BulkPhotoOperationImportModal targets={photoOperationTargets} />
            <BulkApproveRaisedBedButton
                physicalId="dan"
                fields={[]}
                operations={visibleOperationsToApprove}
                onConfirm={() =>
                    runOptimisticAction({
                        operationPatches: visibleOperationsToApprove.map(
                            (operation) => ({
                                id: operation.id,
                                patch: { isAccepted: true },
                            }),
                        ),
                        action: (getVersion) =>
                            settleScheduleActions(
                                visibleOperationsToApprove.map((operation) =>
                                    acceptOperationAction(
                                        operation.id,
                                        operation.entityId,
                                        getVersion(
                                            `operation:${operation.id}`,
                                            operation.taskVersionEventId,
                                        ),
                                    ),
                                ),
                            ),
                        errorLogMessage:
                            'Failed to approve all day operation items:',
                        errorAlertMessage:
                            'Skupna potvrda radnji nije uspjela. Promjena je vraćena.',
                    })
                }
            />
            <BulkAssignRaisedBedButton
                physicalId="dan"
                fields={[]}
                operations={visibleOperationsToAssign}
                onSubmit={(assignedUserIds) =>
                    runOptimisticAction({
                        operationPatches: visibleOperationsToAssign.map(
                            (operation) => {
                                const assignedUsers =
                                    createOperationAssignedUsers(
                                        assignedUserIds,
                                        operation.farmUsers,
                                        undefined,
                                    );

                                return {
                                    id: operation.id,
                                    patch: {
                                        assignedUser: assignedUsers[0] ?? null,
                                        assignedUserId:
                                            assignedUserIds[0] ?? null,
                                        assignedUserIds,
                                        assignedUsers,
                                    },
                                };
                            },
                        ),
                        action: (getVersion) =>
                            settleScheduleActions(
                                visibleOperationsToAssign.map((operation) =>
                                    assignOperationUserAction(
                                        operation.id,
                                        operation.expectedEntityId,
                                        getVersion(
                                            `operation:${operation.id}`,
                                            operation.expectedTaskVersionEventId,
                                        ),
                                        assignedUserIds,
                                    ),
                                ),
                            ),
                        errorLogMessage:
                            'Failed to assign users for all day operation items:',
                        errorAlertMessage:
                            'Skupna dodjela radnji nije uspjela. Promjena je vraćena.',
                    })
                }
            />
            <BulkRescheduleRaisedBedButton
                physicalId="dan"
                fields={[]}
                operations={visibleOperationsToReschedule}
                onSubmit={(scheduledDate) =>
                    runOptimisticAction({
                        operationPatches: visibleOperationsToReschedule.map(
                            (operation) => ({
                                id: operation.id,
                                patch: {
                                    scheduledDate:
                                        parseScheduledDateInput(scheduledDate),
                                },
                            }),
                        ),
                        action: (getVersion) =>
                            settleScheduleActions(
                                visibleOperationsToReschedule.map(
                                    (operation) => {
                                        const formData = new FormData();
                                        formData.set(
                                            'operationId',
                                            operation.id.toString(),
                                        );
                                        formData.set(
                                            'expectedEntityId',
                                            operation.entityId.toString(),
                                        );
                                        formData.set(
                                            'expectedTaskVersionEventId',
                                            operation.taskVersionEventId.toString(),
                                        );
                                        formData.set(
                                            'scheduledDate',
                                            scheduledDate,
                                        );
                                        return rescheduleOperationAction(
                                            resolveScheduleFormVersion(
                                                formData,
                                                `operation:${operation.id}`,
                                                'expectedTaskVersionEventId',
                                                getVersion,
                                            ),
                                        );
                                    },
                                ),
                            ),
                        errorLogMessage:
                            'Failed to reschedule all day operation items:',
                        errorAlertMessage:
                            'Skupno zakazivanje radnji nije uspjelo. Promjena je vraćena.',
                    })
                }
            />
            <BulkCancelRaisedBedButton
                physicalId="dan"
                fields={[]}
                operations={visibleOperationsToCancel}
                onSubmit={(formData) =>
                    runOptimisticAction({
                        operationPatches: visibleOperationsToCancel.map(
                            (operation) => ({
                                id: operation.id,
                                patch: { status: 'canceled' },
                            }),
                        ),
                        action: (getVersion) =>
                            settleScheduleActions(
                                visibleOperationsToCancel.map((operation) =>
                                    cancelOperationAction(
                                        buildOperationCancelFormData(
                                            {
                                                ...operation,
                                                taskVersionEventId: getVersion(
                                                    `operation:${operation.id}`,
                                                    operation.taskVersionEventId,
                                                ),
                                            },
                                            formData,
                                        ),
                                    ),
                                ),
                            ),
                        errorLogMessage:
                            'Failed to cancel all day operation items:',
                        errorAlertMessage:
                            'Skupno otkazivanje radnji nije uspjelo. Promjena je vraćena.',
                    })
                }
            />
        </>
    );
}
