'use client';

import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import { Calendar, Close, Tally3 } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { KnownPages } from '../../../src/KnownPages';
import { raisedBedPlanted } from '../../(actions)/raisedBedFieldsActions';
import { CancelOperationModal } from './CancelOperationModal';
import { CompleteOperationModal } from './CompleteOperationModal';
import { CopyTasksButton } from './CopyTasksButton';
import { RescheduleOperationModal } from './RescheduleOperationModal';

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

    return (
        <Stack className="grow">
            {!affectedRaisedBedPhysicalIds.length && (
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
                        };
                    }),
                    ...dayOperations.map((op) => {
                        const operationData = operationsData?.find(
                            (data) => data.id === op.entityId,
                        );
                        return {
                            id: `operation-${op.id}`,
                            text: `${op.physicalPositionIndex} - ${operationData?.information?.label ?? op.entityId}${op.sort ? `: ${op.sort.information?.name ?? 'Nepoznato'}` : ''}`,
                            link: operationData?.information?.label
                                ? KnownPages.GrediceOperation(
                                      operationData?.information?.label,
                                  )
                                : KnownPages.GrediceOperations,
                        };
                    }),
                ];

                return (
                    <Stack key={physicalId} spacing={1}>
                        <Row spacing={1}>
                            <Tally3 className="size-5 rotate-90 mt-1" />
                            <Typography level="h5" component="p">
                                <strong>Gr {physicalId}</strong>
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
                                    await raisedBedPlanted(
                                        field.raisedBedId,
                                        field.positionIndex,
                                    );
                                };

                                return (
                                    <div key={field.id}>
                                        <Row spacing={1}>
                                            <ModalConfirm
                                                title="Potvrda sijanja"
                                                header="Označavanje kao posijano"
                                                onConfirm={handlePlantConfirm}
                                                trigger={<Checkbox />}
                                            >
                                                <Typography>
                                                    Jeste li sigurni da želite
                                                    označiti da je posijavno:{' '}
                                                    <strong>{`${field.physicalPositionIndex} - ${numberOfPlants} ${field.plantSortId ? `${sortData?.information?.name}` : 'Nepoznato'}`}</strong>
                                                    ?
                                                </Typography>
                                            </ModalConfirm>
                                            <Typography>
                                                {`${field.physicalPositionIndex} - sijanje: ${numberOfPlants} ${field.plantSortId ? `${sortData?.information?.name}` : 'Nepoznato'}`}
                                            </Typography>
                                        </Row>
                                    </div>
                                );
                            })}
                            {dayOperations.map((op) => {
                                const operationData = operationsData?.find(
                                    (data) => data.id === op.entityId,
                                );
                                return (
                                    <div key={op.id}>
                                        <Row
                                            spacing={1}
                                            className="hover:bg-muted"
                                        >
                                            <Row spacing={1}>
                                                <CompleteOperationModal
                                                    operationId={op.id}
                                                    userId={userId}
                                                    label={`${op.physicalPositionIndex} - ${operationData?.information?.label ?? op.entityId}${op.sort ? `: ${op.sort.information?.name ?? 'Nepoznato'}` : ''}`}
                                                    conditions={
                                                        operationData?.conditions
                                                    }
                                                />
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
                                                        {`${op.physicalPositionIndex} - ${operationData?.information?.label ?? op.entityId}${op.sort ? `: ${op.sort.information?.name ?? 'Nepoznato'}` : ''}`}
                                                    </Typography>
                                                </a>
                                            </Row>
                                            <Row
                                                justifyContent="space-between"
                                                className="grow"
                                            >
                                                {op.scheduledDate && (
                                                    <Typography
                                                        level="body2"
                                                        className="select-none"
                                                    >
                                                        <LocalDateTime
                                                            time={false}
                                                        >
                                                            {op.scheduledDate}
                                                        </LocalDateTime>
                                                    </Typography>
                                                )}
                                                <Row>
                                                    <RescheduleOperationModal
                                                        operation={{
                                                            id: op.id,
                                                            entityId:
                                                                op.entityId,
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
                                                            <Button
                                                                variant="plain"
                                                                size="sm"
                                                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                                                title={
                                                                    op.scheduledDate
                                                                        ? 'Prerasporedi operaciju'
                                                                        : 'Zakaži operaciju'
                                                                }
                                                            >
                                                                <Calendar className="size-4 shrink-0" />
                                                            </Button>
                                                        }
                                                    />
                                                    <CancelOperationModal
                                                        operation={{
                                                            id: op.id,
                                                            entityId:
                                                                op.entityId,
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
                                                            <Button
                                                                variant="plain"
                                                                size="sm"
                                                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                                                title="Otkaži operaciju"
                                                            >
                                                                <Close className="size-4 shrink-0" />
                                                            </Button>
                                                        }
                                                    />
                                                </Row>
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
