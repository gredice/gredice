'use client';

import type { OperationAssignableFarmUser } from '@gredice/storage';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { Calendar, Close } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
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
import { BulkRescheduleRaisedBedButton } from './BulkRescheduleRaisedBedButton';
import { CancelOperationModal } from './CancelOperationModal';
import { CompleteOperationModal } from './CompleteOperationModal';
import { CopyTasksButton } from './CopyTasksButton';
import { OperationCompletionAttachments } from './OperationCompletionAttachments';
import { RescheduleOperationModal } from './RescheduleOperationModal';
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
} from './scheduleShared';
import type { Operation, RaisedBed } from './types';
import { useOptimisticScheduleActions } from './useOptimisticScheduleActions';
import { VerifyOperationModal } from './VerifyOperationModal';

interface RaisedBedOperationsScheduleSectionProps {
    physicalId: string;
    raisedBeds: RaisedBed[];
    scheduledOperations: Operation[];
    plantSorts: EntityStandardized[] | null | undefined;
    operationsData: EntityStandardized[] | null | undefined;
    assignableFarmUsersByOperationId: Record<
        number,
        OperationAssignableFarmUser[]
    >;
}

export function RaisedBedOperationsScheduleSection({
    physicalId,
    raisedBeds,
    scheduledOperations,
    plantSorts,
    operationsData,
    assignableFarmUsersByOperationId,
}: RaisedBedOperationsScheduleSectionProps) {
    const { getOperationPatch, runOptimisticAction } =
        useOptimisticScheduleActions();

    if (raisedBeds.length === 0) {
        return null;
    }

    const sortedRaisedBeds = [...raisedBeds].sort((a, b) => a.id - b.id);
    const firstRaisedBed = sortedRaisedBeds.at(0);
    const raisedBedDetailsLink = firstRaisedBed
        ? KnownPages.RaisedBed(firstRaisedBed.id)
        : null;

    const operationDataById = new Map<number, EntityStandardized>();
    if (operationsData) {
        for (const operationData of operationsData) {
            operationDataById.set(operationData.id, operationData);
        }
    }

    const dayOperations = scheduledOperations
        .filter(
            (operation) =>
                operation.raisedBedId !== null &&
                sortedRaisedBeds.some(
                    (raisedBed) => raisedBed.id === operation.raisedBedId,
                ),
        )
        .map((operation) => {
            const field = operation.raisedBedFieldId
                ? sortedRaisedBeds
                      .flatMap((raisedBed) => raisedBed.fields)
                      .find(
                          (raisedBedField) =>
                              raisedBedField.id === operation.raisedBedFieldId,
                      )
                : undefined;
            const sort = field?.plantSortId
                ? plantSorts?.find(
                      (plantSort) => plantSort.id === field.plantSortId,
                  )
                : null;

            const physicalPositionIndex = field
                ? (field.positionIndex + 1).toString()
                : '';

            return {
                ...operation,
                ...getOperationPatch(operation.id),
                physicalPositionIndex,
                sort,
            };
        })
        .sort((a, b) =>
            a.physicalPositionIndex.localeCompare(
                b.physicalPositionIndex,
                undefined,
                { numeric: true },
            ),
        );

    const operationById = new Map(
        dayOperations.map((operation) => [operation.id, operation]),
    );

    const copyTasks = dayOperations.map((operation) => {
        const operationData = operationDataById.get(operation.entityId);
        const isFullRaisedBed =
            operationData?.attributes?.application === 'raisedBedFull';
        const text = `${isFullRaisedBed || !operation.physicalPositionIndex ? '' : `${operation.physicalPositionIndex} - `}${operationData?.information?.label ?? operation.entityId}${operation.sort ? `: ${operation.sort.information?.name ?? 'Nepoznato'}` : ''}`;

        return {
            id: `operation-${operation.id}`,
            text,
            link: operationData?.information?.label
                ? KnownPages.GrediceOperation(operationData?.information?.label)
                : KnownPages.GrediceOperations,
            approved:
                operation.isAccepted &&
                !isOperationCompleted(operation.status) &&
                !isOperationPendingVerification(operation.status) &&
                !isOperationCancelled(operation.status),
        };
    });

    const operationsToApprove = dayOperations
        .filter(
            (operation) =>
                !operation.isAccepted &&
                !isOperationCompleted(operation.status) &&
                !isOperationCancelled(operation.status) &&
                !!operation.assignedUserId,
        )
        .map((operation) => {
            const operationData = operationDataById.get(operation.entityId);
            const isFullRaisedBed =
                operationData?.attributes?.application === 'raisedBedFull';
            const label = `${isFullRaisedBed || !operation.physicalPositionIndex ? '' : `${operation.physicalPositionIndex} - `}${operationData?.information?.label ?? operation.entityId}${operation.sort ? `: ${operation.sort.information?.name ?? 'Nepoznato'}` : ''}`;

            return {
                id: operation.id,
                label,
            };
        });
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

    const durations = dayOperations.reduce(
        (acc, operation) => {
            const duration = getOperationDurationMinutes(
                operationDataById.get(operation.entityId),
            );
            acc.total += duration;
            if (isOperationCompleted(operation.status)) {
                acc.completed += duration;
            }
            if (
                operation.isAccepted &&
                !isOperationCompleted(operation.status) &&
                !isOperationPendingVerification(operation.status) &&
                !isOperationCancelled(operation.status)
            ) {
                acc.approved += duration;
            }
            return acc;
        },
        { total: 0, approved: 0, completed: 0 },
    );

    return (
        <Stack key={physicalId} spacing={2}>
            <Row spacing={2} className="w-full items-center flex-wrap gap-y-1">
                <BulkApproveRaisedBedButton
                    physicalId={physicalId.toString()}
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
                                'Failed to approve all raised bed operation items:',
                            errorAlertMessage:
                                'Skupna potvrda radnji nije uspjela. Promjena je vraćena.',
                        })
                    }
                />
                <Row
                    spacing={1}
                    className="min-w-0 grow items-center flex-wrap gap-y-1"
                >
                    {raisedBedDetailsLink ? (
                        <Link href={raisedBedDetailsLink}>
                            <RaisedBedLabel physicalId={physicalId} />
                        </Link>
                    ) : (
                        <RaisedBedLabel physicalId={physicalId} />
                    )}
                    <Typography level="body2" className="text-muted-foreground">
                        Vrijeme: {formatMinutes(durations.completed, true)} /{' '}
                        {formatMinutes(durations.approved)} (
                        {formatMinutes(durations.total)})
                    </Typography>
                    <CopyTasksButton
                        physicalId={physicalId.toString()}
                        tasks={copyTasks}
                    />
                </Row>
                <Row spacing={1} className="ml-auto shrink-0 items-center">
                    <BulkAssignRaisedBedButton
                        physicalId={physicalId.toString()}
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
                                    'Failed to assign users for all raised bed operation items:',
                                errorAlertMessage:
                                    'Skupna dodjela radnji nije uspjela. Promjena je vraćena.',
                            })
                        }
                    />
                    <BulkRescheduleRaisedBedButton
                        physicalId={physicalId.toString()}
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
                                    'Failed to reschedule all raised bed operation items:',
                                errorAlertMessage:
                                    'Skupno zakazivanje radnji nije uspjelo. Promjena je vraćena.',
                            })
                        }
                    />
                </Row>
            </Row>
            <Stack spacing={2}>
                {!dayOperations.length && (
                    <Typography level="body2">
                        Trenutno nema radnji za ovu gredicu.
                    </Typography>
                )}
                {dayOperations.map((operation) => {
                    const operationData = operationDataById.get(
                        operation.entityId,
                    );
                    const isFullRaisedBed =
                        operationData?.attributes?.application ===
                        'raisedBedFull';
                    const operationLabel = `${isFullRaisedBed || !operation.physicalPositionIndex ? '' : `${operation.physicalPositionIndex} - `}${operationData?.information?.label ?? operation.entityId}${operation.sort ? `: ${operation.sort.information?.name ?? 'Nepoznato'}` : ''}`;

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
                        operation.isAccepted &&
                        !operationLocked &&
                        !operationTextInactive;
                    const operationPendingAcceptance =
                        !operation.isAccepted && !operationLocked;

                    const operationStatusText = isOperationCancelled(
                        operation.status,
                    )
                        ? 'Otkazano'
                        : operationPendingVerification
                          ? 'Čeka verifikaciju'
                          : isOperationCompleted(operation.status)
                            ? 'Završeno'
                            : operation.isAccepted
                              ? 'Potvrđeno'
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
                    const attachImages = Boolean(
                        operationData?.conditions?.completionAttachImages ||
                            operationData?.conditions
                                ?.completionAttachImagesRequired,
                    );
                    const attachRequired = Boolean(
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
                    const completionRequirementTexts = [
                        attachImages
                            ? attachRequired
                                ? 'Slike obavezne'
                                : 'Slike opcionalne'
                            : null,
                        attachNotes
                            ? attachNotesRequired
                                ? 'Napomena obavezna'
                                : 'Napomena opcionalna'
                            : null,
                    ].filter((text): text is string => Boolean(text));

                    return (
                        <div key={operation.id}>
                            <Row
                                spacing={2}
                                className={getScheduleTaskRowClassName({
                                    accepted: operationApproved,
                                    pendingAcceptance:
                                        operationPendingAcceptance,
                                })}
                            >
                                <Row spacing={2} className="grow">
                                    {isOperationCompleted(operation.status) ? (
                                        <Checkbox
                                            className="size-5 mx-2"
                                            checked
                                            disabled
                                        />
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
                                        <Checkbox
                                            className="size-5 mx-2"
                                            disabled
                                        />
                                    ) : operation.isAccepted ? (
                                        <CompleteOperationModal
                                            operationId={operation.id}
                                            label={operationLabel}
                                            conditions={
                                                operationData?.conditions
                                            }
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
                                    <a
                                        href={
                                            operationData?.information?.label
                                                ? KnownPages.GrediceOperation(
                                                      operationData?.information
                                                          ?.label,
                                                  )
                                                : KnownPages.GrediceOperations
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Typography
                                            className={
                                                operationTextInactive
                                                    ? 'line-through text-muted-foreground'
                                                    : undefined
                                            }
                                        >
                                            {operationLabel}
                                        </Typography>
                                    </a>
                                    <Typography
                                        level="body2"
                                        className={`ml-1 italic ${operationStatusClassName}`}
                                    >
                                        {operationStatusText}
                                    </Typography>
                                    {completionRequirementTexts.length > 0 &&
                                        !isOperationCompleted(
                                            operation.status,
                                        ) &&
                                        !operationPendingVerification && (
                                            <Typography
                                                level="body2"
                                                className="ml-1 text-xs text-muted-foreground"
                                            >
                                                {completionRequirementTexts.join(
                                                    ' · ',
                                                )}
                                            </Typography>
                                        )}
                                    <Typography
                                        level="body2"
                                        component="div"
                                        className="select-none"
                                    >
                                        {operation.scheduledDate ? (
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
                                </Row>
                                <Row>
                                    {(isOperationCompleted(operation.status) ||
                                        operationPendingVerification) && (
                                        <OperationCompletionAttachments
                                            operationId={operation.id}
                                            notes={operation.completionNotes}
                                            imageUrls={operation.imageUrls}
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
                                            scheduledDate:
                                                operation.scheduledDate,
                                        }}
                                        operationLabel={
                                            operationData?.information?.label ??
                                            operation.entityId.toString()
                                        }
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
                                            scheduledDate:
                                                operation.scheduledDate,
                                            status: operation.status,
                                        }}
                                        operationLabel={
                                            operationData?.information?.label ??
                                            operation.entityId.toString()
                                        }
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
                                                    cancelOperationAction(
                                                        formData,
                                                    ),
                                                errorLogMessage:
                                                    'Error canceling operation:',
                                                errorAlertMessage:
                                                    'Otkazivanje radnje nije uspjelo. Promjena je vraćena.',
                                            })
                                        }
                                        trigger={
                                            <IconButton
                                                variant="plain"
                                                title="Otkaži operaciju"
                                                disabled={operationLocked}
                                            >
                                                <Close className="size-4 shrink-0" />
                                            </IconButton>
                                        }
                                    />
                                </Row>
                            </Row>
                        </div>
                    );
                })}
            </Stack>
        </Stack>
    );
}
