import { calculatePlantsPerField } from '@gredice/js/plants';
import type {
    EntityStandardized,
    RaisedBedFieldAssignableFarmUser,
} from '@gredice/storage';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Suspense } from 'react';
import { CompletePlantingModal } from './CompletePlantingModal';
import { FarmSchedulePlantingTaskCard } from './FarmSchedulePlantingTaskCard';
import { RaisedBedScheduleGroupHeader } from './RaisedBedScheduleGroupHeader';
import { RaisedBedScheduleGroupHeaderWithPhotos } from './RaisedBedScheduleGroupHeaderWithPhotos';
import { ScheduleSectionSummaryBadges } from './ScheduleSectionSummaryBadges';
import type {
    FarmScheduleDayData,
    FarmScheduleRaisedBedPhotoPreview,
} from './scheduleData';
import {
    compareScheduleDates,
    getFieldPhysicalPositionIndex,
    groupRaisedBedsForSchedule,
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
                                    const plantSort = field.plantSortId
                                        ? plantSortById.get(field.plantSortId)
                                        : undefined;

                                    return (
                                        <FarmSchedulePlantingTaskCard
                                            key={field.id}
                                            completionAction={
                                                <CompletePlantingModal
                                                    label={field.label}
                                                    raisedBedId={
                                                        field.raisedBedId
                                                    }
                                                    positionIndex={
                                                        field.positionIndex
                                                    }
                                                />
                                            }
                                            field={field}
                                            label={field.label}
                                            plantSort={plantSort}
                                            userId={userId}
                                            assignedUserByFieldIdPromise={
                                                assignedUserByFieldIdPromise
                                            }
                                        />
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
