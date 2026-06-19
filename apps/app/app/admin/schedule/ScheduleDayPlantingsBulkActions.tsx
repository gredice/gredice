'use client';

import type { RaisedBedFieldAssignableFarmUser } from '@gredice/storage';
import {
    acceptRaisedBedFieldAction,
    assignRaisedBedFieldUserAction,
    cancelRaisedBedFieldAction,
} from '../../(actions)/raisedBedFieldsActions';
import { BulkApproveRaisedBedButton } from './BulkApproveRaisedBedButton';
import { BulkAssignRaisedBedButton } from './BulkAssignRaisedBedButton';
import {
    BulkCancelRaisedBedButton,
    buildFieldCancelFormData,
} from './BulkCancelRaisedBedButton';
import {
    isDayBulkFieldApprovalTargetVisible,
    isDayBulkFieldAssignmentTargetVisible,
    isDayBulkFieldCancelTargetVisible,
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

type FieldCancelTarget = {
    id: number;
    raisedBedId: number;
    positionIndex: number;
    label: string;
};

interface ScheduleDayPlantingsBulkActionsProps {
    fieldsToApprove: FieldApprovalTarget[];
    fieldsToAssign: FieldAssignmentTarget[];
    fieldsToCancel: FieldCancelTarget[];
}

export function ScheduleDayPlantingsBulkActions({
    fieldsToApprove,
    fieldsToAssign,
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
                        action: () =>
                            Promise.all(
                                visibleFieldsToCancel.map((field) =>
                                    cancelRaisedBedFieldAction(
                                        buildFieldCancelFormData(
                                            field,
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
