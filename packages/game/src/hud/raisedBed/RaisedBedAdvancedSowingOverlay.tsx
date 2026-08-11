'use client';

import { plantFieldStatusLabel } from '@gredice/js/plants';
import { Sprout } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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

export function RaisedBedAdvancedSowingOverlay({
    bedFieldCount,
    gardenId,
    plantings,
    plantNames,
    raisedBedId,
}: {
    bedFieldCount: number;
    gardenId: number;
    plantings: readonly AdvancedSowingGardenPlantingVisual[];
    plantNames: readonly { id: number; name: string }[];
    raisedBedId: number;
}) {
    const [selectedPlantingId, setSelectedPlantingId] = useState<number | null>(
        null,
    );
    const groups = groupAdvancedSowingGardenPlantingsByFootprint(plantings);
    const plantNameBySortId = new Map(
        plantNames.map((plant) => [plant.id, plant.name]),
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
                const triggerLabel =
                    group.plantings.length === 1
                        ? (plantNameBySortId.get(
                              group.plantings[0]?.plantSortId ?? 0,
                          ) ?? 'Napredna sjetva')
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
                            className="max-w-xl"
                            description="Odaberite i pregledajte spremljenu naprednu sadnju."
                            modal={false}
                            onOpenChange={(open) => {
                                setSelectedPlantingId(
                                    open && group.plantings.length === 1
                                        ? (group.plantings[0]?.id ?? null)
                                        : null,
                                );
                            }}
                            title="Napredna sjetva"
                            trigger={
                                <button
                                    aria-label={`Otvori naprednu sjetvu na poljima ${positionLabels}: ${triggerLabel}`}
                                    className="pointer-events-auto absolute right-1 top-1 flex size-11 items-center justify-center rounded-full border border-emerald-800 bg-emerald-100 text-emerald-950 shadow-md transition-colors hover:bg-emerald-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2 dark:border-emerald-200 dark:bg-emerald-950 dark:text-emerald-50 dark:hover:bg-emerald-900"
                                    data-advanced-sowing-details-trigger={
                                        group.key
                                    }
                                    type="button"
                                >
                                    <Sprout
                                        aria-hidden
                                        className="size-4 shrink-0"
                                    />
                                    {group.plantings.length > 1 ? (
                                        <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-emerald-800 px-1 text-[10px] font-bold leading-4 text-white dark:bg-emerald-200 dark:text-emerald-950">
                                            {group.plantings.length}
                                        </span>
                                    ) : null}
                                </button>
                            }
                        >
                            <Stack spacing={4}>
                                <Typography
                                    level="body2"
                                    className="text-muted-foreground"
                                >
                                    Polja {positionLabels}. Svaka stavka je
                                    jedna logička sadnja sa spremljenim razmakom
                                    i gustoćom.
                                </Typography>
                                {group.plantings.length > 1 ? (
                                    <fieldset className="grid gap-2">
                                        <legend className="sr-only">
                                            Odabir sadnje
                                        </legend>
                                        {group.plantings.map((planting) => {
                                            const plantName =
                                                plantNameBySortId.get(
                                                    planting.plantSortId,
                                                ) ?? 'Nepoznata biljka';

                                            return (
                                                <button
                                                    aria-pressed={
                                                        selectedPlantingId ===
                                                        planting.id
                                                    }
                                                    className="flex min-h-11 items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/60 aria-pressed:border-emerald-700 aria-pressed:bg-emerald-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 dark:aria-pressed:bg-emerald-950/40"
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
                                                    <span className="min-w-0 font-medium">
                                                        {plantName}
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
                                        className="space-y-3 rounded-md border bg-muted/20 p-3"
                                        data-advanced-sowing-planting-id={
                                            selectedPlanting.id
                                        }
                                    >
                                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                                            <Typography
                                                component="h3"
                                                level="body1"
                                                semiBold
                                            >
                                                {plantNameBySortId.get(
                                                    selectedPlanting.plantSortId,
                                                ) ?? 'Nepoznata biljka'}
                                            </Typography>
                                        </div>
                                        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                                            <div>
                                                <dt className="text-xs text-muted-foreground">
                                                    Razmak
                                                </dt>
                                                <dd>
                                                    {selectedPlanting.selectedSeedingDistanceCm.toString()}{' '}
                                                    cm
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-muted-foreground">
                                                    Gustoća
                                                </dt>
                                                <dd>
                                                    {selectedPlanting.plantsPerAxis.toString()}{' '}
                                                    ×{' '}
                                                    {selectedPlanting.plantsPerAxis.toString()}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-muted-foreground">
                                                    Otisak
                                                </dt>
                                                <dd>
                                                    {selectedPlanting.spanRows.toString()}{' '}
                                                    ×{' '}
                                                    {selectedPlanting.spanColumns.toString()}{' '}
                                                    polja
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-muted-foreground">
                                                    Polja
                                                </dt>
                                                <dd>
                                                    {plantingFieldsLabel(
                                                        selectedPlanting,
                                                    )}
                                                </dd>
                                            </div>
                                            {selectedPlanting.lifecycleStatus ? (
                                                <div>
                                                    <dt className="text-xs text-muted-foreground">
                                                        Status
                                                    </dt>
                                                    <dd>
                                                        {
                                                            plantFieldStatusLabel(
                                                                selectedPlanting.lifecycleStatus,
                                                            ).shortLabel
                                                        }
                                                    </dd>
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
                                        ) : (
                                            <Typography
                                                className="rounded-md bg-muted px-3 py-2 text-muted-foreground"
                                                level="body3"
                                            >
                                                Zadatak sijanja trenutačno nije
                                                dostupan. Osvježi vrt za
                                                najnovije podatke.
                                            </Typography>
                                        )}
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
