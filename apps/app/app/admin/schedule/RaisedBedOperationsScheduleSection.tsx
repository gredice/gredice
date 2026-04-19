'use client';

import type { OperationAssignableFarmUser } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Calendar, Close } from '@signalco/ui-icons';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { KnownPages } from '../../../src/KnownPages';
import { AcceptOperationModal } from './AcceptOperationModal';
import { AssignOperationModal } from './AssignOperationModal';
import { BulkApproveRaisedBedButton } from './BulkApproveRaisedBedButton';
import { BulkAssignRaisedBedButton } from './BulkAssignRaisedBedButton';
import { BulkRescheduleRaisedBedButton } from './BulkRescheduleRaisedBedButton';
import { CancelOperationModal } from './CancelOperationModal';
import { CompleteOperationModal } from './CompleteOperationModal';
import { CopyTasksButton } from './CopyTasksButton';
import { RescheduleOperationModal } from './RescheduleOperationModal';
import {
    formatMinutes,
    getOperationDurationMinutes,
    isOperationCancelled,
    isOperationCompleted,
    isOperationPendingVerification,
} from './scheduleShared';
import type { Operation, RaisedBed } from './types';
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
    if (raisedBeds.length === 0) {
        return null;
    }

    const sortedRaisedBeds = [...raisedBeds].sort((a, b) => a.id - b.id);

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
                physicalPositionIndex,
                sort,
            };
        })
        .sort((a, b) =>
            a.physicalPositionIndex.localeCompare(
                b.physicalPositionIndex,
                undefined,
                {
                    numeric: true,
                },
            ),
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
                !isOperationCancelled(operation.status),
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
    const operationsToReschedule = operationsToApprove.map((operation) => ({
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
        <Stack key={physicalId} spacing={1}>
            <Row spacing={1} className="w-full items-center flex-wrap gap-y-1">
                <BulkApproveRaisedBedButton
                    physicalId={physicalId.toString()}
                    fields={[]}
                    operations={operationsToApprove}
                />
                <Row
                    spacing={0.5}
                    className="min-w-0 grow items-center flex-wrap gap-y-1"
                >
                    <RaisedBedLabel physicalId={physicalId} />
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
                <Row spacing={0.5} className="ml-auto shrink-0 items-center">
                    <BulkAssignRaisedBedButton
                        physicalId={physicalId.toString()}
                        fields={[]}
                        operations={operationsToAssign}
                    />
                    <BulkRescheduleRaisedBedButton
                        physicalId={physicalId.toString()}
                        fields={[]}
                        operations={operationsToReschedule}
                    />
                </Row>
            </Row>
            <Stack spacing={1}>
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
                    const attachImages =
                        operationData?.conditions?.completionAttachImages;
                    const attachRequired =
                        operationData?.conditions
                            ?.completionAttachImagesRequired;
                    const imageStatusText = attachImages
                        ? attachRequired
                            ? 'Slike obavezne'
                            : 'Slike opcionalne'
                        : null;

                    return (
                        <div key={operation.id}>
                            <Row spacing={1} className="hover:bg-muted rounded">
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
                                        />
                                    ) : (
                                        <AcceptOperationModal
                                            operationId={operation.id}
                                            label={operationLabel}
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
                                    {imageStatusText &&
                                        !isOperationCompleted(
                                            operation.status,
                                        ) &&
                                        !operationPendingVerification && (
                                            <Typography
                                                level="body2"
                                                className="ml-1 text-xs text-muted-foreground"
                                            >
                                                {imageStatusText}
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
                                            <span>Danas</span>
                                        )}
                                    </Typography>
                                </Row>
                                <Row>
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
