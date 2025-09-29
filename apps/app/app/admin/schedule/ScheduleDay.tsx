'use client';

import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import { Calendar, Close } from '@signalco/ui-icons';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { KnownPages } from '../../../src/KnownPages';
import { raisedBedPlanted } from '../../(actions)/raisedBedFieldsActions';
import { AcceptOperationModal } from './AcceptOperationModal';
import { AcceptRaisedBedFieldModal } from './AcceptRaisedBedFieldModal';
import { CancelOperationModal } from './CancelOperationModal';
import { CancelRaisedBedFieldModal } from './CancelRaisedBedFieldModal';
import { CompleteOperationModal } from './CompleteOperationModal';
import { CopySummaryButton } from './CopySummaryButton';
import { CopyTasksButton } from './CopyTasksButton';
import { RescheduleOperationModal } from './RescheduleOperationModal';
import { RescheduleRaisedBedFieldModal } from './RescheduleRaisedBedFieldModal';

const PLANTING_TASK_DURATION_MINUTES = 5;

const FIELD_STATUSES_TO_INCLUDE = new Set(['new', 'planned', 'sowed']);
const FIELD_COMPLETED_STATUSES = new Set(['sowed']);
const OPERATION_STATUSES_TO_INCLUDE = new Set([
    'new',
    'planned',
    'completed',
    'cancelled',
]);

function isFieldApproved(status?: string) {
    return status === 'planned';
}

function isFieldCompleted(status?: string) {
    if (!status) {
        return false;
    }
    return FIELD_COMPLETED_STATUSES.has(status);
}

function isOperationCompleted(status?: string) {
    return status === 'completed';
}

function isOperationCancelled(status?: string) {
    return status === 'cancelled';
}

function formatMinutes(minutes: number, hideUnit = false) {
    const rounded = Math.ceil(Math.max(0, minutes));
    return hideUnit ? `${rounded}` : `${rounded} min`;
}

function getOperationDurationMinutes(
    operationData: EntityStandardized | undefined,
) {
    if (!operationData) {
        return 0;
    }

    const durationValue = (
        operationData as { attributes?: { duration?: unknown } }
    )?.attributes?.duration;

    if (typeof durationValue === 'number' && Number.isFinite(durationValue)) {
        return Math.max(durationValue, 0);
    }

    if (typeof durationValue === 'string') {
        const parsed = Number.parseFloat(durationValue);
        if (Number.isFinite(parsed)) {
            return Math.max(parsed, 0);
        }
    }

    return 0;
}

// Type definitions for the props (without importing server-side functions)
type RaisedBed = {
    id: number;
    physicalId: string | null;
    name?: string | null;
    accountId?: string | null;
    gardenId?: number | null;
    blockId?: string | null;
    fields: Array<{
        id: number;
        raisedBedId: number;
        positionIndex: number;
        plantStatus?: string;
        plantScheduledDate?: Date;
        plantSortId?: number;
        plantSowDate?: Date;
        plantGrowthDate?: Date;
        plantReadyDate?: Date;
        createdAt: Date;
        updatedAt: Date;
        isDeleted: boolean;
    }>;
};

type Operation = {
    id: number;
    raisedBedId: number | null;
    raisedBedFieldId?: number | null;
    entityId: number;
    entityTypeName: string;
    accountId?: string | null;
    gardenId?: number | null;
    status: string;
    scheduledDate?: Date;
    completedAt?: Date;
    completedBy?: string;
    timestamp: Date;
    createdAt: Date;
    isAccepted: boolean;
    isDeleted: boolean;
};

interface ScheduleDayProps {
    isToday: boolean;
    date: Date;
    allRaisedBeds: RaisedBed[];
    operations: Operation[];
    plantSorts: EntityStandardized[] | null | undefined;
    operationsData: EntityStandardized[] | null | undefined;
    userId: string;
}

function getDaySchedule(
    isToday: boolean,
    date: Date,
    raisedBeds: RaisedBed[],
    operations: Operation[],
) {
    const todaysFields = raisedBeds
        .filter((raisedBed) => Boolean(raisedBed.physicalId))
        .flatMap((rb) => rb.fields)
        .filter((field) => {
            // For completed fields (sowed), show them only on the day they were completed
            if (field.plantStatus === 'sowed' && field.plantSowDate) {
                const sowDate = new Date(field.plantSowDate);
                return sowDate.toDateString() === date.toDateString();
            }

            return (
                FIELD_STATUSES_TO_INCLUDE.has(field.plantStatus ?? 'new') &&
                ((!field.plantScheduledDate && isToday) ||
                    (field.plantScheduledDate &&
                        (date.toDateString() ===
                            new Date(field.plantScheduledDate).toDateString() || // For specific scheduled date
                            (date > new Date(field.plantScheduledDate) &&
                                isToday))))
            );
        });
    const todaysOperations = operations.filter((op) => {
        if (!OPERATION_STATUSES_TO_INCLUDE.has(op.status)) {
            return false;
        }
        if (op.raisedBedId === null) {
            return false;
        }

        // Show completed operations on the day they were completed
        if (isOperationCompleted(op.status) && op.completedAt) {
            const completedDate = new Date(op.completedAt);
            return completedDate.toDateString() === date.toDateString();
        }

        const scheduledDate = op.scheduledDate
            ? new Date(op.scheduledDate)
            : undefined;
        const sameDay =
            scheduledDate !== undefined &&
            date.toDateString() === scheduledDate.toDateString();
        const isUnscheduledToday = scheduledDate === undefined && isToday;
        const isOverdueToday =
            scheduledDate !== undefined &&
            isToday &&
            date > scheduledDate &&
            !isOperationCompleted(op.status) &&
            !isOperationCancelled(op.status);

        return sameDay || isUnscheduledToday || isOverdueToday;
    });

    // Get unique raisedBedIds from new operations and fields
    const todayAffectedRaisedBedIds = [
        ...new Set([
            ...(todaysOperations
                .map((op) => op.raisedBedId)
                .filter((id) => id !== null) as number[]),
            ...todaysFields.map((field) => field.raisedBedId),
        ]),
    ];

    // Unique physical IDs from raised beds from the new operations and fields
    const physicalIds = [
        ...new Set([
            ...raisedBeds
                .filter((rb) => todayAffectedRaisedBedIds.includes(rb.id))
                .map((rb) => rb.physicalId)
                .filter((id) => id !== null),
        ]),
    ].sort((a, b) => Number(a) - Number(b));

    return {
        fields: todaysFields,
        operations: todaysOperations,
        affectedRaisedBedPhysicalIds: physicalIds,
    };
}

export function ScheduleDay({
    isToday,
    date,
    allRaisedBeds,
    operations,
    plantSorts,
    operationsData,
    userId,
}: ScheduleDayProps) {
    const {
        fields: scheduledFields,
        operations: scheduledOperations,
        affectedRaisedBedPhysicalIds,
    } = getDaySchedule(isToday, date, allRaisedBeds, operations);

    const operationDataById = new Map<number, EntityStandardized>();
    if (operationsData) {
        for (const operationData of operationsData) {
            operationDataById.set(operationData.id, operationData);
        }
    }

    if (isToday) {
        console.debug(scheduledOperations);
    }

    const totalTasksCount = scheduledFields.length + scheduledOperations.length;
    let approvedTasksCount = 0;
    let completedTasksCount = 0;
    let totalDuration = 0;
    let approvedDuration = 0;
    let completedDuration = 0;

    for (const field of scheduledFields) {
        const isCompleted = isFieldCompleted(field.plantStatus);
        const isApproved = isFieldApproved(field.plantStatus);
        totalDuration += PLANTING_TASK_DURATION_MINUTES;
        if (isApproved) {
            approvedDuration += PLANTING_TASK_DURATION_MINUTES;
            approvedTasksCount += 1;
        }
        if (isCompleted) {
            completedDuration += PLANTING_TASK_DURATION_MINUTES;
            completedTasksCount += 1;
        }
    }

    for (const operation of scheduledOperations) {
        const operationDuration = getOperationDurationMinutes(
            operationDataById.get(operation.entityId),
        );
        totalDuration += operationDuration;
        const completed = isOperationCompleted(operation.status);
        if (completed) {
            completedDuration += operationDuration;
            completedTasksCount += 1;
        }
        if (
            operation.isAccepted &&
            !completed &&
            !isOperationCancelled(operation.status)
        ) {
            approvedDuration += operationDuration;
            approvedTasksCount += 1;
        }
    }

    const hasTasks = totalTasksCount > 0;
    const summaryCopyText = [
        `Sažetak za ${new Intl.DateTimeFormat('hr-HR', {
            dateStyle: 'full',
        }).format(date)}`,
        `Odobreni zadaci: ${approvedTasksCount}`,
        `Odobreno vrijeme: ${formatMinutes(approvedDuration)}`,
    ].join('\n');

    return (
        <Stack className="grow" spacing={2}>
            <Stack>
                <Row
                    spacing={2}
                    alignItems="start"
                    justifyContent="space-between"
                >
                    <Row spacing={1} alignItems="start">
                        <Calendar className="size-4 shrink-0 text-muted-foreground" />
                        <Stack>
                            <Typography level="body2">
                                <LocalDateTime time={false}>
                                    {date}
                                </LocalDateTime>
                            </Typography>
                            <Typography level="body1" uppercase semiBold>
                                {new Date().toDateString() ===
                                date.toDateString()
                                    ? 'Danas'
                                    : new Intl.DateTimeFormat('hr-HR', {
                                          weekday: 'long',
                                      })
                                          .format(date)
                                          .substring(0, 3)}
                            </Typography>
                            <CopySummaryButton
                                disabled={approvedTasksCount === 0}
                                summaryText={summaryCopyText}
                            />
                        </Stack>
                    </Row>
                    <Stack className="border p-4 py-3 rounded-lg">
                        <Row spacing={0.5}>
                            <Typography level="body3">Zadaci:</Typography>
                            <Typography level="body1" semiBold>
                                {completedTasksCount}
                            </Typography>
                            <Typography level="body3">/</Typography>
                            <Typography level="body1" semiBold>
                                {approvedTasksCount}
                            </Typography>
                            <Typography level="body3" semiBold>
                                ({totalTasksCount})
                            </Typography>
                        </Row>
                        <Row spacing={0.5}>
                            <Typography level="body3">Vrijeme:</Typography>
                            <Typography level="body1" semiBold>
                                {formatMinutes(completedDuration, true)}
                            </Typography>
                            <Typography level="body3">/</Typography>
                            <Typography level="body1" semiBold>
                                {formatMinutes(approvedDuration)}
                            </Typography>
                            <Typography level="body3" semiBold>
                                ({formatMinutes(totalDuration)})
                            </Typography>
                        </Row>
                        <Typography level="body3">
                            (završeno/odobreno/ukupno)
                        </Typography>
                    </Stack>
                </Row>
            </Stack>
            {!hasTasks && (
                <Typography level="body2" className="leading-[56px]">
                    Trenutno nema zadataka za ovaj dan.
                </Typography>
            )}
            {affectedRaisedBedPhysicalIds.map((physicalId) => {
                const raisedBeds = allRaisedBeds
                    .filter((rb) => rb.physicalId === physicalId)
                    .sort((a, b) => a.id - b.id);

                const dayFields = scheduledFields
                    .filter((field) =>
                        raisedBeds.some((rb) => rb.id === field.raisedBedId),
                    )
                    .map((field) => ({
                        ...field,
                        physicalPositionIndex: raisedBeds
                            .at(0)
                            ?.fields.find((f) => f.id === field.id)
                            ? field.positionIndex + 1
                            : field.positionIndex + 10,
                    }))
                    .sort(
                        (a, b) =>
                            a.physicalPositionIndex - b.physicalPositionIndex,
                    );
                const dayOperations = scheduledOperations
                    .filter(
                        (op) =>
                            op.raisedBedId !== null &&
                            raisedBeds.some((rb) => rb.id === op.raisedBedId),
                    )
                    .map((op) => {
                        const isFirstRaisedBed =
                            op.raisedBedId === raisedBeds.at(0)?.id;
                        const field = op.raisedBedFieldId
                            ? raisedBeds
                                  .flatMap((rb) => rb.fields)
                                  .find((rbf) => rbf.id === op.raisedBedFieldId)
                            : undefined;
                        const sort = field?.plantSortId
                            ? plantSorts?.find(
                                  (ps) => ps.id === field.plantSortId,
                              )
                            : null;

                        const physicalPositionIndex = field
                            ? (isFirstRaisedBed
                                  ? field.positionIndex + 1
                                  : field.positionIndex + 10
                              ).toString()
                            : isFirstRaisedBed
                              ? '1-9'
                              : '10-18';

                        return {
                            ...op,
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

                // Prepare tasks for copy functionality
                const copyTasks = [
                    ...dayFields.map((field) => {
                        const sortData = plantSorts?.find(
                            (ps) => ps.id === field.plantSortId,
                        );
                        const numberOfPlants =
                            Math.floor(
                                30 /
                                    (sortData?.information?.plant?.attributes
                                        ?.seedingDistance || 30),
                            ) ** 2;
                        const status = field.plantStatus;
                        return {
                            id: `field-${field.id}`,
                            text: `${field.physicalPositionIndex} - sijanje: ${numberOfPlants} ${field.plantSortId ? `${sortData?.information?.name}` : '?'}`,
                            approved:
                                isFieldApproved(status) &&
                                !isFieldCompleted(status),
                        };
                    }),
                    ...dayOperations.map((op) => {
                        const operationData = operationDataById.get(
                            op.entityId,
                        );
                        return {
                            id: `operation-${op.id}`,
                            text: `${op.physicalPositionIndex} - ${operationData?.information?.label ?? op.entityId}${op.sort ? `: ${op.sort.information?.name ?? 'Nepoznato'}` : ''}`,
                            link: operationData?.information?.label
                                ? KnownPages.GrediceOperation(
                                      operationData?.information?.label,
                                  )
                                : KnownPages.GrediceOperations,
                            approved:
                                op.isAccepted &&
                                !isOperationCompleted(op.status) &&
                                !isOperationCancelled(op.status),
                        };
                    }),
                ];

                const raisedBedFieldDurations = dayFields.reduce(
                    (acc, field) => {
                        acc.total += PLANTING_TASK_DURATION_MINUTES;
                        if (isFieldApproved(field.plantStatus)) {
                            acc.approved += PLANTING_TASK_DURATION_MINUTES;
                        }
                        if (isFieldCompleted(field.plantStatus)) {
                            acc.completed += PLANTING_TASK_DURATION_MINUTES;
                        }
                        return acc;
                    },
                    { total: 0, approved: 0, completed: 0 },
                );

                const raisedBedOperationDurations = dayOperations.reduce(
                    (acc, op) => {
                        const duration = getOperationDurationMinutes(
                            operationDataById.get(op.entityId),
                        );
                        acc.total += duration;
                        if (isOperationCompleted(op.status)) {
                            acc.completed += duration;
                        }
                        if (
                            op.isAccepted &&
                            !isOperationCompleted(op.status) &&
                            !isOperationCancelled(op.status)
                        ) {
                            acc.approved += duration;
                        }
                        return acc;
                    },
                    { total: 0, approved: 0, completed: 0 },
                );

                const raisedBedTotalDuration =
                    raisedBedFieldDurations.total +
                    raisedBedOperationDurations.total;
                const raisedBedApprovedDuration =
                    raisedBedFieldDurations.approved +
                    raisedBedOperationDurations.approved;
                const raisedBedCompletedDuration =
                    raisedBedFieldDurations.completed +
                    raisedBedOperationDurations.completed;

                return (
                    <Stack key={physicalId} spacing={1}>
                        <Row
                            spacing={1}
                            className="items-center flex-wrap gap-y-1"
                        >
                            <RaisedBedLabel physicalId={physicalId} />
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Vrijeme:{' '}
                                {formatMinutes(
                                    raisedBedCompletedDuration,
                                    true,
                                )}{' '}
                                / {formatMinutes(raisedBedApprovedDuration)} (
                                {formatMinutes(raisedBedTotalDuration)})
                            </Typography>
                            <CopyTasksButton
                                physicalId={physicalId.toString()}
                                tasks={copyTasks}
                            />
                        </Row>
                        <Stack spacing={1}>
                            {!dayFields.length && !dayOperations.length && (
                                <Typography level="body2">
                                    Trenutno nema zadataka za ovu gredicu.
                                </Typography>
                            )}
                            {dayFields.map((field) => {
                                const sortData = plantSorts?.find(
                                    (ps) => ps.id === field.plantSortId,
                                );
                                const numberOfPlants =
                                    Math.floor(
                                        30 /
                                            (sortData?.information?.plant
                                                ?.attributes?.seedingDistance ||
                                                30),
                                    ) ** 2;

                                const handlePlantConfirm = async () => {
                                    if (!field.plantSortId) return;
                                    await raisedBedPlanted(
                                        field.raisedBedId,
                                        field.positionIndex,
                                        field.plantSortId,
                                    );
                                };

                                const fieldLabel = `${field.physicalPositionIndex} - sijanje: ${numberOfPlants} ${field.plantSortId ? `${sortData?.information?.name}` : 'Nepoznato'}`;
                                const fieldStatus = field.plantStatus;
                                const fieldCompleted =
                                    isFieldCompleted(fieldStatus);
                                const fieldApproved =
                                    isFieldApproved(fieldStatus);
                                const fieldStatusText = fieldCompleted
                                    ? 'Završeno'
                                    : fieldApproved
                                      ? 'Potvrđeno'
                                      : 'Nije potvrđeno';
                                const fieldStatusClassName = fieldCompleted
                                    ? 'text-green-600'
                                    : fieldApproved
                                      ? 'text-green-600'
                                      : 'text-muted-foreground';

                                return (
                                    <div key={field.id}>
                                        <Row
                                            spacing={1}
                                            className="hover:bg-muted rounded"
                                        >
                                            <Row spacing={1} className="grow">
                                                {field.plantStatus === 'new' ? (
                                                    <AcceptRaisedBedFieldModal
                                                        raisedBedId={
                                                            field.raisedBedId
                                                        }
                                                        positionIndex={
                                                            field.positionIndex
                                                        }
                                                        label={fieldLabel}
                                                    />
                                                ) : fieldCompleted ? (
                                                    <Checkbox
                                                        className="size-5 mx-2"
                                                        checked
                                                        disabled
                                                    />
                                                ) : (
                                                    <ModalConfirm
                                                        title="Potvrda sijanja"
                                                        header="Označavanje kao posijano"
                                                        onConfirm={
                                                            handlePlantConfirm
                                                        }
                                                        trigger={
                                                            <Checkbox className="size-5 mx-2" />
                                                        }
                                                    >
                                                        <Typography>
                                                            Jeste li sigurni da
                                                            želite označiti da
                                                            je posijavno:{' '}
                                                            <strong>
                                                                {fieldLabel}
                                                            </strong>
                                                            ?
                                                        </Typography>
                                                    </ModalConfirm>
                                                )}
                                                <Typography
                                                    className={
                                                        fieldCompleted
                                                            ? 'line-through text-muted-foreground'
                                                            : undefined
                                                    }
                                                >
                                                    {fieldLabel}
                                                </Typography>
                                                <Typography
                                                    level="body2"
                                                    className={`ml-1 italic ${fieldStatusClassName}`}
                                                >
                                                    {fieldStatusText}
                                                </Typography>
                                                <Typography
                                                    level="body2"
                                                    className="select-none"
                                                >
                                                    {field.plantScheduledDate ? (
                                                        <LocalDateTime
                                                            time={false}
                                                        >
                                                            {
                                                                field.plantScheduledDate
                                                            }
                                                        </LocalDateTime>
                                                    ) : (
                                                        <span>Danas</span>
                                                    )}
                                                </Typography>
                                            </Row>
                                            <Row>
                                                <RescheduleRaisedBedFieldModal
                                                    field={field}
                                                    fieldLabel={fieldLabel}
                                                    trigger={
                                                        <IconButton
                                                            variant="plain"
                                                            title={
                                                                field.plantScheduledDate
                                                                    ? 'Prerasporedi sijanje'
                                                                    : 'Zakaži sijanje'
                                                            }
                                                            disabled={
                                                                fieldCompleted
                                                            }
                                                        >
                                                            <Calendar className="size-4 shrink-0" />
                                                        </IconButton>
                                                    }
                                                />
                                                <CancelRaisedBedFieldModal
                                                    field={field}
                                                    fieldLabel={fieldLabel}
                                                    trigger={
                                                        <IconButton
                                                            variant="plain"
                                                            title="Otkaži sijanje"
                                                            disabled={
                                                                fieldCompleted
                                                            }
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
                            {dayOperations.map((op) => {
                                const operationData = operationDataById.get(
                                    op.entityId,
                                );
                                const operationLabel = `${op.physicalPositionIndex} - ${operationData?.information?.label ?? op.entityId}${op.sort ? `: ${op.sort.information?.name ?? 'Nepoznato'}` : ''}`;
                                const operationCompleted = isOperationCompleted(
                                    op.status,
                                );
                                const operationCancelled = isOperationCancelled(
                                    op.status,
                                );
                                const operationStatusText = operationCancelled
                                    ? 'Otkazano'
                                    : operationCompleted
                                      ? 'Završeno'
                                      : op.isAccepted
                                        ? 'Potvrđeno'
                                        : 'Nije potvrđeno';
                                const operationStatusClassName =
                                    operationCancelled
                                        ? 'text-red-600'
                                        : operationCompleted
                                          ? 'text-green-600'
                                          : op.isAccepted
                                            ? 'text-green-600'
                                            : 'text-muted-foreground';
                                const operationInactive =
                                    operationCompleted || operationCancelled;
                                return (
                                    <div key={op.id}>
                                        <Row
                                            spacing={1}
                                            className="hover:bg-muted rounded"
                                        >
                                            <Row spacing={1} className="grow">
                                                {operationCompleted ? (
                                                    <Checkbox
                                                        className="size-5 mx-2"
                                                        checked
                                                        disabled
                                                    />
                                                ) : operationCancelled ? (
                                                    <Checkbox
                                                        className="size-5 mx-2"
                                                        checked={false}
                                                        disabled
                                                    />
                                                ) : op.isAccepted ? (
                                                    <CompleteOperationModal
                                                        operationId={op.id}
                                                        userId={userId}
                                                        label={operationLabel}
                                                        conditions={
                                                            operationData?.conditions
                                                        }
                                                    />
                                                ) : (
                                                    <AcceptOperationModal
                                                        operationId={op.id}
                                                        label={operationLabel}
                                                    />
                                                )}
                                                <a
                                                    href={
                                                        operationData
                                                            ?.information?.label
                                                            ? KnownPages.GrediceOperation(
                                                                  operationData
                                                                      ?.information
                                                                      ?.label,
                                                              )
                                                            : KnownPages.GrediceOperations
                                                    }
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <Typography
                                                        className={
                                                            operationInactive
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
                                                <Typography
                                                    level="body2"
                                                    className="select-none"
                                                >
                                                    {op.scheduledDate ? (
                                                        <LocalDateTime
                                                            time={false}
                                                        >
                                                            {op.scheduledDate}
                                                        </LocalDateTime>
                                                    ) : (
                                                        <span>Danas</span>
                                                    )}
                                                </Typography>
                                            </Row>
                                            <Row>
                                                <RescheduleOperationModal
                                                    operation={{
                                                        id: op.id,
                                                        entityId: op.entityId,
                                                        scheduledDate:
                                                            op.scheduledDate,
                                                    }}
                                                    operationLabel={
                                                        operationData
                                                            ?.information
                                                            ?.label ??
                                                        op.entityId.toString()
                                                    }
                                                    trigger={
                                                        <IconButton
                                                            variant="plain"
                                                            title={
                                                                op.scheduledDate
                                                                    ? 'Prerasporedi operaciju'
                                                                    : 'Zakaži operaciju'
                                                            }
                                                            disabled={
                                                                operationInactive
                                                            }
                                                        >
                                                            <Calendar className="size-4 shrink-0" />
                                                        </IconButton>
                                                    }
                                                />
                                                <CancelOperationModal
                                                    operation={{
                                                        id: op.id,
                                                        entityId: op.entityId,
                                                        scheduledDate:
                                                            op.scheduledDate,
                                                        status: op.status,
                                                    }}
                                                    operationLabel={
                                                        operationData
                                                            ?.information
                                                            ?.label ??
                                                        op.entityId.toString()
                                                    }
                                                    trigger={
                                                        <IconButton
                                                            variant="plain"
                                                            title="Otkaži operaciju"
                                                            disabled={
                                                                operationInactive
                                                            }
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
            })}
        </Stack>
    );
}
