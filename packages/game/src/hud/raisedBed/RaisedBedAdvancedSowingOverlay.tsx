'use client';

import { plantFieldStatusLabel } from '@gredice/js/plants';
import { PlantGridIcon } from '@gredice/ui/GridIcons';
import { Info, MapPin, Sprout } from '@gredice/ui/icons';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useState } from 'react';
import { GameModal } from '../../shared-ui/game-modal';
import {
    type AdvancedSowingGardenPlantingVisual,
    groupAdvancedSowingGardenPlantingsByFootprint,
} from './advancedSowingGardenVisuals';
import { RaisedBedSelectedPlantingOwnerControls } from './RaisedBedSelectedPlantingOwnerControls';

function plantingFieldsLabel(planting: AdvancedSowingGardenPlantingVisual) {
    return planting.memberships
        .map((membership) => membership.positionIndex + 1)
        .sort((left, right) => left - right)
        .join(', ');
}

function plantingFieldsHeading(planting: AdvancedSowingGardenPlantingVisual) {
    const fields = plantingFieldsLabel(planting);
    return planting.memberships.length === 1
        ? `Polje ${fields}`
        : `Polja ${fields}`;
}

export type AdvancedSowingPlantSortVisual = {
    coverUrl: string | null;
    id: number;
    name: string;
};

export function RaisedBedAdvancedSowingOverlay({
    bedFieldCount,
    gardenId,
    plantings,
    plantingMode = false,
    plantSorts,
    raisedBedId,
}: {
    bedFieldCount: number;
    gardenId: number;
    plantings: readonly AdvancedSowingGardenPlantingVisual[];
    plantingMode?: boolean;
    plantSorts: readonly AdvancedSowingPlantSortVisual[];
    raisedBedId: number;
}) {
    const [selectedPlantingId, setSelectedPlantingId] = useState<number | null>(
        null,
    );
    const groups = groupAdvancedSowingGardenPlantingsByFootprint(plantings);
    const plantSortById = new Map(
        plantSorts.map((plantSort) => [plantSort.id, plantSort]),
    );
    const totalRows = bedFieldCount / 3;

    if (groups.length === 0 || !Number.isSafeInteger(totalRows)) {
        return null;
    }

    return (
        <div
            className="pointer-events-none absolute inset-0 z-20 grid grid-cols-3"
            data-advanced-sowing-overlay="true"
            style={{
                gridTemplateRows: `repeat(${totalRows.toString()}, minmax(0, 1fr))`,
            }}
        >
            {groups.map((group) => {
                const anchorVisualIndex =
                    bedFieldCount - 1 - group.anchorPositionIndex;
                const gridRowStart = Math.floor(anchorVisualIndex / 3) + 1;
                const gridColumnStart = (anchorVisualIndex % 3) + 1;
                const selectedPlanting = group.plantings.find(
                    (planting) => planting.id === selectedPlantingId,
                );
                const selectedPlantSort = selectedPlanting
                    ? plantSortById.get(selectedPlanting.plantSortId)
                    : undefined;
                const triggerLabel =
                    group.plantings.length === 1
                        ? (plantSortById.get(
                              group.plantings[0]?.plantSortId ?? 0,
                          )?.name ?? 'Napredna sjetva')
                        : `${group.plantings.length.toString()} sadnje`;
                const positionLabels = group.positionIndices
                    .map((positionIndex) => positionIndex + 1)
                    .sort((left, right) => left - right)
                    .join(', ');

                return (
                    <div
                        className="pointer-events-none relative m-1 rounded-md border-2 border-emerald-700/80 bg-emerald-100/20 dark:border-emerald-300/80 dark:bg-emerald-950/20"
                        data-advanced-sowing-footprint={group.key}
                        data-advanced-sowing-membership-positions={group.positionIndices.join(
                            ',',
                        )}
                        key={group.key}
                        style={{
                            gridColumn: `${gridColumnStart.toString()} / span ${group.spanColumns.toString()}`,
                            gridRow: `${gridRowStart.toString()} / span ${group.spanRows.toString()}`,
                        }}
                    >
                        <GameModal
                            className="max-w-md"
                            description="Vizualni pregled odabrane sadnje."
                            headerDescription={
                                selectedPlanting
                                    ? plantingFieldsHeading(selectedPlanting)
                                    : 'Odaberi sadnju za prikaz'
                            }
                            headerIcon={
                                selectedPlanting ? (
                                    <PlantOrSortImage
                                        alt={
                                            selectedPlantSort?.name ??
                                            'Nepoznata biljka'
                                        }
                                        className="size-12 rounded-full object-cover"
                                        coverUrl={
                                            selectedPlantSort?.coverUrl ?? null
                                        }
                                        height={48}
                                        width={48}
                                    />
                                ) : (
                                    <Sprout className="size-6" />
                                )
                            }
                            modal={false}
                            onOpenChange={(open) => {
                                setSelectedPlantingId(
                                    open && group.plantings.length === 1
                                        ? (group.plantings[0]?.id ?? null)
                                        : null,
                                );
                            }}
                            showHeader
                            title={selectedPlantSort?.name ?? 'Sadnje u polju'}
                            trigger={
                                <button
                                    aria-label={`Otvori naprednu sjetvu na poljima ${positionLabels}: ${triggerLabel}`}
                                    className={cx(
                                        'pointer-events-auto absolute inset-0 flex items-center justify-center overflow-hidden rounded-sm transition-colors hover:bg-emerald-100/45 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2 dark:hover:bg-emerald-950/45',
                                        plantingMode && 'pointer-events-none',
                                    )}
                                    data-advanced-sowing-details-trigger={
                                        group.key
                                    }
                                    disabled={plantingMode}
                                    type="button"
                                >
                                    <span className="flex items-center justify-center -space-x-3">
                                        {group.plantings.map((planting) => {
                                            const plantSort = plantSortById.get(
                                                planting.plantSortId,
                                            );

                                            return (
                                                <span
                                                    className="flex size-16 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white p-1 shadow-md ring-1 ring-emerald-900/15"
                                                    data-advanced-sowing-field-plant={
                                                        planting.id
                                                    }
                                                    key={planting.id}
                                                >
                                                    <PlantOrSortImage
                                                        alt={
                                                            plantSort?.name ??
                                                            'Nepoznata biljka'
                                                        }
                                                        className="size-full rounded-full object-cover"
                                                        coverUrl={
                                                            plantSort?.coverUrl ??
                                                            null
                                                        }
                                                        height={56}
                                                        width={56}
                                                    />
                                                </span>
                                            );
                                        })}
                                    </span>
                                    <span className="absolute bottom-1 left-1 flex h-7 items-center gap-1 rounded-full border border-emerald-800/30 bg-white/95 px-2 text-xs font-semibold text-emerald-950 shadow-sm dark:bg-emerald-950/95 dark:text-emerald-50">
                                        {group.plantings.length === 1 ? (
                                            <>
                                                <PlantGridIcon
                                                    aria-hidden
                                                    className="size-4"
                                                    totalPlants={
                                                        group.plantings[0]
                                                            ?.plantCount ?? 1
                                                    }
                                                />
                                                {group.plantings[0]?.plantsPerAxis.toString()}{' '}
                                                ×{' '}
                                                {group.plantings[0]?.plantsPerAxis.toString()}
                                            </>
                                        ) : (
                                            <>
                                                <Sprout
                                                    aria-hidden
                                                    className="size-4"
                                                />
                                                {group.plantings.length} sadnje
                                            </>
                                        )}
                                    </span>
                                    <span className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full border border-emerald-800/30 bg-white/95 text-emerald-950 shadow-sm dark:bg-emerald-950/95 dark:text-emerald-50">
                                        <Info aria-hidden className="size-4" />
                                    </span>
                                </button>
                            }
                        >
                            <Stack spacing={4}>
                                {group.plantings.length > 1 ? (
                                    <fieldset className="grid gap-2">
                                        <legend className="sr-only">
                                            Odabir sadnje
                                        </legend>
                                        {group.plantings.map((planting) => {
                                            const plantName =
                                                plantSortById.get(
                                                    planting.plantSortId,
                                                )?.name ?? 'Nepoznata biljka';
                                            const plantSort = plantSortById.get(
                                                planting.plantSortId,
                                            );

                                            return (
                                                <button
                                                    aria-pressed={
                                                        selectedPlantingId ===
                                                        planting.id
                                                    }
                                                    className="flex min-h-14 items-center gap-3 rounded-md border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/60 aria-pressed:border-emerald-700 aria-pressed:bg-emerald-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 dark:aria-pressed:bg-emerald-950/40"
                                                    data-advanced-sowing-planting-choice={
                                                        planting.id
                                                    }
                                                    key={planting.id}
                                                    onClick={() =>
                                                        setSelectedPlantingId(
                                                            planting.id,
                                                        )
                                                    }
                                                    type="button"
                                                >
                                                    <PlantOrSortImage
                                                        alt={plantName}
                                                        className="size-10 shrink-0 rounded-full object-cover"
                                                        coverUrl={
                                                            plantSort?.coverUrl ??
                                                            null
                                                        }
                                                        height={40}
                                                        width={40}
                                                    />
                                                    <span className="min-w-0 flex-1 font-medium">
                                                        <span className="block truncate">
                                                            {plantName}
                                                        </span>
                                                        <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-muted-foreground">
                                                            <PlantGridIcon
                                                                aria-hidden
                                                                className="size-3.5"
                                                                totalPlants={
                                                                    planting.plantCount
                                                                }
                                                            />
                                                            {planting.plantsPerAxis.toString()}{' '}
                                                            ×{' '}
                                                            {planting.plantsPerAxis.toString()}
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </fieldset>
                                ) : null}
                                {group.plantings.length > 1 &&
                                !selectedPlanting ? (
                                    <Typography
                                        className="rounded-md border border-dashed px-3 py-3 text-muted-foreground"
                                        level="body2"
                                    >
                                        Odaberite sadnju za prikaz detalja.
                                    </Typography>
                                ) : null}
                                {selectedPlanting ? (
                                    <div
                                        className="space-y-4"
                                        data-advanced-sowing-planting-id={
                                            selectedPlanting.id
                                        }
                                    >
                                        <dl className="grid grid-cols-2 gap-2 text-sm">
                                            <div className="flex min-w-0 items-center gap-3 rounded-lg bg-muted/60 p-3">
                                                <PlantGridIcon
                                                    aria-hidden
                                                    className="size-7 shrink-0 text-emerald-700 dark:text-emerald-300"
                                                    totalPlants={
                                                        selectedPlanting.plantCount
                                                    }
                                                />
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-muted-foreground">
                                                        Gustoća
                                                    </dt>
                                                    <dd className="font-semibold">
                                                        {selectedPlanting.plantsPerAxis.toString()}{' '}
                                                        ×{' '}
                                                        {selectedPlanting.plantsPerAxis.toString()}
                                                    </dd>
                                                </div>
                                            </div>
                                            <div className="flex min-w-0 items-center gap-3 rounded-lg bg-muted/60 p-3">
                                                <MapPin
                                                    aria-hidden
                                                    className="size-7 shrink-0 text-emerald-700 dark:text-emerald-300"
                                                />
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-muted-foreground">
                                                        {selectedPlanting
                                                            .memberships
                                                            .length === 1
                                                            ? 'Polje'
                                                            : 'Polja'}
                                                    </dt>
                                                    <dd className="truncate font-semibold">
                                                        {plantingFieldsLabel(
                                                            selectedPlanting,
                                                        )}
                                                    </dd>
                                                </div>
                                            </div>
                                            {selectedPlanting.lifecycleStatus ? (
                                                <div className="col-span-2 flex min-w-0 items-center gap-3 rounded-lg bg-muted/60 p-3">
                                                    <Sprout
                                                        aria-hidden
                                                        className="size-7 shrink-0 text-emerald-700 dark:text-emerald-300"
                                                    />
                                                    <div className="min-w-0">
                                                        <dt className="text-xs text-muted-foreground">
                                                            Status
                                                        </dt>
                                                        <dd className="font-semibold">
                                                            {
                                                                plantFieldStatusLabel(
                                                                    selectedPlanting.lifecycleStatus,
                                                                ).shortLabel
                                                            }
                                                        </dd>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </dl>
                                        {selectedPlanting.selectedTask ? (
                                            <RaisedBedSelectedPlantingOwnerControls
                                                gardenId={gardenId}
                                                key={`${selectedPlanting.id.toString()}:${selectedPlanting.expectedLifecycleVersionEventId?.toString() ?? 'unknown'}`}
                                                planting={selectedPlanting}
                                                raisedBedId={raisedBedId}
                                            />
                                        ) : null}
                                    </div>
                                ) : null}
                            </Stack>
                        </GameModal>
                    </div>
                );
            })}
        </div>
    );
}
