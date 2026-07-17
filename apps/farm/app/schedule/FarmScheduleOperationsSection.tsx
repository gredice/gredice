import type { EntityStandardized } from '@gredice/storage';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { Suspense } from 'react';
import { CompleteOperationModal } from './CompleteOperationModal';
import { FarmScheduleOperationTaskCard } from './FarmScheduleOperationTaskCard';
import { RaisedBedScheduleGroupHeader } from './RaisedBedScheduleGroupHeader';
import { RaisedBedScheduleGroupHeaderWithPhotos } from './RaisedBedScheduleGroupHeaderWithPhotos';
import { ScheduleSectionSummaryBadges } from './ScheduleSectionSummaryBadges';
import type {
    FarmScheduleDayData,
    FarmScheduleRaisedBedPhotoPreview,
} from './scheduleData';
import type { FarmScheduleOperationsMode } from './scheduleShared';
import {
    compareScheduleDates,
    getFieldPhysicalPositionIndex,
    getOperationDurationMinutes,
    groupRaisedBedsForSchedule,
    shouldDisplayScheduleOperation,
} from './scheduleShared';

type FarmRaisedBed = FarmScheduleDayData['raisedBeds'][number];
type FarmOperation = FarmScheduleDayData['scheduledOperations'][number];

interface FarmScheduleOperationsSectionProps {
    accountId: string;
    raisedBeds: FarmScheduleDayData['raisedBeds'];
    scheduledOperations: FarmScheduleDayData['scheduledOperations'];
    plantSorts: EntityStandardized[] | null | undefined;
    operationsData: EntityStandardized[] | null | undefined;
    raisedBedPhotoPreviewByIdPromise: Promise<
        Map<number, FarmScheduleRaisedBedPhotoPreview>
    >;
    mode: FarmScheduleOperationsMode;
    selectedDateKey: string;
    sessionIncarnation: string;
    userId: string;
}

function buildOperationCardData(
    operation: FarmOperation,
    raisedBeds: FarmRaisedBed[],
    plantSortById: Map<number, EntityStandardized>,
    operationDataById: Map<number, EntityStandardized>,
) {
    const operationData = operationDataById.get(operation.entityId);
    const raisedBed =
        operation.raisedBedId === null
            ? undefined
            : raisedBeds.find(
                  (candidate) => candidate.id === operation.raisedBedId,
              );
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
        ? getFieldPhysicalPositionIndex(field, raisedBeds)
        : null;
    const isFullRaisedBed =
        operationData?.attributes?.application === 'raisedBedFull';

    return {
        ...operation,
        durationMinutes: getOperationDurationMinutes(operationData),
        label: `${operationData?.information?.label ?? operation.entityId}${sort ? `: ${sort.information?.name ?? 'Nepoznato'}` : ''}`,
        positionNumber: isFullRaisedBed ? null : physicalPositionIndex,
        raisedBedLabel: raisedBed
            ? raisedBed.physicalId
                ? `Gr ${raisedBed.physicalId}`
                : `Gredica ${raisedBed.id}`
            : null,
    };
}

export function FarmScheduleOperationsSection({
    accountId,
    raisedBeds,
    scheduledOperations,
    plantSorts,
    operationsData,
    raisedBedPhotoPreviewByIdPromise,
    mode,
    selectedDateKey,
    sessionIncarnation,
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

    const visibleScheduledOperations = scheduledOperations.filter((operation) =>
        shouldDisplayScheduleOperation(
            operation,
            operationDataById.get(operation.entityId),
            mode,
        ),
    );

    if (visibleScheduledOperations.length === 0) {
        return null;
    }

    const affectedRaisedBedIds = [
        ...new Set(
            visibleScheduledOperations
                .map((operation) => operation.raisedBedId)
                .filter((id): id is number => id !== null),
        ),
    ];
    const raisedBedGroups = groupRaisedBedsForSchedule(
        raisedBeds,
        affectedRaisedBedIds,
    );
    const farmOperations = visibleScheduledOperations
        .filter(
            (operation) =>
                typeof operation.farmId === 'number' &&
                operation.raisedBedId === null,
        )
        .map((operation) =>
            buildOperationCardData(
                operation,
                raisedBeds,
                plantSortById,
                operationDataById,
            ),
        )
        .sort((left, right) =>
            left.label.localeCompare(right.label, undefined, {
                numeric: true,
            }),
        );

    const farmTotalDuration = farmOperations.reduce(
        (sum, operation) => sum + operation.durationMinutes,
        0,
    );

    if (mode === 'harvest' || mode === 'watering') {
        const groupedOperations = raisedBedGroups.flatMap(
            ({ raisedBeds: groupedRaisedBeds }) => {
                return visibleScheduledOperations
                    .filter(
                        (operation) =>
                            operation.raisedBedId !== null &&
                            groupedRaisedBeds.some(
                                (raisedBed) =>
                                    raisedBed.id === operation.raisedBedId,
                            ),
                    )
                    .map((operation) =>
                        buildOperationCardData(
                            operation,
                            groupedRaisedBeds,
                            plantSortById,
                            operationDataById,
                        ),
                    )
                    .sort((left, right) => {
                        const dateComparison = compareScheduleDates(
                            left.scheduledDate,
                            right.scheduledDate,
                        );

                        return (
                            dateComparison ||
                            left.label.localeCompare(right.label, undefined, {
                                numeric: true,
                            })
                        );
                    });
            },
        );
        const groupedTotalDuration = groupedOperations.reduce(
            (sum, operation) => sum + operation.durationMinutes,
            0,
        );
        const sectionTitle = mode === 'harvest' ? 'Berba' : 'Zalijevanje';

        return (
            <Stack spacing={2}>
                <Row spacing={2} className="items-center flex-wrap gap-y-1">
                    <Typography semiBold>{sectionTitle}</Typography>
                    <ScheduleSectionSummaryBadges
                        count={groupedOperations.length}
                        countLabel="zadataka"
                        durationMinutes={groupedTotalDuration}
                    />
                </Row>
                <Stack spacing={2}>
                    {groupedOperations.map((operation) => (
                        <FarmScheduleOperationTaskCard
                            key={operation.id}
                            completionAction={
                                <CompleteOperationModal
                                    accountId={accountId}
                                    expectedEntityId={operation.entityId}
                                    expectedTaskVersionEventId={
                                        operation.taskVersionEventId
                                    }
                                    operationId={operation.id}
                                    label={operation.label}
                                    sessionIncarnation={sessionIncarnation}
                                    userId={userId}
                                    conditions={
                                        operationDataById.get(
                                            operation.entityId,
                                        )?.conditions
                                    }
                                />
                            }
                            operation={operation}
                            operationData={operationDataById.get(
                                operation.entityId,
                            )}
                            selectedDateKey={selectedDateKey}
                            userId={userId}
                        />
                    ))}
                </Stack>
            </Stack>
        );
    }

    return (
        <Stack spacing={6}>
            {raisedBedGroups.map(
                ({ key, physicalId, raisedBeds: groupedRaisedBeds }) => {
                    const dayOperations = visibleScheduledOperations
                        .filter(
                            (operation) =>
                                operation.raisedBedId !== null &&
                                groupedRaisedBeds.some(
                                    (raisedBed) =>
                                        raisedBed.id === operation.raisedBedId,
                                ),
                        )
                        .map((operation) =>
                            buildOperationCardData(
                                operation,
                                groupedRaisedBeds,
                                plantSortById,
                                operationDataById,
                            ),
                        )
                        .sort((left, right) => {
                            const dateComparison = compareScheduleDates(
                                left.scheduledDate,
                                right.scheduledDate,
                            );
                            if (dateComparison !== 0) {
                                return dateComparison;
                            }

                            return left.label.localeCompare(
                                right.label,
                                undefined,
                                {
                                    numeric: true,
                                },
                            );
                        });

                    const totalDuration = dayOperations.reduce(
                        (sum, operation) => sum + operation.durationMinutes,
                        0,
                    );

                    return (
                        <Stack key={key} spacing={2}>
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                                <div className="min-w-0">
                                    <Suspense
                                        fallback={
                                            <RaisedBedScheduleGroupHeader
                                                physicalId={physicalId}
                                            />
                                        }
                                    >
                                        <RaisedBedScheduleGroupHeaderWithPhotos
                                            physicalId={physicalId}
                                            raisedBeds={groupedRaisedBeds}
                                            raisedBedPhotoPreviewByIdPromise={
                                                raisedBedPhotoPreviewByIdPromise
                                            }
                                        />
                                    </Suspense>
                                </div>
                                <Row
                                    spacing={2}
                                    className="justify-end text-right"
                                >
                                    <ScheduleSectionSummaryBadges
                                        count={dayOperations.length}
                                        countLabel="zadataka"
                                        durationMinutes={totalDuration}
                                    />
                                </Row>
                            </div>
                            <Stack spacing={2}>
                                {dayOperations.map((operation) => (
                                    <FarmScheduleOperationTaskCard
                                        key={operation.id}
                                        completionAction={
                                            <CompleteOperationModal
                                                accountId={accountId}
                                                expectedEntityId={
                                                    operation.entityId
                                                }
                                                expectedTaskVersionEventId={
                                                    operation.taskVersionEventId
                                                }
                                                operationId={operation.id}
                                                label={operation.label}
                                                sessionIncarnation={
                                                    sessionIncarnation
                                                }
                                                userId={userId}
                                                conditions={
                                                    operationDataById.get(
                                                        operation.entityId,
                                                    )?.conditions
                                                }
                                            />
                                        }
                                        operation={operation}
                                        operationData={operationDataById.get(
                                            operation.entityId,
                                        )}
                                        selectedDateKey={selectedDateKey}
                                        userId={userId}
                                    />
                                ))}
                            </Stack>
                        </Stack>
                    );
                },
            )}
            {farmOperations.length > 0 && (
                <Stack spacing={2}>
                    <Row spacing={2} className="items-center flex-wrap gap-y-1">
                        <Typography semiBold>Farma</Typography>
                        <ScheduleSectionSummaryBadges
                            count={farmOperations.length}
                            countLabel="zadataka"
                            durationMinutes={farmTotalDuration}
                        />
                    </Row>
                    <Stack spacing={2}>
                        {farmOperations.map((operation) => (
                            <FarmScheduleOperationTaskCard
                                key={operation.id}
                                completionAction={
                                    <CompleteOperationModal
                                        accountId={accountId}
                                        expectedEntityId={operation.entityId}
                                        expectedTaskVersionEventId={
                                            operation.taskVersionEventId
                                        }
                                        operationId={operation.id}
                                        label={operation.label}
                                        sessionIncarnation={sessionIncarnation}
                                        userId={userId}
                                        conditions={
                                            operationDataById.get(
                                                operation.entityId,
                                            )?.conditions
                                        }
                                    />
                                }
                                operation={operation}
                                operationData={operationDataById.get(
                                    operation.entityId,
                                )}
                                selectedDateKey={selectedDateKey}
                                userId={userId}
                            />
                        ))}
                    </Stack>
                </Stack>
            )}
        </Stack>
    );
}
