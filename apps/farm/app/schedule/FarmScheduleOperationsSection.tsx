import type { EntityStandardized } from '@gredice/storage';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { cx } from '@gredice/ui/utils';
import { Suspense } from 'react';
import { CompleteOperationModal } from './CompleteOperationModal';
import { OperationCompletionAttachments } from './OperationCompletionAttachments';
import { OperationRequirementIcons } from './OperationRequirementIcons';
import { RaisedBedScheduleGroupHeader } from './RaisedBedScheduleGroupHeader';
import { RaisedBedScheduleGroupHeaderWithPhotos } from './RaisedBedScheduleGroupHeaderWithPhotos';
import { ScheduleSectionSummaryBadges } from './ScheduleSectionSummaryBadges';
import { ScheduleTaskAgeIndicatorChip } from './ScheduleTaskAgeIndicatorChip';
import { ScheduleTaskDateChip } from './ScheduleTaskDateChip';
import { ScheduleTaskDurationChip } from './ScheduleTaskDurationChip';
import type {
    FarmScheduleDayData,
    FarmScheduleRaisedBedPhotoPreview,
} from './scheduleData';
import {
    compareScheduleDates,
    getFieldPhysicalPositionIndex,
    getOperationDurationMinutes,
    groupRaisedBedsForSchedule,
    isOperationCompleted,
} from './scheduleShared';

type FarmRaisedBed = FarmScheduleDayData['raisedBeds'][number];
type FarmOperation = FarmScheduleDayData['scheduledOperations'][number];
type FarmOperationCardData = FarmOperation & {
    durationMinutes: number;
    label: string;
};

interface FarmScheduleOperationsSectionProps {
    raisedBeds: FarmScheduleDayData['raisedBeds'];
    scheduledOperations: FarmScheduleDayData['scheduledOperations'];
    plantSorts: EntityStandardized[] | null | undefined;
    operationsData: EntityStandardized[] | null | undefined;
    raisedBedPhotoPreviewByIdPromise: Promise<
        Map<number, FarmScheduleRaisedBedPhotoPreview>
    >;
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
        ? getFieldPhysicalPositionIndex(field, raisedBeds).toString()
        : '';
    const isFullRaisedBed =
        operationData?.attributes?.application === 'raisedBedFull';

    return `${isFullRaisedBed || !physicalPositionIndex ? '' : `${physicalPositionIndex} - `}${operationData?.information?.label ?? operation.entityId}${sort ? `: ${sort.information?.name ?? 'Nepoznato'}` : ''}`;
}

export function FarmScheduleOperationsSection({
    raisedBeds,
    scheduledOperations,
    plantSorts,
    operationsData,
    raisedBedPhotoPreviewByIdPromise,
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
    const farmOperations = scheduledOperations
        .filter(
            (operation) =>
                typeof operation.farmId === 'number' &&
                operation.raisedBedId === null,
        )
        .map((operation) => {
            const label = buildOperationLabel(
                operation,
                raisedBeds,
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

    function renderOperationCard(operation: FarmOperationCardData) {
        const completed = isOperationCompleted(operation.status);
        const operationData = operationDataById.get(operation.entityId);
        const canComplete =
            !completed &&
            (!operation.assignedUserId || operation.assignedUserId === userId);
        const attachImages = Boolean(
            operationData?.conditions?.completionAttachImages ||
                operationData?.conditions?.completionAttachImagesRequired,
        );
        const attachImagesRequired = Boolean(
            operationData?.conditions?.completionAttachImagesRequired,
        );
        const attachNotes = Boolean(
            operationData?.conditions?.completionAttachNotes ||
                operationData?.conditions?.completionAttachNotesRequired,
        );
        const attachNotesRequired = Boolean(
            operationData?.conditions?.completionAttachNotesRequired,
        );
        const showRequirementIcons =
            !completed && (attachImages || attachNotes);

        return (
            <div
                key={operation.id}
                className={cx(
                    'rounded-lg border px-3 py-2 transition-opacity',
                    completed ? 'bg-white/70 opacity-70' : 'bg-white',
                )}
            >
                <Row
                    spacing={2}
                    className="min-w-0 items-start justify-between gap-3"
                >
                    <Row spacing={2} className="min-w-0 grow items-start">
                        {completed ? (
                            <Checkbox className="size-5" checked disabled />
                        ) : canComplete ? (
                            <CompleteOperationModal
                                operationId={operation.id}
                                label={operation.label}
                                conditions={operationData?.conditions}
                            />
                        ) : (
                            <div title="Radnja je dodijeljena drugom korisniku.">
                                <Checkbox className="size-5" disabled />
                            </div>
                        )}
                        <Stack spacing={1} className="min-w-0 grow">
                            <Typography
                                className={
                                    completed
                                        ? 'line-through text-muted-foreground [overflow-wrap:anywhere]'
                                        : '[overflow-wrap:anywhere]'
                                }
                            >
                                {operation.label}
                            </Typography>
                            <Row
                                spacing={2}
                                className="items-center flex-wrap gap-y-1"
                            >
                                <ScheduleTaskDurationChip
                                    minutes={operation.durationMinutes}
                                />
                                <ScheduleTaskDateChip
                                    scheduledDate={operation.scheduledDate}
                                />
                                {!completed && (
                                    <ScheduleTaskAgeIndicatorChip
                                        scheduledDate={operation.scheduledDate}
                                    />
                                )}
                            </Row>
                        </Stack>
                    </Row>
                    {(showRequirementIcons ||
                        completed ||
                        operation.assignedUser) && (
                        <Row spacing={1} className="shrink-0 items-center">
                            {showRequirementIcons && (
                                <OperationRequirementIcons
                                    attachImages={attachImages}
                                    attachImagesRequired={attachImagesRequired}
                                    attachNotes={attachNotes}
                                    attachNotesRequired={attachNotesRequired}
                                />
                            )}
                            {completed && (
                                <OperationCompletionAttachments
                                    operationId={operation.id}
                                    notes={operation.completionNotes}
                                    imageUrls={operation.imageUrls}
                                />
                            )}
                            {operation.assignedUser && (
                                <div
                                    className="shrink-0"
                                    title={`Dodijeljeno: ${operation.assignedUser.displayName ?? operation.assignedUser.userName}`}
                                >
                                    <UserAvatar
                                        avatarUrl={
                                            operation.assignedUser.avatarUrl
                                        }
                                        displayName={
                                            operation.assignedUser
                                                .displayName ??
                                            operation.assignedUser.userName
                                        }
                                        className="size-7 rounded-full"
                                    />
                                </div>
                            )}
                        </Row>
                    )}
                </Row>
            </div>
        );
    }

    const farmTotalDuration = farmOperations.reduce(
        (sum, operation) => sum + operation.durationMinutes,
        0,
    );

    return (
        <Stack spacing={6}>
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
                                    const attachImages = Boolean(
                                        operationData?.conditions
                                            ?.completionAttachImages ||
                                            operationData?.conditions
                                                ?.completionAttachImagesRequired,
                                    );
                                    const attachImagesRequired = Boolean(
                                        operationData?.conditions
                                            ?.completionAttachImagesRequired,
                                    );
                                    const attachNotes = Boolean(
                                        operationData?.conditions
                                            ?.completionAttachNotes ||
                                            operationData?.conditions
                                                ?.completionAttachNotesRequired,
                                    );
                                    const attachNotesRequired = Boolean(
                                        operationData?.conditions
                                            ?.completionAttachNotesRequired,
                                    );
                                    const showRequirementIcons =
                                        !completed &&
                                        (attachImages || attachNotes);

                                    return (
                                        <div
                                            key={operation.id}
                                            className={cx(
                                                'rounded-lg border px-3 py-2 transition-opacity',
                                                completed
                                                    ? 'bg-white/70 opacity-70'
                                                    : 'bg-white',
                                            )}
                                        >
                                            <Row
                                                spacing={2}
                                                className="min-w-0 items-start justify-between gap-3"
                                            >
                                                <Row
                                                    spacing={2}
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
                                                        spacing={1}
                                                        className="min-w-0 grow"
                                                    >
                                                        <Typography
                                                            className={
                                                                completed
                                                                    ? 'line-through text-muted-foreground [overflow-wrap:anywhere]'
                                                                    : '[overflow-wrap:anywhere]'
                                                            }
                                                        >
                                                            {operation.label}
                                                        </Typography>
                                                        <Row
                                                            spacing={2}
                                                            className="items-center flex-wrap gap-y-1"
                                                        >
                                                            <ScheduleTaskDurationChip
                                                                minutes={
                                                                    operation.durationMinutes
                                                                }
                                                            />
                                                            <ScheduleTaskDateChip
                                                                scheduledDate={
                                                                    operation.scheduledDate
                                                                }
                                                            />
                                                            {!completed && (
                                                                <ScheduleTaskAgeIndicatorChip
                                                                    scheduledDate={
                                                                        operation.scheduledDate
                                                                    }
                                                                />
                                                            )}
                                                        </Row>
                                                    </Stack>
                                                </Row>
                                                {(showRequirementIcons ||
                                                    completed ||
                                                    operation.assignedUser) && (
                                                    <Row
                                                        spacing={1}
                                                        className="shrink-0 items-center"
                                                    >
                                                        {showRequirementIcons && (
                                                            <OperationRequirementIcons
                                                                attachImages={
                                                                    attachImages
                                                                }
                                                                attachImagesRequired={
                                                                    attachImagesRequired
                                                                }
                                                                attachNotes={
                                                                    attachNotes
                                                                }
                                                                attachNotesRequired={
                                                                    attachNotesRequired
                                                                }
                                                            />
                                                        )}
                                                        {completed && (
                                                            <OperationCompletionAttachments
                                                                operationId={
                                                                    operation.id
                                                                }
                                                                notes={
                                                                    operation.completionNotes
                                                                }
                                                                imageUrls={
                                                                    operation.imageUrls
                                                                }
                                                            />
                                                        )}
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
                                                                    className="size-7 rounded-full"
                                                                />
                                                            </div>
                                                        )}
                                                    </Row>
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
                        {farmOperations.map((operation) =>
                            renderOperationCard(operation),
                        )}
                    </Stack>
                </Stack>
            )}
        </Stack>
    );
}
