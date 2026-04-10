import type { EntityStandardized } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { FarmScheduleDayData } from './scheduleData';

type FarmRaisedBed = FarmScheduleDayData['raisedBeds'][number];
type FarmOperation = FarmScheduleDayData['scheduledOperations'][number];

type RaisedBedScheduleGroup = {
    key: string;
    physicalId: string | null;
    raisedBeds: FarmRaisedBed[];
};

interface FarmScheduleOperationsSectionProps {
    raisedBeds: FarmScheduleDayData['raisedBeds'];
    scheduledOperations: FarmScheduleDayData['scheduledOperations'];
    plantSorts: EntityStandardized[] | null | undefined;
    operationsData: EntityStandardized[] | null | undefined;
}

function comparePhysicalIds(left: string | null, right: string | null) {
    if (!left && !right) {
        return 0;
    }

    if (!left) {
        return 1;
    }

    if (!right) {
        return -1;
    }

    const leftNumber = Number(left);
    const rightNumber = Number(right);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        return leftNumber - rightNumber;
    }

    return left.localeCompare(right, undefined, { numeric: true });
}

function groupRaisedBedsForSchedule(
    raisedBeds: FarmRaisedBed[],
    affectedRaisedBedIds: number[],
) {
    const affectedRaisedBedIdSet = new Set(affectedRaisedBedIds);
    const groups = new Map<string, RaisedBedScheduleGroup>();

    for (const raisedBed of raisedBeds) {
        if (!affectedRaisedBedIdSet.has(raisedBed.id)) {
            continue;
        }

        const key = [
            raisedBed.physicalId ?? `missing-${raisedBed.id}`,
            raisedBed.gardenId ?? 'garden:null',
            raisedBed.accountId ?? 'account:null',
        ].join('|');
        const existingGroup = groups.get(key);

        if (existingGroup) {
            existingGroup.raisedBeds.push(raisedBed);
        } else {
            groups.set(key, {
                key,
                physicalId: raisedBed.physicalId,
                raisedBeds: [raisedBed],
            });
        }
    }

    return [...groups.values()]
        .map((group) => ({
            ...group,
            raisedBeds: [...group.raisedBeds].sort(
                (left, right) => left.id - right.id,
            ),
        }))
        .sort((left, right) => {
            const physicalIdComparison = comparePhysicalIds(
                left.physicalId,
                right.physicalId,
            );
            if (physicalIdComparison !== 0) {
                return physicalIdComparison;
            }

            return (
                (left.raisedBeds[0]?.id ?? 0) - (right.raisedBeds[0]?.id ?? 0)
            );
        });
}

function formatMinutes(minutes: number) {
    return `${Math.ceil(Math.max(0, minutes))} min`;
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

function isOperationCompleted(status?: string) {
    return status === 'completed';
}

export function FarmScheduleOperationsSection({
    raisedBeds,
    scheduledOperations,
    plantSorts,
    operationsData,
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
        <Stack spacing={2} className="px-6 pb-6">
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
                        <Stack key={key} spacing={1.5}>
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

                                    return (
                                        <div
                                            key={operation.id}
                                            className="rounded-lg border border-border/60 bg-background/70 px-3 py-2"
                                        >
                                            <Row
                                                spacing={1}
                                                className="items-start justify-between gap-3"
                                            >
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
                                                    </Row>
                                                </Stack>
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
