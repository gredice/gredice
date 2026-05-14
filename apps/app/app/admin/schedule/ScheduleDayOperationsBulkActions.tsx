'use client';

import type { OperationAssignableFarmUser } from '@gredice/storage';
import {
    acceptOperationAction,
    assignOperationUserAction,
} from '../../(actions)/operationActions';
import { BulkApproveRaisedBedButton } from './BulkApproveRaisedBedButton';
import { BulkAssignRaisedBedButton } from './BulkAssignRaisedBedButton';
import { createOperationAssignedUsers } from './scheduleOptimisticHelpers';
import { useOptimisticScheduleActions } from './useOptimisticScheduleActions';

type OperationApprovalTarget = {
    id: number;
    label: string;
};

type OperationAssignmentTarget = {
    id: number;
    farmUsers: OperationAssignableFarmUser[];
};

interface ScheduleDayOperationsBulkActionsProps {
    operationsToApprove: OperationApprovalTarget[];
    operationsToAssign: OperationAssignmentTarget[];
}

export function ScheduleDayOperationsBulkActions({
    operationsToApprove,
    operationsToAssign,
}: ScheduleDayOperationsBulkActionsProps) {
    const { getOperationPatch, runOptimisticAction } =
        useOptimisticScheduleActions();
    const visibleOperationsToApprove = operationsToApprove.filter(
        (operation) => !getOperationPatch(operation.id)?.isAccepted,
    );
    const visibleOperationsToAssign = operationsToAssign.filter(
        (operation) => !getOperationPatch(operation.id)?.assignedUserId,
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
                                    acceptOperationAction(operation.id),
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
        </>
    );
}
