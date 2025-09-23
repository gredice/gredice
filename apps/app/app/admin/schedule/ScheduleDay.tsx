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
import { CopyTasksButton } from './CopyTasksButton';
import { RescheduleOperationModal } from './RescheduleOperationModal';
import { RescheduleRaisedBedFieldModal } from './RescheduleRaisedBedFieldModal';

const PLANTING_TASK_DURATION_MINUTES = 5;

function formatMinutes(minutes: number) {
    const rounded = Math.ceil(Math.max(0, minutes));
    return `${rounded} min`;
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
    const todaysNewFields = raisedBeds
        .flatMap((rb) => rb.fields)
        .filter(
            (field) =>
                (field.plantStatus === 'new' ||
                    field.plantStatus === 'planned') &&
                ((!field.plantScheduledDate && isToday) ||
                    (field.plantScheduledDate &&
                        (date.toDateString() ===
                            new Date(field.plantScheduledDate).toDateString() || // For specific scheduled date
                            (date > new Date(field.plantScheduledDate) &&
                                isToday)))),
        );
    const todaysNewOperations = operations.filter(
        (op) =>
            (op.status === 'new' || op.status === 'planned') &&
            op.raisedBedId !== null && // Filter out operations without raised bed
            ((!op.scheduledDate && isToday) ||
                (op.scheduledDate &&
                    (date.toDateString() ===
                        new Date(op.scheduledDate).toDateString() || // For specific scheduled date
                        (date > new Date(op.scheduledDate) && isToday)))),
    );

    // Get unique raisedBedIds from new operations and fields
    const todayAffectedRaisedBedIds = [
        ...new Set([
            ...(todaysNewOperations
                .map((op) => op.raisedBedId)
                .filter((id) => id !== null) as number[]),
            ...todaysNewFields.map((field) => field.raisedBedId),
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
        newFields: todaysNewFields,
        newOperations: todaysNewOperations,
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
    const { newFields, newOperations, affectedRaisedBedPhysicalIds } =
        getDaySchedule(isToday, date, allRaisedBeds, operations);

    const operationDataById = new Map<number, EntityStandardized>();
    if (operationsData) {
        for (const operationData of operationsData) {
            operationDataById.set(operationData.id, operationData);
        }
    }

    const totalTasksCount = newFields.length + newOperations.length;
    let approvedTasksCount = 0;
    let totalDuration = 0;
    let approvedDuration = 0;

    for (const field of newFields) {
        totalDuration += PLANTING_TASK_DURATION_MINUTES;
        if (field.plantStatus === 'planned') {
            approvedDuration += PLANTING_TASK_DURATION_MINUTES;
            approvedTasksCount += 1;
        }
    }

    for (const operation of newOperations) {
        const operationDuration = getOperationDurationMinutes(
            operationDataById.get(operation.entityId),
        );
        totalDuration += operationDuration;
        if (operation.isAccepted) {
            approvedDuration += operationDuration;
            approvedTasksCount += 1;
        }
    }

    const hasTasks = totalTasksCount > 0;

    return (
        <Stack className="grow" spacing={2}>
            <Stack spacing={1}>
                <Typography level="body1" semiBold>
                    Sažetak
                </Typography>
                <Row spacing={1}>
                    <Row spacing={0.5}>
                        <Typography level="body3">Odobreno</Typography>
                        <Typography level="body1" semiBold>
                            {approvedTasksCount}
                        </Typography>
                        <Typography level="body3">
                            /{totalTasksCount}
                        </Typography>
                        <Typography level="body3">zadataka</Typography>
                    </Row>
                    <Typography level="body2">
                        Vrijeme (odobreno/ukupno):{' '}
                        {formatMinutes(approvedDuration)} /{' '}
                        {formatMinutes(totalDuration)}
                    </Typography>
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

                const dayFields = newFields
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
                const dayOperations = newOperations
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
                        return {
                            id: `field-${field.id}`,
                            text: `${field.physicalPositionIndex} - sijanje: ${numberOfPlants} ${field.plantSortId ? `${sortData?.information?.name}` : '?'}`,
                            approved: field.plantStatus === 'planned',
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
                            approved: op.isAccepted,
                        };
                    }),
                ];

                const raisedBedFieldDurations = dayFields.reduce(
                    (acc, field) => {
                        acc.total += PLANTING_TASK_DURATION_MINUTES;
                        if (field.plantStatus === 'planned') {
                            acc.approved += PLANTING_TASK_DURATION_MINUTES;
                        }
                        return acc;
                    },
                    { total: 0, approved: 0 },
                );

                const raisedBedOperationDurations = dayOperations.reduce(
                    (acc, op) => {
                        const duration = getOperationDurationMinutes(
                            operationDataById.get(op.entityId),
                        );
                        acc.total += duration;
                        if (op.isAccepted) {
                            acc.approved += duration;
                        }
                        return acc;
                    },
                    { total: 0, approved: 0 },
                );

                const raisedBedTotalDuration =
                    raisedBedFieldDurations.total +
                    raisedBedOperationDurations.total;
                const raisedBedApprovedDuration =
                    raisedBedFieldDurations.approved +
                    raisedBedOperationDurations.approved;

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
                                {formatMinutes(raisedBedApprovedDuration)} /{' '}
                                {formatMinutes(raisedBedTotalDuration)}
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
                                                <Typography>
                                                    {fieldLabel}
                                                </Typography>
                                                <Typography
                                                    level="body2"
                                                    className={`ml-1 italic ${field.plantStatus === 'new' ? 'text-muted-foreground' : 'text-green-600'}`}
                                                >
                                                    {field.plantStatus === 'new'
                                                        ? 'Nije potvrđeno'
                                                        : 'Potvrđeno'}
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
                                return (
                                    <div key={op.id}>
                                        <Row
                                            spacing={1}
                                            className="hover:bg-muted rounded"
                                        >
                                            <Row spacing={1} className="grow">
                                                {op.isAccepted ? (
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
                                                    <Typography>
                                                        {operationLabel}
                                                    </Typography>
                                                </a>
                                                <Typography
                                                    level="body2"
                                                    className={`ml-1 italic ${op.isAccepted ? 'text-green-600' : 'text-muted-foreground'}`}
                                                >
                                                    {op.isAccepted
                                                        ? 'Potvrđeno'
                                                        : 'Nije potvrđeno'}
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
