'use client';

import { useState } from 'react';
import {
    type AdvancedSowingGardenPlantingVisual,
    groupAdvancedSowingGardenPlantingsByFootprint,
    indexAdvancedSowingPlantingsByPosition,
} from './advancedSowingGardenVisuals';
import {
    RaisedBedAdvancedSowingFieldItem,
    type RaisedBedAdvancedSowingFieldSegment,
} from './RaisedBedAdvancedSowingFieldItem';
import { RaisedBedFieldItemPlanted } from './RaisedBedFieldItemPlanted';
import type { RaisedBedPlantTab } from './RaisedBedPlantTabsList';

export type AdvancedSowingPlantSortVisual = {
    coverUrl: string | null;
    id: number;
    name: string;
};

export type AdvancedSowingStandardFieldVisual = {
    plantSortId: number;
    positionIndex: number;
};

type SelectedFieldPlant = {
    groupKey: string;
    positionIndex: number;
    value: string;
};

function advancedPlantTabValue(plantingId: number) {
    return `advanced:${plantingId.toString()}`;
}

function standardPlantTabValue(positionIndex: number) {
    return `standard:${positionIndex.toString()}`;
}

export function RaisedBedAdvancedSowingOverlay({
    bedFieldCount,
    plantings,
    plantingMode = false,
    plantSorts,
    raisedBedId,
    standardFields = [],
    pendingPositionIndices = [],
}: {
    bedFieldCount: number;
    plantings: readonly AdvancedSowingGardenPlantingVisual[];
    plantingMode?: boolean;
    plantSorts: readonly AdvancedSowingPlantSortVisual[];
    raisedBedId: number;
    standardFields?: readonly AdvancedSowingStandardFieldVisual[];
    pendingPositionIndices?: readonly number[];
}) {
    const [selectedFieldPlant, setSelectedFieldPlant] =
        useState<SelectedFieldPlant | null>(null);
    const groups = groupAdvancedSowingGardenPlantingsByFootprint(plantings);
    const plantSortById = new Map(
        plantSorts.map((plantSort) => [plantSort.id, plantSort]),
    );
    const standardFieldByPosition = new Map(
        standardFields.map((field) => [field.positionIndex, field]),
    );
    const plantingsByPosition =
        indexAdvancedSowingPlantingsByPosition(plantings);
    const firstGroupByPosition = new Map<number, string>();
    for (const group of groups)
        for (const position of group.positionIndices) {
            if (!firstGroupByPosition.has(position))
                firstGroupByPosition.set(position, group.key);
        }
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
                const activeSelection =
                    selectedFieldPlant?.groupKey === group.key
                        ? selectedFieldPlant
                        : null;
                const selectedAdvancedPlanting = activeSelection
                    ? plantings.find(
                          (planting) =>
                              advancedPlantTabValue(planting.id) ===
                              activeSelection.value,
                      )
                    : undefined;
                const selectedStandardField = activeSelection
                    ? standardFieldByPosition.get(activeSelection.positionIndex)
                    : undefined;
                const isStandardFieldSelected = Boolean(
                    activeSelection &&
                        selectedStandardField &&
                        standardPlantTabValue(
                            selectedStandardField.positionIndex,
                        ) === activeSelection.value,
                );
                const tabs: RaisedBedPlantTab[] = activeSelection
                    ? [
                          ...(selectedStandardField
                              ? [
                                    {
                                        coverUrl:
                                            plantSortById.get(
                                                selectedStandardField.plantSortId,
                                            )?.coverUrl ?? null,
                                        label:
                                            plantSortById.get(
                                                selectedStandardField.plantSortId,
                                            )?.name ?? 'Nepoznata biljka',
                                        value: standardPlantTabValue(
                                            selectedStandardField.positionIndex,
                                        ),
                                    },
                                ]
                              : []),
                          ...(
                              plantingsByPosition.get(
                                  activeSelection.positionIndex,
                              ) ?? []
                          ).map((planting) => {
                              const plantSort = plantSortById.get(
                                  planting.plantSortId,
                              );
                              return {
                                  coverUrl: plantSort?.coverUrl ?? null,
                                  label: plantSort?.name ?? 'Nepoznata biljka',
                                  value: advancedPlantTabValue(planting.id),
                              };
                          }),
                      ]
                    : [];
                const selectPlant = (value: string, positionIndex: number) => {
                    setSelectedFieldPlant({
                        groupKey: group.key,
                        positionIndex,
                        value,
                    });
                };
                const selectTab = (value: string) => {
                    if (!activeSelection) {
                        return;
                    }
                    selectPlant(value, activeSelection.positionIndex);
                };

                return (
                    <div
                        className="pointer-events-none relative grid"
                        data-advanced-sowing-footprint={group.key}
                        data-advanced-sowing-membership-positions={group.positionIndices.join(
                            ',',
                        )}
                        key={group.key}
                        style={{
                            gridColumn: `${gridColumnStart.toString()} / span ${group.spanColumns.toString()}`,
                            gridRow: `${gridRowStart.toString()} / span ${group.spanRows.toString()}`,
                            gridTemplateColumns: `repeat(${group.spanColumns.toString()}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${group.spanRows.toString()}, minmax(0, 1fr))`,
                        }}
                    >
                        {group.positionIndices.map((positionIndex) => {
                            if (pendingPositionIndices.includes(positionIndex))
                                return null;
                            if (
                                firstGroupByPosition.get(positionIndex) !==
                                group.key
                            )
                                return null;
                            const visualIndex =
                                bedFieldCount - 1 - positionIndex;
                            const visualRow = Math.floor(visualIndex / 3) + 1;
                            const visualColumn = (visualIndex % 3) + 1;
                            const standardField =
                                standardFieldByPosition.get(positionIndex);
                            const standardPlantSort = standardField
                                ? plantSortById.get(standardField.plantSortId)
                                : undefined;
                            const segments: RaisedBedAdvancedSowingFieldSegment[] =
                                [
                                    ...(standardField
                                        ? [
                                              {
                                                  coverUrl:
                                                      standardPlantSort?.coverUrl ??
                                                      null,
                                                  label:
                                                      standardPlantSort?.name ??
                                                      'Nepoznata biljka',
                                                  value: standardPlantTabValue(
                                                      positionIndex,
                                                  ),
                                              },
                                          ]
                                        : []),
                                    ...(
                                        plantingsByPosition.get(
                                            positionIndex,
                                        ) ?? []
                                    ).map((planting) => {
                                        const plantSort = plantSortById.get(
                                            planting.plantSortId,
                                        );
                                        return {
                                            coverUrl:
                                                plantSort?.coverUrl ?? null,
                                            label:
                                                plantSort?.name ??
                                                'Nepoznata biljka',
                                            value: advancedPlantTabValue(
                                                planting.id,
                                            ),
                                        };
                                    }),
                                ];

                            const singlePlanting =
                                !standardField && segments.length === 1
                                    ? plantingsByPosition.get(
                                          positionIndex,
                                      )?.[0]
                                    : undefined;
                            return (
                                <div
                                    className="pointer-events-none min-h-0 min-w-0 p-0.5"
                                    key={positionIndex}
                                    style={{
                                        gridColumn:
                                            visualColumn - gridColumnStart + 1,
                                        gridRow: visualRow - gridRowStart + 1,
                                    }}
                                >
                                    {singlePlanting ? (
                                        <div
                                            className="size-full"
                                            data-advanced-sowing-field-position={
                                                positionIndex
                                            }
                                        >
                                            <RaisedBedFieldItemPlanted
                                                raisedBedId={raisedBedId}
                                                positionIndex={positionIndex}
                                                selectedPlanting={
                                                    singlePlanting
                                                }
                                                interactionDisabled={
                                                    plantingMode
                                                }
                                                open={false}
                                                onOpenChange={(open) => {
                                                    if (open)
                                                        selectPlant(
                                                            advancedPlantTabValue(
                                                                singlePlanting.id,
                                                            ),
                                                            positionIndex,
                                                        );
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <RaisedBedAdvancedSowingFieldItem
                                            disabled={plantingMode}
                                            onSelect={(value) =>
                                                selectPlant(
                                                    value,
                                                    positionIndex,
                                                )
                                            }
                                            positionIndex={positionIndex}
                                            segments={segments}
                                        />
                                    )}
                                </div>
                            );
                        })}
                        {(isStandardFieldSelected ||
                            selectedAdvancedPlanting) &&
                        activeSelection ? (
                            <RaisedBedFieldItemPlanted
                                key={activeSelection.value}
                                selectedPlanting={selectedAdvancedPlanting}
                                onOpenChange={(open) => {
                                    if (!open) {
                                        setSelectedFieldPlant(null);
                                    }
                                }}
                                open
                                plantTabs={
                                    tabs.length > 1
                                        ? {
                                              items: tabs,
                                              onValueChange: selectTab,
                                              value: activeSelection.value,
                                          }
                                        : undefined
                                }
                                positionIndex={activeSelection.positionIndex}
                                raisedBedId={raisedBedId}
                                triggerOverride={null}
                            />
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}
