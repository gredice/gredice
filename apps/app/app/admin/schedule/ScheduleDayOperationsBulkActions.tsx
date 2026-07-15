'use client';

import type { OperationAssignableFarmUser } from '@gredice/storage';
import {
    acceptOperationAction,
    assignOperationUserAction,
    cancelOperationAction,
} from '../../(actions)/operationActions';
import { BulkApproveRaisedBedButton } from './BulkApproveRaisedBedButton';
import { BulkAssignRaisedBedButton } from './BulkAssignRaisedBedButton';
import {
    BulkCancelRaisedBedButton,
    buildOperationCancelFormData,
} from './BulkCancelRaisedBedButton';
import {
    createOperationAssignedUsers,
    isDayBulkOperationApprovalTargetVisible,
    isDayBulkOperationAssignmentTargetVisible,
    isDayBulkOperationCancelTargetVisible,
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

type OperationCancelTarget = {
    id: number;
    entityId: number;
    taskVersionEventId: number;
    label: string;
};

interface ScheduleDayOperationsBulkActionsProps {
    operationsToApprove: OperationApprovalTarget[];
    operationsToAssign: OperationAssignmentTarget[];
    operationsToCancel: OperationCancelTarget[];
}

export function ScheduleDayOperationsBulkActions({
    operationsToApprove,
    operationsToAssign,
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
    const visibleOperationsToCancel = operationsToCancel.filter((operation) =>
        isDayBulkOperationCancelTargetVisible(getOperationPatch(operation.id)),
    );

    return (
        <>
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
                        action: () =>
                            Promise.all(
                                visibleOperationsToApprove.map((operation) =>
                                    acceptOperationAction(
                                        operation.id,
                                        operation.entityId,
                                        operation.taskVersionEventId,
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
                        action: () =>
                            Promise.all(
                                visibleOperationsToAssign.map((operation) =>
                                    assignOperationUserAction(
                                        operation.id,
                                        operation.expectedEntityId,
                                        operation.expectedTaskVersionEventId,
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
                        action: () =>
                            Promise.all(
                                visibleOperationsToCancel.map((operation) =>
                                    cancelOperationAction(
                                        buildOperationCancelFormData(
                                            operation,
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
