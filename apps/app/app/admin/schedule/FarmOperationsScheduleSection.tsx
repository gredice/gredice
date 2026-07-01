'use client';

import type { OperationAssignableFarmUser } from '@gredice/storage';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { Calendar, Close, Edit } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { KnownPages } from '../../../src/KnownPages';
import {
    acceptOperationAction,
    assignOperationUserAction,
    cancelOperationAction,
    completeOperation,
    completeOperationWithImageUrls,
    rescheduleOperationAction,
    verifyOperationAction,
} from '../../(actions)/operationActions';
import { AcceptOperationModal } from './AcceptOperationModal';
import { AssignOperationModal } from './AssignOperationModal';
import { BulkApproveRaisedBedButton } from './BulkApproveRaisedBedButton';
import { BulkAssignRaisedBedButton } from './BulkAssignRaisedBedButton';
import {
    BulkCancelRaisedBedButton,
    buildOperationCancelFormData,
} from './BulkCancelRaisedBedButton';
import { BulkRescheduleRaisedBedButton } from './BulkRescheduleRaisedBedButton';
import { CancelOperationModal } from './CancelOperationModal';
import { CompleteOperationModal } from './CompleteOperationModal';
import { OperationCompletionAttachments } from './OperationCompletionAttachments';
import { OperationCompletionEvidenceEditModal } from './OperationCompletionEvidenceEditModal';
import { OperationRequirementIcons } from './OperationRequirementIcons';
import { RescheduleOperationModal } from './RescheduleOperationModal';
import { ScheduleOperationVisual } from './ScheduleTaskVisual';
import {
    createOperationAssignedUsers,
    parseScheduledDateInput,
} from './scheduleOptimisticHelpers';
import {
    formatMinutes,
    getOperationDurationMinutes,
    getScheduleTaskRowClassName,
    isOperationCancelled,
    isOperationCompleted,
    isOperationPendingVerification,
    isSameScheduleDay,
} from './scheduleShared';
import type { Operation } from './types';
import { useOptimisticScheduleActions } from './useOptimisticScheduleActions';
import { VerifyOperationModal } from './VerifyOperationModal';

type FarmSummary = {
    id: number;
    name: string;
};

interface FarmOperationsScheduleSectionProps {
    date: Date;
    farm: FarmSummary;
    scheduledOperations: Operation[];
    operationsData: EntityStandardized[] | null | undefined;
    assignableFarmUsersByOperationId: Record<
        number,
        OperationAssignableFarmUser[]
    >;
}

function getOperationLabel(
    operation: Operation,
    operationDataById: Map<number, EntityStandardized>,
) {
    const operationData = operationDataById.get(operation.entityId);
    return (
        operationData?.information?.label ??
        operationData?.information?.name ??
        operation.entityId.toString()
    );
}

export function FarmOperationsScheduleSection({
    date,
    farm,
    scheduledOperations,
    operationsData,
    assignableFarmUsersByOperationId,
}: FarmOperationsScheduleSectionProps) {
    const { getOperationPatch, runOptimisticAction } =
        useOptimisticScheduleActions();

    const operationDataById = new Map<number, EntityStandardized>();
    if (operationsData) {
        for (const operationData of operationsData) {
            operationDataById.set(operationData.id, operationData);
        }
    }

    const dayOperations = scheduledOperations
        .filter(
            (operation) =>
                operation.farmId === farm.id && operation.raisedBedId === null,
        )
        .map((operation) => ({
            ...operation,
            ...getOperationPatch(operation.id),
        }))
        .sort((left, right) =>
            getOperationLabel(left, operationDataById).localeCompare(
                getOperationLabel(right, operationDataById),
                undefined,
                { numeric: true },
            ),
        );

    if (dayOperations.length === 0) {
        return null;
    }

    const operationById = new Map(
        dayOperations.map((operation) => [operation.id, operation]),
    );
    const farmTargetLabel = `za farmu ${farm.name}`;
    const operationsToApprove = dayOperations
        .filter(
            (operation) =>
                !operation.isAccepted &&
                !isOperationCompleted(operation.status) &&
                !isOperationCancelled(operation.status) &&
                !!operation.assignedUserId,
        )
        .map((operation) => ({
            id: operation.id,
            label: getOperationLabel(operation, operationDataById),
        }));
    const operationsToReschedule = dayOperations
        .filter(
            (operation) =>
                !operation.isAccepted &&
                !isOperationCompleted(operation.status) &&
                !isOperationCancelled(operation.status),
        )
        .map((operation) => ({
            id: operation.id,
        }));
    const operationsToAssign = dayOperations
        .filter(
            (operation) =>
                !isOperationCompleted(operation.status) &&
                !isOperationPendingVerification(operation.status) &&
                !isOperationCancelled(operation.status),
        )
        .map((operation) => ({
            id: operation.id,
            farmUsers: assignableFarmUsersByOperationId[operation.id] ?? [],
        }));
    const operationsToCancel = dayOperations
        .filter(
            (operation) =>
                !isOperationCompleted(operation.status) &&
                !isOperationPendingVerification(operation.status) &&
                !isOperationCancelled(operation.status) &&
                operation.status !== 'failed',
        )
        .map((operation) => ({
            id: operation.id,
            label: getOperationLabel(operation, operationDataById),
        }));

    const totalDuration = dayOperations.reduce(
        (sum, operation) =>
            sum +
            getOperationDurationMinutes(
                operationDataById.get(operation.entityId),
            ),
        0,
    );

    return (
        <Stack spacing={2}>
            <Row spacing={2} className="w-full items-center flex-wrap gap-y-1">
                <Row
                    spacing={2}
                    className="min-w-0 grow items-center flex-wrap gap-y-1"
                >
                    <Link href={KnownPages.Farm(farm.id)}>
                        <Typography semiBold>{farm.name}</Typography>
                    </Link>
                    <Typography level="body2" className="text-muted-foreground">
                        {dayOperations.length} zadataka
                    </Typography>
                    {totalDuration > 0 && (
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Vrijeme: {formatMinutes(totalDuration)}
                        </Typography>
                    )}
                </Row>
                <Row spacing={1} className="ml-auto shrink-0 items-center">
                    <BulkApproveRaisedBedButton
                        physicalId={farm.id.toString()}
                        targetLabel={farmTargetLabel}
                        fields={[]}
                        operations={operationsToApprove}
                        onConfirm={() =>
                            runOptimisticAction({
                                operationPatches: operationsToApprove.map(
                                    (operation) => ({
                                        id: operation.id,
                                        patch: { isAccepted: true },
                                    }),
                                ),
                                action: () =>
                                    Promise.all(
                                        operationsToApprove.map((operation) =>
                                            acceptOperationAction(operation.id),
                                        ),
                                    ),
                                errorLogMessage:
                                    'Failed to approve all farm operation items:',
                                errorAlertMessage:
                                    'Skupna potvrda radnji nije uspjela. Promjena je vraćena.',
                            })
                        }
                    />
                    <BulkAssignRaisedBedButton
                        physicalId={farm.id.toString()}
                        targetLabel={farmTargetLabel}
                        fields={[]}
                        operations={operationsToAssign}
                        onSubmit={(assignedUserIds) =>
                            runOptimisticAction({
                                operationPatches: operationsToAssign.map(
                                    (operation) => {
                                        const currentOperation =
                                            operationById.get(operation.id);
                                        const assignedUsers =
                                            createOperationAssignedUsers(
                                                assignedUserIds,
                                                operation.farmUsers,
                                                currentOperation?.assignedUsers,
                                            );

                                        return {
                                            id: operation.id,
                                            patch: {
                                                assignedUser:
                                                    assignedUsers[0] ?? null,
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
                                        operationsToAssign.map((operation) =>
                                            assignOperationUserAction(
                                                operation.id,
                                                assignedUserIds,
                                            ),
                                        ),
                                    ),
                                errorLogMessage:
                                    'Failed to assign users for all farm operation items:',
                                errorAlertMessage:
                                    'Skupna dodjela radnji nije uspjela. Promjena je vraćena.',
                            })
                        }
                    />
                    <BulkRescheduleRaisedBedButton
                        physicalId={farm.id.toString()}
                        targetLabel={farmTargetLabel}
                        fields={[]}
                        operations={operationsToReschedule}
                        onSubmit={(scheduledDate) =>
                            runOptimisticAction({
                                operationPatches: operationsToReschedule.map(
                                    (operation) => ({
                                        id: operation.id,
                                        patch: {
                                            scheduledDate:
                                                parseScheduledDateInput(
                                                    scheduledDate,
                                                ),
                                        },
                                    }),
                                ),
                                action: () =>
                                    Promise.all(
                                        operationsToReschedule.map(
                                            (operation) => {
                                                const formData = new FormData();
                                                formData.set(
                                                    'operationId',
                                                    operation.id.toString(),
                                                );
                                                formData.set(
                                                    'scheduledDate',
                                                    scheduledDate,
                                                );
                                                return rescheduleOperationAction(
                                                    formData,
                                                );
                                            },
                                        ),
                                    ),
                                errorLogMessage:
                                    'Failed to reschedule all farm operation items:',
                                errorAlertMessage:
                                    'Skupno zakazivanje radnji nije uspjelo. Promjena je vraćena.',
                            })
                        }
                    />
                    <BulkCancelRaisedBedButton
                        physicalId={farm.id.toString()}
                        targetLabel={farmTargetLabel}
                        fields={[]}
                        operations={operationsToCancel}
                        onSubmit={(formData) =>
                            runOptimisticAction({
                                operationPatches: operationsToCancel.map(
                                    (operation) => ({
                                        id: operation.id,
                                        patch: { status: 'canceled' },
                                    }),
                                ),
                                action: () =>
                                    Promise.all(
                                        operationsToCancel.map((operation) =>
                                            cancelOperationAction(
                                                buildOperationCancelFormData(
                                                    operation,
                                                    formData,
                                                ),
                                            ),
                                        ),
                                    ),
                                errorLogMessage:
                                    'Failed to cancel all farm operation items:',
                                errorAlertMessage:
                                    'Skupno otkazivanje radnji nije uspjelo. Promjena je vraćena.',
                            })
                        }
                    />
                </Row>
            </Row>
            <Stack spacing={0}>
                {dayOperations.map((operation) => {
                    const operationData = operationDataById.get(
                        operation.entityId,
                    );
                    const operationLabel = getOperationLabel(
                        operation,
                        operationDataById,
                    );
                    const operationPendingVerification =
                        isOperationPendingVerification(operation.status);
                    const operationLocked =
                        isOperationCancelled(operation.status) ||
                        isOperationCompleted(operation.status) ||
                        operationPendingVerification;
                    const operationTextInactive =
                        isOperationCancelled(operation.status) ||
                        isOperationCompleted(operation.status);
                    const operationApproved =
                        operation.isAccepted && !operationLocked;
                    const operationPendingAcceptance =
                        !operation.isAccepted && !operationLocked;
                    const attachImages = Boolean(
                        operationData?.conditions?.completionAttachImages ||
                            operationData?.conditions
                                ?.completionAttachImagesRequired,
                    );
                    const attachImagesRequired = Boolean(
                        operationData?.conditions
                            ?.completionAttachImagesRequired,
                    );
                    const attachNotes = Boolean(
                        operationData?.conditions?.completionAttachNotes ||
                            operationData?.conditions
                                ?.completionAttachNotesRequired,
                    );
                    const attachNotesRequired = Boolean(
                        operationData?.conditions
                            ?.completionAttachNotesRequired,
                    );
                    const operationStatusText = isOperationCancelled(
                        operation.status,
                    )
                        ? 'Otkazano'
                        : operationPendingVerification
                          ? 'Čeka verifikaciju'
                          : isOperationCompleted(operation.status)
                            ? null
                            : operation.isAccepted
                              ? null
                              : 'Nije potvrđeno';
                    const operationStatusClassName = isOperationCancelled(
                        operation.status,
                    )
                        ? 'text-muted-foreground'
                        : operationPendingVerification
                          ? 'text-amber-600'
                          : isOperationCompleted(operation.status)
                            ? 'text-green-600'
                            : operation.isAccepted
                              ? 'text-green-600'
                              : 'text-muted-foreground';
                    const showScheduledDate =
                        !!operation.scheduledDate &&
                        !isSameScheduleDay(operation.scheduledDate, date);

                    return (
                        <Row
                            key={operation.id}
                            spacing={1}
                            className={getScheduleTaskRowClassName({
                                accepted: operationApproved,
                                pendingAcceptance: operationPendingAcceptance,
                            })}
                        >
                            <Row className="min-w-0 flex-1 flex-nowrap gap-1 md:gap-2">
                                {isOperationCompleted(operation.status) ? (
                                    <Checkbox checked disabled />
                                ) : operationPendingVerification ? (
                                    <VerifyOperationModal
                                        operationId={operation.id}
                                        label={operationLabel}
                                        onConfirm={() =>
                                            runOptimisticAction({
                                                operationPatches: [
                                                    {
                                                        id: operation.id,
                                                        patch: {
                                                            status: 'completed',
                                                        },
                                                    },
                                                ],
                                                action: () =>
                                                    verifyOperationAction(
                                                        operation.id,
                                                    ),
                                                errorLogMessage:
                                                    'Error verifying operation:',
                                                errorAlertMessage:
                                                    'Verifikacija radnje nije uspjela. Promjena je vraćena.',
                                            })
                                        }
                                    />
                                ) : operationLocked ? (
                                    <Checkbox disabled />
                                ) : operation.isAccepted ? (
                                    <CompleteOperationModal
                                        operationId={operation.id}
                                        label={operationLabel}
                                        conditions={operationData?.conditions}
                                        onConfirm={(imageUrls, notes) =>
                                            runOptimisticAction({
                                                operationPatches: [
                                                    {
                                                        id: operation.id,
                                                        patch: {
                                                            completionNotes:
                                                                notes,
                                                            imageUrls,
                                                            status: 'completed',
                                                        },
                                                    },
                                                ],
                                                action: () =>
                                                    imageUrls
                                                        ? completeOperationWithImageUrls(
                                                              operation.id,
                                                              imageUrls,
                                                              notes,
                                                          )
                                                        : completeOperation(
                                                              operation.id,
                                                              undefined,
                                                              notes,
                                                          ),
                                                errorLogMessage:
                                                    'Error completing operation:',
                                                errorAlertMessage:
                                                    'Završetak radnje nije uspio. Promjena je vraćena.',
                                            })
                                        }
                                    />
                                ) : (
                                    <AcceptOperationModal
                                        operationId={operation.id}
                                        label={operationLabel}
                                        disabled={!operation.assignedUserId}
                                        onConfirm={() =>
                                            runOptimisticAction({
                                                operationPatches: [
                                                    {
                                                        id: operation.id,
                                                        patch: {
                                                            isAccepted: true,
                                                        },
                                                    },
                                                ],
                                                action: () =>
                                                    acceptOperationAction(
                                                        operation.id,
                                                    ),
                                                errorLogMessage:
                                                    'Error accepting operation:',
                                                errorAlertMessage:
                                                    'Potvrda radnje nije uspjela. Promjena je vraćena.',
                                            })
                                        }
                                    />
                                )}
                                <ScheduleOperationVisual
                                    operation={operationData}
                                    label={operationLabel}
                                />
                                <a
                                    className="min-w-0 flex-1"
                                    href={
                                        operationData?.information?.label
                                            ? KnownPages.GrediceOperation(
                                                  operationData.information
                                                      .label,
                                              )
                                            : KnownPages.GrediceOperations
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Typography
                                        level="body1"
                                        noWrap
                                        className={
                                            operationTextInactive
                                                ? 'line-through text-muted-foreground'
                                                : ''
                                        }
                                    >
                                        {operationLabel}
                                    </Typography>
                                </a>
                                {operationStatusText && (
                                    <Typography
                                        level="body2"
                                        className={`shrink-0 italic ${operationStatusClassName}`}
                                    >
                                        {operationStatusText}
                                    </Typography>
                                )}
                                {(showScheduledDate ||
                                    !operation.scheduledDate) && (
                                    <Typography
                                        level="body2"
                                        component="div"
                                        className="shrink-0 select-none"
                                    >
                                        {showScheduledDate ? (
                                            <LocalDateTime time={false}>
                                                {operation.scheduledDate}
                                            </LocalDateTime>
                                        ) : (
                                            <Chip
                                                size="sm"
                                                color="warning"
                                                className="w-fit"
                                            >
                                                Nije planirano
                                            </Chip>
                                        )}
                                    </Typography>
                                )}
                            </Row>
                            <Row spacing={0} className="ml-auto shrink-0">
                                {!isOperationCompleted(operation.status) &&
                                    !operationPendingVerification && (
                                        <OperationRequirementIcons
                                            attachImages={attachImages}
                                            attachImagesRequired={
                                                attachImagesRequired
                                            }
                                            attachNotes={attachNotes}
                                            attachNotesRequired={
                                                attachNotesRequired
                                            }
                                        />
                                    )}
                                {(isOperationCompleted(operation.status) ||
                                    operationPendingVerification) && (
                                    <OperationCompletionAttachments
                                        operationId={operation.id}
                                        notes={operation.completionNotes}
                                        imageUrls={operation.imageUrls}
                                    />
                                )}
                                {operationPendingVerification && (
                                    <OperationCompletionEvidenceEditModal
                                        operationId={operation.id}
                                        label={operationLabel}
                                        initialNotes={
                                            operation.completionNotes ?? ''
                                        }
                                        initialImageUrls={
                                            operation.imageUrls ?? []
                                        }
                                        trigger={
                                            <IconButton
                                                title="Uredi zapis završetka"
                                                type="button"
                                                size="xs"
                                                variant="plain"
                                            >
                                                <Edit className="size-4 shrink-0" />
                                            </IconButton>
                                        }
                                    />
                                )}
                                <AssignOperationModal
                                    operationId={operation.id}
                                    label={operationLabel}
                                    farmUsers={
                                        assignableFarmUsersByOperationId[
                                            operation.id
                                        ] ?? []
                                    }
                                    assignedUsers={operation.assignedUsers}
                                    disabled={operationLocked}
                                    onSubmit={(assignedUserIds) => {
                                        const farmUsers =
                                            assignableFarmUsersByOperationId[
                                                operation.id
                                            ] ?? [];
                                        const assignedUsers =
                                            createOperationAssignedUsers(
                                                assignedUserIds,
                                                farmUsers,
                                                operation.assignedUsers,
                                            );
                                        runOptimisticAction({
                                            operationPatches: [
                                                {
                                                    id: operation.id,
                                                    patch: {
                                                        assignedUser:
                                                            assignedUsers[0] ??
                                                            null,
                                                        assignedUserId:
                                                            assignedUserIds[0] ??
                                                            null,
                                                        assignedUserIds,
                                                        assignedUsers,
                                                    },
                                                },
                                            ],
                                            action: () =>
                                                assignOperationUserAction(
                                                    operation.id,
                                                    assignedUserIds,
                                                ),
                                            errorLogMessage:
                                                'Error assigning operation user:',
                                            errorAlertMessage:
                                                'Dodjela radnje nije uspjela. Promjena je vraćena.',
                                        });
                                    }}
                                />
                                <RescheduleOperationModal
                                    operation={{
                                        id: operation.id,
                                        entityId: operation.entityId,
                                        scheduledDate: operation.scheduledDate,
                                    }}
                                    operationLabel={operationLabel}
                                    onSubmit={(formData) => {
                                        const scheduledDate =
                                            formData.get('scheduledDate');
                                        runOptimisticAction({
                                            operationPatches: [
                                                {
                                                    id: operation.id,
                                                    patch: {
                                                        scheduledDate:
                                                            typeof scheduledDate ===
                                                            'string'
                                                                ? parseScheduledDateInput(
                                                                      scheduledDate,
                                                                  )
                                                                : undefined,
                                                    },
                                                },
                                            ],
                                            action: () =>
                                                rescheduleOperationAction(
                                                    formData,
                                                ),
                                            errorLogMessage:
                                                'Error rescheduling operation:',
                                            errorAlertMessage:
                                                'Zakazivanje radnje nije uspjelo. Promjena je vraćena.',
                                        });
                                    }}
                                    trigger={
                                        <IconButton
                                            variant="plain"
                                            size="xs"
                                            title={
                                                operation.scheduledDate
                                                    ? 'Prerasporedi radnju'
                                                    : 'Zakaži radnju'
                                            }
                                            disabled={operationLocked}
                                        >
                                            <Calendar className="size-4 shrink-0" />
                                        </IconButton>
                                    }
                                />
                                <CancelOperationModal
                                    operation={{
                                        id: operation.id,
                                        entityId: operation.entityId,
                                        scheduledDate: operation.scheduledDate,
                                        status: operation.status,
                                    }}
                                    operationLabel={operationLabel}
                                    onSubmit={(formData) =>
                                        runOptimisticAction({
                                            operationPatches: [
                                                {
                                                    id: operation.id,
                                                    patch: {
                                                        status: 'canceled',
                                                    },
                                                },
                                            ],
                                            action: () =>
                                                cancelOperationAction(formData),
                                            errorLogMessage:
                                                'Error canceling operation:',
                                            errorAlertMessage:
                                                'Otkazivanje radnje nije uspjelo. Promjena je vraćena.',
                                        })
                                    }
                                    trigger={
                                        <IconButton
                                            variant="plain"
                                            size="xs"
                                            title="Otkaži operaciju"
                                            disabled={operationLocked}
                                        >
                                            <Close className="size-4 shrink-0" />
                                        </IconButton>
                                    }
                                />
                            </Row>
                        </Row>
                    );
                })}
            </Stack>
        </Stack>
    );
}
