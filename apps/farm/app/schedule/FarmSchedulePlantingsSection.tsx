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
import { FarmScheduleSelectedPlantingTaskCard } from './FarmScheduleSelectedPlantingTaskCard';
import { RaisedBedScheduleGroupHeader } from './RaisedBedScheduleGroupHeader';
import { RaisedBedScheduleGroupHeaderWithPhotos } from './RaisedBedScheduleGroupHeaderWithPhotos';
import { ScheduleSectionSummaryBadges } from './ScheduleSectionSummaryBadges';
import type {
    FarmScheduleDayData,
    FarmScheduleRaisedBedPhotoPreview,
} from './scheduleData';
import {
    buildFarmSchedulePlantingLabel,
    buildFarmScheduleSelectedPlantingLabel,
} from './schedulePlantingPresentation';
import {
    compareScheduleDates,
    getFieldPhysicalPositionIndex,
    groupRaisedBedsForSchedule,
    PLANTING_TASK_DURATION_MINUTES,
} from './scheduleShared';
import { getSchedulePlantingTaskIdentity } from './scheduleTaskIdentity';
import type { FarmScheduleSelectedPlanting } from './selectedPlantingSchedule';

type FarmRaisedBedField = FarmScheduleDayData['scheduledFields'][number];

interface FarmSchedulePlantingsSectionProps {
    raisedBeds: FarmScheduleDayData['raisedBeds'];
    scheduledFields: FarmScheduleDayData['scheduledFields'];
    scheduledSelectedPlantings: FarmScheduleSelectedPlanting[];
    plantSorts: EntityStandardized[] | null | undefined;
    userId: string;
    assignedUserByFieldIdPromise: Promise<
        Map<number, RaisedBedFieldAssignableFarmUser>
    >;
    raisedBedPhotoPreviewByIdPromise: Promise<
        Map<number, FarmScheduleRaisedBedPhotoPreview>
    >;
    selectedDateKey: string;
}

function buildFieldLabel(
    field: FarmRaisedBedField,
    plantSortById: Map<number, EntityStandardized>,
) {
    const sort = field.plantSortId
        ? plantSortById.get(field.plantSortId)
        : null;
    const seedingDistance =
        sort?.information?.plant?.attributes?.seedingDistance;
    const recommendedPlantCount =
        typeof seedingDistance === 'number'
            ? calculatePlantsPerField(
                  seedingDistance,
                  sort?.information?.name ??
                      `Plant sort #${sort?.id.toString() ?? 'unknown'}`,
              ).totalPlants
            : null;

    return buildFarmSchedulePlantingLabel({
        plantName: sort?.information?.name,
        recommendedPlantCount,
        sowingLocation: field.sowingLocation,
    });
}

export function FarmSchedulePlantingsSection({
    raisedBeds,
    scheduledFields,
    scheduledSelectedPlantings,
    plantSorts,
    userId,
    assignedUserByFieldIdPromise,
    raisedBedPhotoPreviewByIdPromise,
    selectedDateKey,
}: FarmSchedulePlantingsSectionProps) {
    if (
        scheduledFields.length === 0 &&
        scheduledSelectedPlantings.length === 0
    ) {
        return null;
    }

    const plantSortById = new Map<number, EntityStandardized>();
    if (plantSorts) {
        for (const plantSort of plantSorts) {
            plantSortById.set(plantSort.id, plantSort);
        }
    }

    const affectedRaisedBedIds = [
        ...new Set([
            ...scheduledFields.map((field) => field.raisedBedId),
            ...scheduledSelectedPlantings.flatMap(({ planting }) =>
                planting.memberships.map(
                    (membership) => membership.raisedBedField.raisedBedId,
                ),
            ),
        ]),
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
                            const plantingIdentity =
                                getSchedulePlantingTaskIdentity(field);
                            // Keep every legacy field task at its existing
                            // mutation boundary. Selected planting tasks are
                            // rendered separately and never synthesized here.
                            const physicalPositionIndex =
                                getFieldPhysicalPositionIndex(
                                    field,
                                    groupedRaisedBeds,
                                );

                            return {
                                ...field,
                                plantingIdentity,
                                physicalPositionIndex,
                                label: buildFieldLabel(field, plantSortById),
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
                    const daySelectedPlantings = scheduledSelectedPlantings
                        .filter((entry) =>
                            groupedRaisedBeds.some(
                                (raisedBed) =>
                                    raisedBed.id === entry.raisedBedId,
                            ),
                        )
                        .map((entry) => {
                            const task = entry.planting.selectedTask;
                            const plantSort = plantSortById.get(
                                entry.planting.plantSortId,
                            );
                            return {
                                ...entry,
                                label: buildFarmScheduleSelectedPlantingLabel({
                                    plantCount: entry.planting.plantCount,
                                    plantName: plantSort?.information?.name,
                                    plantsPerAxis: entry.planting.plantsPerAxis,
                                    selectedSeedingDistanceCm:
                                        entry.planting
                                            .selectedSeedingDistanceCm,
                                    sowingLocation: task?.sowingLocation,
                                    spanColumns: entry.planting.spanColumns,
                                    spanRows: entry.planting.spanRows,
                                }),
                                physicalPositionNumbers:
                                    entry.planting.memberships.map(
                                        (membership) =>
                                            getFieldPhysicalPositionIndex(
                                                {
                                                    positionIndex:
                                                        membership
                                                            .raisedBedField
                                                            .positionIndex,
                                                    raisedBedId:
                                                        membership
                                                            .raisedBedField
                                                            .raisedBedId,
                                                },
                                                groupedRaisedBeds,
                                            ),
                                    ),
                                plantSort,
                            };
                        })
                        .sort((left, right) => {
                            const dateComparison = compareScheduleDates(
                                left.planting.selectedTask?.scheduledDate,
                                right.planting.selectedTask?.scheduledDate,
                            );
                            return (
                                dateComparison ||
                                left.planting.id - right.planting.id
                            );
                        });
                    const totalDuration =
                        (dayFields.length + daySelectedPlantings.length) *
                        PLANTING_TASK_DURATION_MINUTES;

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
                                        count={
                                            dayFields.length +
                                            daySelectedPlantings.length
                                        }
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
                                    const { plantingIdentity } = field;

                                    return (
                                        <FarmSchedulePlantingTaskCard
                                            key={field.id}
                                            completionAction={
                                                plantingIdentity ? (
                                                    <CompletePlantingModal
                                                        {...plantingIdentity}
                                                        label={field.label}
                                                        raisedBedId={
                                                            field.raisedBedId
                                                        }
                                                        positionIndex={
                                                            field.positionIndex
                                                        }
                                                    />
                                                ) : undefined
                                            }
                                            field={field}
                                            label={field.label}
                                            plantingIdentity={plantingIdentity}
                                            plantSort={plantSort}
                                            positionNumber={
                                                field.physicalPositionIndex
                                            }
                                            raisedBedLabel={
                                                physicalId
                                                    ? `Gr ${physicalId}`
                                                    : `Gredica ${field.raisedBedId}`
                                            }
                                            selectedDateKey={selectedDateKey}
                                            userId={userId}
                                            assignedUserByFieldIdPromise={
                                                assignedUserByFieldIdPromise
                                            }
                                        />
                                    );
                                })}
                                {daySelectedPlantings.map((entry) => (
                                    <FarmScheduleSelectedPlantingTaskCard
                                        key={`selected-${entry.planting.id.toString()}`}
                                        label={entry.label}
                                        physicalPositionNumbers={
                                            entry.physicalPositionNumbers
                                        }
                                        planting={entry.planting}
                                        plantSort={entry.plantSort}
                                        raisedBedLabel={
                                            physicalId
                                                ? `Gr ${physicalId}`
                                                : `Gredica ${entry.raisedBedId.toString()}`
                                        }
                                        userId={userId}
                                    />
                                ))}
                            </Stack>
                        </Stack>
                    );
                },
            )}
        </Stack>
    );
}

export default FarmSchedulePlantingsSection;
