import { calculatePlantsPerField } from '@gredice/js/plants';
import type {
    EntityStandardized,
    RaisedBedFieldAssignableFarmUser,
} from '@gredice/storage';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Chip } from '@gredice/ui/Chip';
import { Row } from '@gredice/ui/Row';
import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { Suspense } from 'react';
import { CompletePlantingModal } from './CompletePlantingModal';
import { PlantingAssignedUserAvatar } from './PlantingAssignedUserAvatar';
import { RaisedBedScheduleGroupHeader } from './RaisedBedScheduleGroupHeader';
import { RaisedBedScheduleGroupHeaderWithPhotos } from './RaisedBedScheduleGroupHeaderWithPhotos';
import { SchedulePlantVisual } from './SchedulePlantVisual';
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
    groupRaisedBedsForSchedule,
    isFieldApproved,
    isFieldCompleted,
    PLANTING_TASK_DURATION_MINUTES,
} from './scheduleShared';

type FarmRaisedBedField = FarmScheduleDayData['scheduledFields'][number];

interface FarmSchedulePlantingsSectionProps {
    raisedBeds: FarmScheduleDayData['raisedBeds'];
    scheduledFields: FarmScheduleDayData['scheduledFields'];
    plantSorts: EntityStandardized[] | null | undefined;
    userId: string;
    assignedUserByFieldIdPromise: Promise<
        Map<number, RaisedBedFieldAssignableFarmUser>
    >;
    raisedBedPhotoPreviewByIdPromise: Promise<
        Map<number, FarmScheduleRaisedBedPhotoPreview>
    >;
}

function buildFieldLabel(
    field: FarmRaisedBedField,
    plantSortById: Map<number, EntityStandardized>,
    physicalPositionIndex: number,
) {
    const taskName =
        field.sowingLocation === 'greenhouse'
            ? 'sijanje u stakleniku'
            : 'sijanje';
    const sort = field.plantSortId
        ? plantSortById.get(field.plantSortId)
        : null;
    if (!field.plantSortId || !sort) {
        return `${physicalPositionIndex} - ${taskName}: ? Nepoznato`;
    }

    const totalPlants = getPlantsPerFieldCount(sort);
    return `${physicalPositionIndex} - ${taskName}: ${totalPlants ?? '?'} ${sort.information?.name ?? 'Nepoznato'}`;
}

function getPlantsPerFieldCount(
    plantSort: EntityStandardized | null | undefined,
) {
    const seedingDistance =
        plantSort?.information?.plant?.attributes?.seedingDistance;
    return typeof seedingDistance === 'number'
        ? calculatePlantsPerField(seedingDistance).totalPlants
        : null;
}

export function FarmSchedulePlantingsSection({
    raisedBeds,
    scheduledFields,
    plantSorts,
    userId,
    assignedUserByFieldIdPromise,
    raisedBedPhotoPreviewByIdPromise,
}: FarmSchedulePlantingsSectionProps) {
    if (scheduledFields.length === 0) {
        return null;
    }

    const plantSortById = new Map<number, EntityStandardized>();
    if (plantSorts) {
        for (const plantSort of plantSorts) {
            plantSortById.set(plantSort.id, plantSort);
        }
    }

    const affectedRaisedBedIds = [
        ...new Set(scheduledFields.map((field) => field.raisedBedId)),
    ];
    const raisedBedGroups = groupRaisedBedsForSchedule(
        raisedBeds,
        affectedRaisedBedIds,
    );

    return (
        <Stack spacing={6}>
            {raisedBedGroups.map(
                ({ key, physicalId, raisedBeds: groupedRaisedBeds }) => {
                    const dayFields = scheduledFields
                        .filter((field) =>
                            groupedRaisedBeds.some(
                                (raisedBed) =>
                                    raisedBed.id === field.raisedBedId,
                            ),
                        )
                        .map((field) => {
                            const physicalPositionIndex =
                                getFieldPhysicalPositionIndex(
                                    field,
                                    groupedRaisedBeds,
                                );

                            return {
                                ...field,
                                physicalPositionIndex,
                                label: buildFieldLabel(
                                    field,
                                    plantSortById,
                                    physicalPositionIndex,
                                ),
                            };
                        })
                        .sort((left, right) => {
                            const dateComparison = compareScheduleDates(
                                left.plantScheduledDate,
                                right.plantScheduledDate,
                            );
                            if (dateComparison !== 0) {
                                return dateComparison;
                            }

                            return (
                                left.physicalPositionIndex -
                                right.physicalPositionIndex
                            );
                        });
                    const totalDuration =
                        dayFields.length * PLANTING_TASK_DURATION_MINUTES;

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
                                        count={dayFields.length}
                                        countLabel="sijanja"
                                        durationMinutes={totalDuration}
                                    />
                                </Row>
                            </div>
                            <Stack spacing={2}>
                                {dayFields.map((field) => {
                                    const completed = isFieldCompleted(
                                        field.plantStatus,
                                    );
                                    const approved = isFieldApproved(
                                        field.plantStatus,
                                    );
                                    const lockedByAssignment =
                                        !completed &&
                                        !!field.assignedUserId &&
                                        field.assignedUserId !== userId;
                                    const canComplete =
                                        !completed && !lockedByAssignment;
                                    const greenhouseSowing =
                                        field.sowingLocation === 'greenhouse';
                                    const plantSort = field.plantSortId
                                        ? plantSortById.get(field.plantSortId)
                                        : undefined;
                                    const statusText =
                                        !completed && !approved
                                            ? 'Nije potvrđeno'
                                            : null;

                                    return (
                                        <div
                                            key={field.id}
                                            className={cx(
                                                'rounded-lg border px-3 py-2 transition-opacity',
                                                completed
                                                    ? 'bg-white/70 opacity-70'
                                                    : 'bg-white',
                                                lockedByAssignment &&
                                                    !completed &&
                                                    'opacity-70',
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
                                                        <CompletePlantingModal
                                                            label={field.label}
                                                            raisedBedId={
                                                                field.raisedBedId
                                                            }
                                                            positionIndex={
                                                                field.positionIndex
                                                            }
                                                        />
                                                    ) : (
                                                        <div title="Sijanje je dodijeljeno drugom korisniku.">
                                                            <Checkbox
                                                                className="size-5"
                                                                disabled
                                                            />
                                                        </div>
                                                    )}
                                                    <SchedulePlantVisual
                                                        plantSort={plantSort}
                                                        label={field.label}
                                                    />
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
                                                            {field.label}
                                                        </Typography>
                                                        <Row
                                                            spacing={2}
                                                            className="items-center flex-wrap gap-y-1"
                                                        >
                                                            {statusText && (
                                                                <Typography
                                                                    level="body2"
                                                                    className="text-muted-foreground"
                                                                >
                                                                    {statusText}
                                                                </Typography>
                                                            )}
                                                            <ScheduleTaskDurationChip
                                                                minutes={
                                                                    PLANTING_TASK_DURATION_MINUTES
                                                                }
                                                            />
                                                            {greenhouseSowing && (
                                                                <Chip
                                                                    size="sm"
                                                                    color="success"
                                                                    variant="soft"
                                                                >
                                                                    Staklenik
                                                                </Chip>
                                                            )}
                                                            <ScheduleTaskDateChip
                                                                scheduledDate={
                                                                    field.plantScheduledDate
                                                                }
                                                            />
                                                            {!completed && (
                                                                <ScheduleTaskAgeIndicatorChip
                                                                    scheduledDate={
                                                                        field.plantScheduledDate
                                                                    }
                                                                />
                                                            )}
                                                        </Row>
                                                    </Stack>
                                                </Row>
                                                {field.assignedUserId && (
                                                    <Suspense
                                                        fallback={
                                                            <Skeleton className="size-7 shrink-0 rounded-full" />
                                                        }
                                                    >
                                                        <PlantingAssignedUserAvatar
                                                            assignedUserByFieldIdPromise={
                                                                assignedUserByFieldIdPromise
                                                            }
                                                            fieldId={field.id}
                                                        />
                                                    </Suspense>
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

export default FarmSchedulePlantingsSection;
