import type { PlantSortData } from '@gredice/client';
import {
    getEntitiesFormatted,
    getRaisedBed,
    getRaisedBedFieldPlantCycles,
} from '@gredice/storage';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Stack } from '@gredice/ui/Stack';
import { RaisedBedFieldLocationSelector } from '../../app/admin/raised-beds/[raisedBedId]/RaisedBedFieldLocationSelector';
import { RaisedBedFieldPlantSortSelector } from '../../app/admin/raised-beds/[raisedBedId]/RaisedBedFieldPlantSortSelector';
import { RaisedBedFieldWeedStateSelector } from '../../app/admin/raised-beds/[raisedBedId]/RaisedBedFieldWeedStateSelector';
import { NoDataPlaceholder } from '../shared/placeholders/NoDataPlaceholder';
import { MoveRaisedBedFieldPlantModal } from './MoveRaisedBedFieldPlantModal';
import {
    RaisedBedFieldCard,
    RaisedBedFieldCardGrid,
    raisedBedFieldCardButtonClassName,
    raisedBedFieldCardChipClassName,
    raisedBedFieldCardSelectClassName,
} from './RaisedBedFieldCard';
import type { RaisedBedFieldDateItem } from './RaisedBedFieldDatesPopover';
import { RaisedBedFieldStatusDateChip } from './RaisedBedFieldStatusDateChip';
import {
    RaisedBedRemovedFieldsModal,
    type RemovedFieldDetails,
} from './RaisedBedRemovedFieldsModal';

type RaisedBedField = NonNullable<
    Awaited<ReturnType<typeof getRaisedBed>>
>['fields'][number];
type RaisedBedFieldPlantCycle = Awaited<
    ReturnType<typeof getRaisedBedFieldPlantCycles>
>[number];

const STATUSES_BEFORE_TRANSPLANT = new Set([
    'new',
    'planned',
    'pendingVerification',
    'sowed',
    'sprouted',
]);

function canFieldCurrentlyBeInGreenhouse(field: RaisedBedField) {
    if (
        field.active &&
        STATUSES_BEFORE_TRANSPLANT.has(field.plantStatus ?? '') &&
        !field.plantDeadDate &&
        !field.plantHarvestedDate &&
        !field.plantRemovedDate
    ) {
        return true;
    }

    return false;
}

function getCurrentLocation(field: RaisedBedField): 'greenhouse' | 'raisedBed' {
    if (
        field.sowingLocation === 'greenhouse' &&
        canFieldCurrentlyBeInGreenhouse(field)
    ) {
        return 'greenhouse';
    }

    return 'raisedBed';
}

const fieldStatusMetadata: Record<string, { label: string; icon: string }> = {
    new: { label: 'Novo', icon: '🆕' },
    planned: { label: 'Planirano', icon: '🗓️' },
    pendingVerification: { label: 'Čeka verifikaciju', icon: '🔍' },
    sowed: { label: 'Sijano', icon: '🫘' },
    sprouted: { label: 'Proklijalo', icon: '🌱' },
    firstFlowers: { label: 'Prvi cvjetovi', icon: '🌸' },
    firstFruitSet: { label: 'Prvi plodovi', icon: '🍅' },
    notSprouted: { label: 'Nije proklijalo', icon: '❌' },
    died: { label: 'Uginulo', icon: '💀' },
    ready: { label: 'Spremno', icon: '🥕' },
    harvested: { label: 'Ubrano', icon: '🌾' },
    removed: { label: 'Uklonjeno', icon: '🗑️' },
};

function getStatusMeta(status?: string | null) {
    if (!status) {
        return undefined;
    }

    return fieldStatusMetadata[status] ?? { label: status, icon: '' };
}

function getSortLabel(sort?: PlantSortData, plantSortId?: number | null) {
    return (
        sort?.information?.name ||
        (plantSortId ? `Sorta biljke ${plantSortId}` : 'Nepoznata biljka')
    );
}

function getCurrentDateKey(status?: string | null) {
    switch (status) {
        case 'planned':
            return 'plantScheduledDate';
        case 'pendingVerification':
        case 'sowed':
            return 'plantSowDate';
        case 'sprouted':
        case 'firstFlowers':
        case 'firstFruitSet':
            return 'plantGrowthDate';
        case 'ready':
            return 'plantReadyDate';
        case 'harvested':
            return 'plantHarvestedDate';
        case 'notSprouted':
        case 'died':
            return 'plantDeadDate';
        case 'removed':
            return 'plantRemovedDate';
        case 'new':
            return 'createdAt';
        default:
            return null;
    }
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

interface RaisedBedFieldsTableProps {
    raisedBedId: number;
}

export async function RaisedBedFieldsTable({
    raisedBedId,
}: RaisedBedFieldsTableProps) {
    const [sortsData, raisedBed, plantCycles] = await Promise.all([
        getEntitiesFormatted<PlantSortData>('plantSort'),
        getRaisedBed(raisedBedId),
        getRaisedBedFieldPlantCycles(raisedBedId),
    ]);
    const fields = raisedBed?.fields ?? [];

    if (!raisedBed || fields.length === 0) {
        return <NoDataPlaceholder />;
    }

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
    );
    const orderedPositions = Array.from(
        { length: highestPositionIndex + 1 },
        (_, index) => index,
    ).sort((a, b) => b - a);

    if (orderedPositions.length === 0) {
        return <NoDataPlaceholder />;
    }

    return (
        <Stack spacing={0}>
            <RaisedBedFieldCardGrid>
                {orderedPositions.map((positionIndex) => {
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
                                targetPositionIndex !== positionIndex,
                        )
                        .map((targetPositionIndex) => {
                            const targetField = fields.find(
                                (item) =>
                                    item.positionIndex ===
                                        targetPositionIndex &&
                                    item.active &&
                                    typeof item.plantSortId === 'number',
                            );
                            const targetSort = targetField?.plantSortId
                                ? sortsData?.find(
                                      (item) =>
                                          item.id === targetField.plantSortId,
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
                            const statusMeta = getStatusMeta(
                                plantCycle.plantStatus,
                            );
                            return {
                                id: plantCycle.plantPlaceEventId,
                                positionIndex: plantCycle.positionIndex,
                                plantPlaceEventId: plantCycle.plantPlaceEventId,
                                plantLabel: getSortLabel(
                                    sort,
                                    plantCycle.plantSortId,
                                ),
                                plantStatusLabel: statusMeta?.label ?? null,
                                plantStatusIcon: statusMeta?.icon ?? null,
                                sortData: sort,
                                createdAt: normalizeDate(plantCycle.startedAt),
                                plantScheduledDate: normalizeDate(
                                    plantCycle.plantScheduledDate,
                                ),
                                plantSowDate: normalizeDate(
                                    plantCycle.plantSowDate,
                                ),
                                plantGrowthDate: normalizeDate(
                                    plantCycle.plantGrowthDate,
                                ),
                                plantReadyDate: normalizeDate(
                                    plantCycle.plantReadyDate,
                                ),
                                plantHarvestedDate: normalizeDate(
                                    plantCycle.plantHarvestedDate,
                                ),
                                plantDeadDate: normalizeDate(
                                    plantCycle.plantDeadDate,
                                ),
                                plantRemovedDate: normalizeDate(
                                    plantCycle.plantRemovedDate ??
                                        plantCycle.endedAt,
                                ),
                            } satisfies RemovedFieldDetails;
                        })
                        .sort((a, b) => {
                            const dateA = a.plantRemovedDate ?? a.createdAt;
                            const dateB = b.plantRemovedDate ?? b.createdAt;
                            if (!dateA || !dateB) return 0;
                            return (
                                new Date(dateB).getTime() -
                                new Date(dateA).getTime()
                            );
                        });

                    return (
                        <RaisedBedFieldTile
                            key={positionIndex}
                            field={field}
                            activePlantCycle={activePlantCycle}
                            positionIndex={positionIndex}
                            plantSorts={sortsData ?? []}
                            raisedBedId={raisedBedId}
                            removedFields={removedFieldsAtPosition}
                            moveTargetOptions={moveTargetOptions}
                        />
                    );
                })}
            </RaisedBedFieldCardGrid>
        </Stack>
    );
}

type RaisedBedFieldTileProps = {
    field?: RaisedBedField;
    activePlantCycle?: RaisedBedFieldPlantCycle;
    positionIndex: number;
    plantSorts: PlantSortData[];
    raisedBedId: number;
    removedFields: RemovedFieldDetails[];
    moveTargetOptions: Array<{
        value: string;
        label: string;
    }>;
};

function RaisedBedFieldTile({
    field,
    activePlantCycle,
    positionIndex,
    plantSorts,
    raisedBedId,
    removedFields,
    moveTargetOptions,
}: RaisedBedFieldTileProps) {
    const sort = field?.plantSortId
        ? plantSorts.find((item) => item.id === field.plantSortId)
        : undefined;
    const plantLabel = field
        ? getSortLabel(sort, field.plantSortId)
        : 'Prazno polje';
    const currentDateKey = getCurrentDateKey(field?.plantStatus);
    const dateItems: RaisedBedFieldDateItem[] = [
        {
            key: 'createdAt',
            label: 'Stvoreno',
            value: normalizeDate(field?.createdAt),
            current: currentDateKey === 'createdAt',
        },
        {
            key: 'plantScheduledDate',
            label: 'Planirano',
            value: normalizeDate(field?.plantScheduledDate),
            current: currentDateKey === 'plantScheduledDate',
        },
        {
            key: 'plantSowDate',
            label: 'Sijano',
            value: normalizeDate(field?.plantSowDate),
            current: currentDateKey === 'plantSowDate',
        },
        {
            key: 'plantGrowthDate',
            label: 'Proklijalo',
            value: normalizeDate(field?.plantGrowthDate),
            current: currentDateKey === 'plantGrowthDate',
        },
        {
            key: 'plantReadyDate',
            label: 'Spremno',
            value: normalizeDate(field?.plantReadyDate),
            current: currentDateKey === 'plantReadyDate',
        },
        {
            key: 'plantHarvestedDate',
            label: 'Ubrano',
            value: normalizeDate(field?.plantHarvestedDate),
            current: currentDateKey === 'plantHarvestedDate',
        },
        {
            key: 'plantDeadDate',
            label: 'Uginulo',
            value: normalizeDate(field?.plantDeadDate),
            current: currentDateKey === 'plantDeadDate',
        },
        {
            key: 'plantRemovedDate',
            label: 'Uklonjeno',
            value: normalizeDate(field?.plantRemovedDate),
            current: currentDateKey === 'plantRemovedDate',
        },
    ];

    const image =
        field?.active && sort ? (
            <PlantOrSortImage
                plantSort={sort}
                alt={plantLabel}
                fill
                className="object-contain"
                sizes="(min-width: 1536px) 14rem, (min-width: 1280px) 16rem, (min-width: 768px) 18rem, 50vw"
            />
        ) : undefined;
    const locationControl =
        field?.active && field.plantSortId ? (
            <RaisedBedFieldLocationSelector
                raisedBedId={raisedBedId}
                positionIndex={positionIndex}
                sowingLocation={field.sowingLocation}
                currentLocation={getCurrentLocation(field)}
                greenhouseCurrentLocationEligible={canFieldCurrentlyBeInGreenhouse(
                    field,
                )}
                className={raisedBedFieldCardChipClassName}
            />
        ) : undefined;
    const fieldBadge =
        field?.active && activePlantCycle ? (
            <MoveRaisedBedFieldPlantModal
                raisedBedId={raisedBedId}
                sourcePositionIndex={positionIndex}
                sourcePlantPlaceEventId={activePlantCycle.plantPlaceEventId}
                sourcePlantLabel={plantLabel}
                targetOptions={moveTargetOptions}
                triggerVariant="fieldIndex"
            />
        ) : (
            <div
                className={`rounded-full px-2 py-1 text-xs font-semibold ${raisedBedFieldCardButtonClassName}`}
            >
                {positionIndex + 1}
            </div>
        );
    const historyControl =
        removedFields.length > 0 ? (
            <RaisedBedRemovedFieldsModal
                raisedBedId={raisedBedId}
                fields={removedFields}
                targetOptions={moveTargetOptions}
            />
        ) : undefined;
    const plantSortControl = (
        <RaisedBedFieldPlantSortSelector
            raisedBedId={raisedBedId}
            positionIndex={positionIndex}
            status={field?.plantStatus ?? null}
            plantSortId={field?.plantSortId}
            plantSorts={plantSorts}
            variant="plain"
            className={raisedBedFieldCardSelectClassName}
        />
    );
    const statusControl =
        field?.active && field.plantStatus ? (
            <RaisedBedFieldStatusDateChip
                raisedBedId={raisedBedId}
                positionIndex={positionIndex}
                status={field.plantStatus}
                date={dateItems.find((item) => item.current)?.value ?? null}
                dateItems={dateItems}
                className={raisedBedFieldCardButtonClassName}
            />
        ) : undefined;
    const weedControl = (
        <RaisedBedFieldWeedStateSelector
            raisedBedId={raisedBedId}
            positionIndex={positionIndex}
            level={field?.weedState?.level ?? 'none'}
            variant="plain"
            className={raisedBedFieldCardSelectClassName}
        />
    );

    return (
        <RaisedBedFieldCard
            image={image}
            locationControl={locationControl}
            fieldBadge={fieldBadge}
            historyControl={historyControl}
            plantSortControl={plantSortControl}
            statusControl={statusControl}
            weedControl={weedControl}
        />
    );
}
