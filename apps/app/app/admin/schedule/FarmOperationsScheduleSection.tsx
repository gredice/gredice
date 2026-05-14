'use client';

import type { OperationAssignableFarmUser } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Calendar, Close } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Chip } from '@signalco/ui-primitives/Chip';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
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
import { CancelOperationModal } from './CancelOperationModal';
import { CompleteOperationModal } from './CompleteOperationModal';
import { OperationCompletionAttachments } from './OperationCompletionAttachments';
import { RescheduleOperationModal } from './RescheduleOperationModal';
import {
    createOperationAssignedUsers,
    parseScheduledDateInput,
} from './scheduleOptimisticHelpers';
import {
    formatMinutes,
    getOperationDurationMinutes,
    isOperationCancelled,
    isOperationCompleted,
    isOperationPendingVerification,
} from './scheduleShared';
import type { Operation } from './types';
import { useOptimisticScheduleActions } from './useOptimisticScheduleActions';
import { VerifyOperationModal } from './VerifyOperationModal';

type FarmSummary = {
    id: number;
    name: string;
};

interface FarmOperationsScheduleSectionProps {
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

    const totalDuration = dayOperations.reduce(
        (sum, operation) =>
            sum +
            getOperationDurationMinutes(
                operationDataById.get(operation.entityId),
            ),
        0,
    );

    return (
        <Stack spacing={1}>
            <Row spacing={1} className="w-full items-center flex-wrap gap-y-1">
                <Link href={KnownPages.Farm(farm.id)}>
                    <Typography semiBold>{farm.name}</Typography>
                </Link>
                <Typography level="body2" className="text-muted-foreground">
                    {dayOperations.length} zadataka
                </Typography>
                {totalDuration > 0 && (
                    <Typography level="body2" className="text-muted-foreground">
                        Vrijeme: {formatMinutes(totalDuration)}
                    </Typography>
                )}
            </Row>
            <Stack spacing={1}>
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
                    const completionRequirementTexts = [
                        attachImages
                            ? attachImagesRequired
                                ? 'Slike obavezne'
                                : 'Slike opcionalne'
                            : null,
                        attachNotes
                            ? attachNotesRequired
                                ? 'Napomena obavezna'
                                : 'Napomena opcionalna'
                            : null,
                    ].filter((text): text is string => Boolean(text));

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

                    return (
                        <Row
                            key={operation.id}
                            spacing={1}
                            className={
                                operation.isAccepted && !operationLocked
                                    ? 'rounded bg-muted/60 text-foreground hover:bg-muted/80'
                                    : 'rounded hover:bg-muted'
                            }
                        >
                            <Row spacing={1} className="grow">
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
                                        renderTrigger={({
                                            isSubmitting,
                                            openModal,
                                            defaultTrigger,
                                        }) => (
                                            <Row
                                                spacing={0.5}
                                                className="items-center"
                                            >
                                                {defaultTrigger}
                                                <Button
                                                    variant="solid"
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700 text-white"
                                                    onClick={openModal}
                                                    disabled={isSubmitting}
                                                >
                                                    Potvrdi
                                                </Button>
                                            </Row>
                                        )}
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
                                <a
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
                                    !isOperationCompleted(operation.status) &&
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
