import type { PlantSortData } from '@gredice/client';
import { getRaisedBedFieldGroups } from '@gredice/js/plants';
import {
    type EntityStandardized,
    getEntitiesFormatted,
    getRaisedBed,
    getRaisedBedFieldPlantCycles,
    getRaisedBedPlantOccupancy,
    isRaisedBedPlantInGreenhouse,
} from '@gredice/storage';
import { RaisedBedFieldsGrid } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { RaisedBedFieldWeedStateSelector } from '../../app/admin/raised-beds/[raisedBedId]/RaisedBedFieldWeedStateSelector';
import { NoDataPlaceholder } from '../shared/placeholders/NoDataPlaceholder';
import { raisedBedFieldCardChipClassName } from './RaisedBedFieldCard';
import { RaisedBedLegacyPlantItem } from './RaisedBedLegacyPlantItem';
import {
    RaisedBedRemovedFieldsModal,
    type RemovedFieldDetails,
} from './RaisedBedRemovedFieldsModal';
import { RaisedBedSelectedPlantItem } from './RaisedBedSelectedPlantItem';

type RaisedBedFieldPlantCycle = Awaited<
    ReturnType<typeof getRaisedBedFieldPlantCycles>
>[number];

const fieldStatusMetadata: Record<string, { label: string }> = {
    new: { label: 'Novo' },
    planned: { label: 'Planirano' },
    pendingVerification: { label: 'Čeka verifikaciju' },
    sowed: { label: 'Sijano' },
    sprouted: { label: 'Proklijalo' },
    firstFlowers: { label: 'Prvi cvjetovi' },
    firstFruitSet: { label: 'Prvi plodovi' },
    notSprouted: { label: 'Nije proklijalo' },
    died: { label: 'Uginulo' },
    ready: { label: 'Spremno' },
    harvested: { label: 'Ubrano' },
    removed: { label: 'Uklonjeno' },
};

function getStatusMeta(status?: string | null) {
    if (!status) {
        return undefined;
    }

    return fieldStatusMetadata[status] ?? { label: status };
}

function getSortLabel(sort?: PlantSortData, plantSortId?: number | null) {
    return (
        sort?.information?.name ||
        (plantSortId ? `Sorta biljke ${plantSortId}` : 'Nepoznata biljka')
    );
}

function normalizeDate(value?: Date | string | null) {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    return value;
}

function getPlantStatusDate(
    plantCycle: RaisedBedFieldPlantCycle | undefined,
    status: string,
) {
    const statusChanges = plantCycle?.statusChanges ?? [];
    for (let index = statusChanges.length - 1; index >= 0; index -= 1) {
        const statusChange = statusChanges[index];
        if (statusChange?.status === status) {
            return statusChange.occurredAt;
        }
    }

    return null;
}

interface RaisedBedFieldsTableProps {
    raisedBedId: number;
}

export async function RaisedBedFieldsTable({
    raisedBedId,
}: RaisedBedFieldsTableProps) {
    const [sortsData, raisedBed, plantCycles, operationDefinitions] =
        await Promise.all([
            getEntitiesFormatted<PlantSortData>('plantSort'),
            getRaisedBed(raisedBedId),
            getRaisedBedFieldPlantCycles(raisedBedId),
            getEntitiesFormatted<EntityStandardized>('operation'),
        ]);
    const fields = raisedBed?.fields ?? [];

    if (!raisedBed) {
        return <NoDataPlaceholder />;
    }

    const occupants = getRaisedBedPlantOccupancy(raisedBed);
    const plantCyclesByPosition = new Map<number, RaisedBedFieldPlantCycle[]>();
    for (const plantCycle of plantCycles) {
        const positionPlantCycles = plantCyclesByPosition.get(
            plantCycle.positionIndex,
        );
        if (positionPlantCycles) {
            positionPlantCycles.push(plantCycle);
        } else {
            plantCyclesByPosition.set(plantCycle.positionIndex, [plantCycle]);
        }
    }

    const highestPositionIndex = Math.max(
        8,
        ...fields.map((f) => f.positionIndex),
        ...occupants.flatMap((plant) =>
            plant.positionNumbers.map((position) => position - 1),
        ),
    );
    const orderedPositions = Array.from(
        { length: highestPositionIndex + 1 },
        (_, index) => index,
    ).sort((a, b) => b - a);

    if (orderedPositions.length === 0) {
        return <NoDataPlaceholder />;
    }

    const operationOptions = operationDefinitions
        .filter((operation) => operation.attributes?.application === 'plant')
        .map((operation) => ({
            value: String(operation.id),
            label:
                operation.information?.label ??
                operation.information?.name ??
                `Radnja #${operation.id}`,
        }));
    const groups = getRaisedBedFieldGroups(orderedPositions, occupants);
    const positionContent = new Map(
        orderedPositions.map((positionIndex) => {
            const positionPlantCycles = [
                ...(plantCyclesByPosition.get(positionIndex) ?? []),
            ].sort(
                (left, right) =>
                    new Date(right.startedAt).getTime() -
                    new Date(left.startedAt).getTime(),
            );
            const activePlantCycle = positionPlantCycles.find(
                (plantCycle) => plantCycle.active,
            );
            const field = fields.find(
                (item) =>
                    item.positionIndex === positionIndex &&
                    item.active &&
                    typeof item.plantSortId === 'number',
            );
            const moveTargetOptions = [...orderedPositions]
                .sort((a, b) => a - b)
                .filter(
                    (targetPositionIndex) =>
                        targetPositionIndex !== positionIndex &&
                        !occupants.some(
                            (plant) =>
                                plant.planting &&
                                plant.positionNumbers.includes(
                                    targetPositionIndex + 1,
                                ),
                        ),
                )
                .map((targetPositionIndex) => {
                    const targetField = fields.find(
                        (item) =>
                            item.positionIndex === targetPositionIndex &&
                            item.active &&
                            typeof item.plantSortId === 'number',
                    );
                    const targetSort = targetField?.plantSortId
                        ? sortsData?.find(
                              (item) => item.id === targetField.plantSortId,
                          )
                        : undefined;

                    return {
                        value: targetPositionIndex.toString(),
                        label: `Polje ${targetPositionIndex + 1} · ${
                            targetField
                                ? getSortLabel(
                                      targetSort,
                                      targetField.plantSortId,
                                  )
                                : 'Prazno'
                        }`,
                    };
                });
            const removedFieldsAtPosition = positionPlantCycles
                .filter((plantCycle) => !plantCycle.active)
                .map((plantCycle) => {
                    const sort = sortsData?.find(
                        (item) => item.id === plantCycle.plantSortId,
                    );
                    const statusMeta = getStatusMeta(plantCycle.plantStatus);
                    return {
                        id: plantCycle.plantPlaceEventId,
                        positionIndex: plantCycle.positionIndex,
                        plantPlaceEventId: plantCycle.plantPlaceEventId,
                        plantLabel: getSortLabel(sort, plantCycle.plantSortId),
                        plantStatusLabel: statusMeta?.label ?? null,
                        plantStatus: plantCycle.plantStatus ?? null,
                        sortData: sort,
                        createdAt: normalizeDate(plantCycle.startedAt),
                        plantScheduledDate: normalizeDate(
                            plantCycle.plantScheduledDate,
                        ),
                        plantSowDate: normalizeDate(plantCycle.plantSowDate),
                        plantGrowthDate: normalizeDate(
                            plantCycle.plantGrowthDate,
                        ),
                        plantFirstFlowersDate: normalizeDate(
                            getPlantStatusDate(plantCycle, 'firstFlowers'),
                        ),
                        plantFirstFruitSetDate: normalizeDate(
                            getPlantStatusDate(plantCycle, 'firstFruitSet'),
                        ),
                        plantReadyDate: normalizeDate(
                            plantCycle.plantReadyDate,
                        ),
                        plantHarvestedDate: normalizeDate(
                            plantCycle.plantHarvestedDate,
                        ),
                        plantDeadDate: normalizeDate(plantCycle.plantDeadDate),
                        plantRemovedDate: normalizeDate(
                            plantCycle.plantRemovedDate ?? plantCycle.endedAt,
                        ),
                    } satisfies RemovedFieldDetails;
                })
                .sort((a, b) => {
                    const dateA = a.plantRemovedDate ?? a.createdAt;
                    const dateB = b.plantRemovedDate ?? b.createdAt;
                    if (!dateA || !dateB) return 0;
                    return (
                        new Date(dateB).getTime() - new Date(dateA).getTime()
                    );
                });

            return [
                positionIndex,
                {
                    field,
                    activePlantCycle,
                    moveTargetOptions,
                    history:
                        removedFieldsAtPosition.length > 0 ? (
                            <RaisedBedRemovedFieldsModal
                                raisedBedId={raisedBedId}
                                fields={removedFieldsAtPosition}
                                targetOptions={moveTargetOptions}
                            />
                        ) : undefined,
                },
            ];
        }),
    );
    const completedPlantings = raisedBed.plantings.filter(
        (planting) =>
            planting.configurationSource === 'selected' &&
            !planting.isActive &&
            !planting.isDeleted,
    );

    return (
        <Stack spacing={3}>
            <RaisedBedFieldsGrid
                groups={groups.map((group) => ({
                    ...group,
                    fields: group.positionNumbers.map((position) => ({
                        position,
                        controls: (
                            <>
                                <RaisedBedFieldWeedStateSelector
                                    raisedBedId={raisedBedId}
                                    positionIndex={position - 1}
                                    level={
                                        fields.find(
                                            (field) =>
                                                field.positionIndex ===
                                                position - 1,
                                        )?.weedState?.level ?? 'none'
                                    }
                                    className={raisedBedFieldCardChipClassName}
                                />
                                {positionContent.get(position - 1)?.history}
                            </>
                        ),
                    })),
                    children: (
                        <>
                            {occupants
                                .filter(
                                    (plant) =>
                                        plant.planting &&
                                        plant.positionNumbers.some((position) =>
                                            group.positionNumbers.includes(
                                                position,
                                            ),
                                        ),
                                )
                                .map(
                                    (plant) =>
                                        plant.planting && (
                                            <RaisedBedSelectedPlantItem
                                                key={plant.key}
                                                planting={plant.planting}
                                                positionNumbers={
                                                    plant.positionNumbers
                                                }
                                                plantSort={sortsData.find(
                                                    (sort) =>
                                                        sort.id ===
                                                        plant.plantSortId,
                                                )}
                                                locationLabel={
                                                    isRaisedBedPlantInGreenhouse(
                                                        plant,
                                                    )
                                                        ? 'Staklenik'
                                                        : 'Gredica'
                                                }
                                                operationOptions={
                                                    operationOptions
                                                }
                                            />
                                        ),
                                )}
                            {group.positionNumbers.map((position) => {
                                const content = positionContent.get(
                                    position - 1,
                                );
                                if (
                                    !content ||
                                    (!content.field &&
                                        occupants.some((plant) =>
                                            plant.positionNumbers.includes(
                                                position,
                                            ),
                                        ))
                                )
                                    return null;
                                return (
                                    <RaisedBedLegacyPlantItem
                                        key={position}
                                        field={content.field}
                                        activePlantCycle={
                                            content.activePlantCycle
                                        }
                                        positionIndex={position - 1}
                                        plantSorts={sortsData}
                                        raisedBedId={raisedBedId}
                                        moveTargetOptions={
                                            content.moveTargetOptions
                                        }
                                    />
                                );
                            })}
                        </>
                    ),
                }))}
            />
            {completedPlantings.length > 0 && (
                <details className="rounded-md border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                        Povijest sadnji ({completedPlantings.length})
                    </summary>
                    <div className="mt-3 divide-y">
                        {completedPlantings.map((planting) => (
                            <RaisedBedSelectedPlantItem
                                key={planting.id}
                                planting={planting}
                                positionNumbers={planting.memberships
                                    .filter(
                                        (membership) => !membership.isDeleted,
                                    )
                                    .map(
                                        (membership) =>
                                            membership.raisedBedField
                                                .positionIndex + 1,
                                    )}
                                plantSort={sortsData.find(
                                    (sort) => sort.id === planting.plantSortId,
                                )}
                            />
                        ))}
                    </div>
                </details>
            )}
        </Stack>
    );
}
