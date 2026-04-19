import type { EntityStandardized } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { CompleteOperationModal } from './CompleteOperationModal';
import { HarvestOperationPrintModal } from './HarvestOperationPrintModal';
import type { FarmScheduleDayData } from './scheduleData';
import {
    formatMinutes,
    getOperationDurationMinutes,
    groupRaisedBedsForSchedule,
    isOperationCompleted,
} from './scheduleShared';

type FarmRaisedBed = FarmScheduleDayData['raisedBeds'][number];
type FarmOperation = FarmScheduleDayData['scheduledOperations'][number];

interface FarmScheduleOperationsSectionProps {
    raisedBeds: FarmScheduleDayData['raisedBeds'];
    scheduledOperations: FarmScheduleDayData['scheduledOperations'];
    plantSorts: EntityStandardized[] | null | undefined;
    operationsData: EntityStandardized[] | null | undefined;
    userId: string;
}

function buildOperationLabel(
    operation: FarmOperation,
    raisedBeds: FarmRaisedBed[],
    plantSortById: Map<number, EntityStandardized>,
    operationDataById: Map<number, EntityStandardized>,
) {
    const operationData = operationDataById.get(operation.entityId);
    const field = operation.raisedBedFieldId
        ? raisedBeds
              .flatMap((raisedBed) => raisedBed.fields)
              .find(
                  (raisedBedField) =>
                      raisedBedField.id === operation.raisedBedFieldId,
              )
        : undefined;
    const sort = field?.plantSortId
        ? plantSortById.get(field.plantSortId)
        : undefined;
    const physicalPositionIndex = field
        ? (field.positionIndex + 1).toString()
        : '';
    const isFullRaisedBed =
        operationData?.attributes?.application === 'raisedBedFull';

    return `${isFullRaisedBed || !physicalPositionIndex ? '' : `${physicalPositionIndex} - `}${operationData?.information?.label ?? operation.entityId}${sort ? `: ${sort.information?.name ?? 'Nepoznato'}` : ''}`;
}

function shouldPrintHarvestLabel(
    operationData: EntityStandardized | undefined,
) {
    return (
        (operationData as { attributes?: { printLabel?: unknown } } | undefined)
            ?.attributes?.printLabel === true
    );
}

function buildHarvestLabelData(
    operation: FarmOperation,
    raisedBeds: FarmRaisedBed[],
    plantSortById: Map<number, EntityStandardized>,
) {
    if (!operation.raisedBedFieldId || operation.raisedBedId === null) {
        return null;
    }

    const raisedBed = raisedBeds.find(
        (candidate) => candidate.id === operation.raisedBedId,
    );
    const field = raisedBed?.fields.find(
        (candidate) => candidate.id === operation.raisedBedFieldId,
    );
    const plantSortName = field?.plantSortId
        ? plantSortById.get(field.plantSortId)?.information?.name
        : undefined;

    if (!raisedBed?.physicalId || field?.positionIndex === undefined) {
        return null;
    }

    if (!plantSortName) {
        return null;
    }

    return {
        raisedBedPhysicalId: raisedBed.physicalId,
        fieldIndex: field.positionIndex + 1,
        plantSortName,
    };
}

export function FarmScheduleOperationsSection({
    raisedBeds,
    scheduledOperations,
    plantSorts,
    operationsData,
    userId,
}: FarmScheduleOperationsSectionProps) {
    if (scheduledOperations.length === 0) {
        return null;
    }

    const operationDataById = new Map<number, EntityStandardized>();
    if (operationsData) {
        for (const operationData of operationsData) {
            operationDataById.set(operationData.id, operationData);
        }
    }

    const plantSortById = new Map<number, EntityStandardized>();
    if (plantSorts) {
        for (const plantSort of plantSorts) {
            plantSortById.set(plantSort.id, plantSort);
        }
    }

    const affectedRaisedBedIds = [
        ...new Set(
            scheduledOperations
                .map((operation) => operation.raisedBedId)
                .filter((id): id is number => id !== null),
        ),
    ];
    const raisedBedGroups = groupRaisedBedsForSchedule(
        raisedBeds,
        affectedRaisedBedIds,
    );

    return (
        <Stack spacing={2}>
            {raisedBedGroups.map(
                ({ key, physicalId, raisedBeds: groupedRaisedBeds }) => {
                    const dayOperations = scheduledOperations
                        .filter(
                            (operation) =>
                                operation.raisedBedId !== null &&
                                groupedRaisedBeds.some(
                                    (raisedBed) =>
                                        raisedBed.id === operation.raisedBedId,
                                ),
                        )
                        .map((operation) => {
                            const label = buildOperationLabel(
                                operation,
                                groupedRaisedBeds,
                                plantSortById,
                                operationDataById,
                            );
                            const durationMinutes = getOperationDurationMinutes(
                                operationDataById.get(operation.entityId),
                            );

                            return {
                                ...operation,
                                durationMinutes,
                                label,
                            };
                        })
                        .sort((left, right) =>
                            left.label.localeCompare(right.label, undefined, {
                                numeric: true,
                            }),
                        );

                    const totalDuration = dayOperations.reduce(
                        (sum, operation) => sum + operation.durationMinutes,
                        0,
                    );

                    return (
                        <Stack key={key} spacing={1}>
                            <Row
                                spacing={1}
                                className="items-center flex-wrap gap-y-1"
                            >
                                {physicalId ? (
                                    <RaisedBedLabel physicalId={physicalId} />
                                ) : (
                                    <Typography semiBold>
                                        Gredica bez fizičkog ID-a
                                    </Typography>
                                )}
                                <Typography
                                    level="body2"
                                    className="text-muted-foreground"
                                >
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
                            <Stack spacing={1}>
                                {dayOperations.map((operation) => {
                                    const completed = isOperationCompleted(
                                        operation.status,
                                    );
                                    const operationData = operationDataById.get(
                                        operation.entityId,
                                    );
                                    const canComplete =
                                        !completed &&
                                        (!operation.assignedUserId ||
                                            operation.assignedUserId ===
                                                userId);
                                    const harvestLabelData =
                                        !completed &&
                                        shouldPrintHarvestLabel(operationData)
                                            ? buildHarvestLabelData(
                                                  operation,
                                                  groupedRaisedBeds,
                                                  plantSortById,
                                              )
                                            : null;

                                    return (
                                        <div
                                            key={operation.id}
                                            className="rounded-lg border bg-white px-3 py-2"
                                        >
                                            <Row
                                                spacing={1}
                                                className="items-start justify-between gap-3"
                                            >
                                                <Row
                                                    spacing={1}
                                                    className="min-w-0 grow items-start"
                                                >
                                                    {completed ? (
                                                        <Checkbox
                                                            className="size-5"
                                                            checked
                                                            disabled
                                                        />
                                                    ) : canComplete ? (
                                                        <CompleteOperationModal
                                                            operationId={
                                                                operation.id
                                                            }
                                                            label={
                                                                operation.label
                                                            }
                                                            conditions={
                                                                operationDataById.get(
                                                                    operation.entityId,
                                                                )?.conditions
                                                            }
                                                        />
                                                    ) : (
                                                        <div title="Radnja je dodijeljena drugom korisniku.">
                                                            <Checkbox
                                                                className="size-5"
                                                                disabled
                                                            />
                                                        </div>
                                                    )}
                                                    <Stack
                                                        spacing={0.5}
                                                        className="min-w-0 grow"
                                                    >
                                                        <Typography
                                                            className={
                                                                completed
                                                                    ? 'line-through text-muted-foreground'
                                                                    : undefined
                                                            }
                                                        >
                                                            {operation.label}
                                                        </Typography>
                                                        <Row
                                                            spacing={1}
                                                            className="items-center flex-wrap gap-y-1"
                                                        >
                                                            <Typography
                                                                level="body2"
                                                                className={
                                                                    completed
                                                                        ? 'text-green-600'
                                                                        : 'text-muted-foreground'
                                                                }
                                                            >
                                                                {completed
                                                                    ? 'Završeno'
                                                                    : 'Potvrđeno'}
                                                            </Typography>
                                                            {operation.durationMinutes >
                                                                0 && (
                                                                <Typography
                                                                    level="body2"
                                                                    className="text-muted-foreground"
                                                                >
                                                                    {formatMinutes(
                                                                        operation.durationMinutes,
                                                                    )}
                                                                </Typography>
                                                            )}
                                                            <Typography
                                                                level="body2"
                                                                className="text-muted-foreground"
                                                            >
                                                                {operation.scheduledDate ? (
                                                                    <>
                                                                        Planirano:{' '}
                                                                        <LocalDateTime
                                                                            time={
                                                                                false
                                                                            }
                                                                        >
                                                                            {
                                                                                operation.scheduledDate
                                                                            }
                                                                        </LocalDateTime>
                                                                    </>
                                                                ) : (
                                                                    'Danas'
                                                                )}
                                                            </Typography>
                                                            {harvestLabelData && (
                                                                <HarvestOperationPrintModal
                                                                    operationLabel={
                                                                        operation.label
                                                                    }
                                                                    labelData={
                                                                        harvestLabelData
                                                                    }
                                                                />
                                                            )}
                                                        </Row>
                                                    </Stack>
                                                </Row>
                                                {operation.assignedUser && (
                                                    <div
                                                        className="shrink-0"
                                                        title={`Dodijeljeno: ${operation.assignedUser.displayName ?? operation.assignedUser.userName}`}
                                                    >
                                                        <UserAvatar
                                                            avatarUrl={
                                                                operation
                                                                    .assignedUser
                                                                    .avatarUrl
                                                            }
                                                            displayName={
                                                                operation
                                                                    .assignedUser
                                                                    .displayName ??
                                                                operation
                                                                    .assignedUser
                                                                    .userName
                                                            }
                                                            className="size-7"
                                                        />
                                                    </div>
                                                )}
                                            </Row>
                                        </div>
                                    );
                                })}
                            </Stack>
                        </Stack>
                    );
                },
            )}
        </Stack>
    );
}
