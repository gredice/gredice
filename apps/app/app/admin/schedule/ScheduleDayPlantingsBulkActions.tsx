'use client';

import type { RaisedBedFieldAssignableFarmUser } from '@gredice/storage';
import {
    acceptRaisedBedFieldAction,
    assignRaisedBedFieldUserAction,
} from '../../(actions)/raisedBedFieldsActions';
import { BulkApproveRaisedBedButton } from './BulkApproveRaisedBedButton';
import { BulkAssignRaisedBedButton } from './BulkAssignRaisedBedButton';
import {
    isDayBulkFieldApprovalTargetVisible,
    isDayBulkFieldAssignmentTargetVisible,
} from './scheduleOptimisticHelpers';
import { useOptimisticScheduleActions } from './useOptimisticScheduleActions';

type FieldApprovalTarget = {
    id: number;
    raisedBedId: number;
    positionIndex: number;
    label: string;
};

type FieldAssignmentTarget = {
    id: number;
    farmUsers: RaisedBedFieldAssignableFarmUser[];
};

interface ScheduleDayPlantingsBulkActionsProps {
    fieldsToApprove: FieldApprovalTarget[];
    fieldsToAssign: FieldAssignmentTarget[];
}

export function ScheduleDayPlantingsBulkActions({
    fieldsToApprove,
    fieldsToAssign,
}: ScheduleDayPlantingsBulkActionsProps) {
    const { getFieldPatch, runOptimisticAction } =
        useOptimisticScheduleActions();
    const visibleFieldsToApprove = fieldsToApprove.filter((field) =>
        isDayBulkFieldApprovalTargetVisible(getFieldPatch(field.id)),
    );
    const visibleFieldsToAssign = fieldsToAssign.filter((field) =>
        isDayBulkFieldAssignmentTargetVisible(getFieldPatch(field.id)),
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
                        action: () =>
                            Promise.all(
                                visibleFieldsToApprove.map((field) =>
                                    acceptRaisedBedFieldAction(
                                        field.raisedBedId,
                                        field.positionIndex,
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
                        action: () =>
                            Promise.all(
                                visibleFieldsToAssign.map((field) =>
                                    assignRaisedBedFieldUserAction(
                                        field.id,
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
        </>
    );
}
