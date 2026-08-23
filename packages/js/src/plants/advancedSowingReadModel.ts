export type RaisedBedPlantingReadModelInput = {
    id: number;
    configurationSource: 'legacy' | 'selected';
    plantSortId: number;
    isActive: boolean;
    legacyPlantPlaceEventId: number | null;
    selectedSeedingDistanceCm: number | null;
    plantsPerAxis: number | null;
    plantCount: number | null;
    layoutKey: string | null;
    spanRows: number;
    spanColumns: number;
    lifecycleStartedAt: Date | string;
    lifecycleStoppedAt: Date | string | null;
    lifecycleVersionEventId: number | null;
    memberships: readonly {
        isDeleted?: boolean;
        raisedBedField: {
            isDeleted?: boolean;
            positionIndex: number;
        };
    }[];
};

export type RaisedBedPlantingReadModel = {
    id: number;
    configurationSource: 'legacy' | 'selected';
    plantSortId: number;
    isActive: boolean;
    layoutStatus: 'legacy-unknown' | 'selected' | 'selected-incomplete';
    selectedSeedingDistanceCm: number | null;
    plantsPerAxis: number | null;
    plantCount: number | null;
    spanRows: number | null;
    spanColumns: number | null;
    positionNumbers: number[];
    lifecycleStartedAt: Date | string;
    lifecycleStoppedAt: Date | string | null;
};

export type CanonicalLegacyPlantingTaskIdentity = {
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
};

function timestamp(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();

    return Number.isNaN(time) ? 0 : time;
}

function hasCompleteSelectedSnapshot(
    planting: RaisedBedPlantingReadModelInput,
) {
    return (
        planting.configurationSource === 'selected' &&
        typeof planting.selectedSeedingDistanceCm === 'number' &&
        Number.isFinite(planting.selectedSeedingDistanceCm) &&
        planting.selectedSeedingDistanceCm > 0 &&
        typeof planting.plantsPerAxis === 'number' &&
        Number.isSafeInteger(planting.plantsPerAxis) &&
        planting.plantsPerAxis > 0 &&
        typeof planting.plantCount === 'number' &&
        Number.isSafeInteger(planting.plantCount) &&
        planting.plantCount > 0 &&
        Boolean(planting.layoutKey?.trim()) &&
        Number.isSafeInteger(planting.spanRows) &&
        planting.spanRows > 0 &&
        Number.isSafeInteger(planting.spanColumns) &&
        planting.spanColumns > 0
    );
}

/**
 * Builds the operational read model strictly from planting snapshots. It does
 * not accept catalogue spacing, so historical density and footprint cannot be
 * silently recalculated after catalogue edits.
 */
export function buildRaisedBedPlantingReadModels(
    plantings: readonly RaisedBedPlantingReadModelInput[],
): RaisedBedPlantingReadModel[] {
    return plantings
        .map((planting): RaisedBedPlantingReadModel => {
            const selectedSnapshotComplete =
                hasCompleteSelectedSnapshot(planting);
            const positionNumbers = Array.from(
                new Set(
                    planting.memberships
                        .filter(
                            (membership) =>
                                !membership.isDeleted &&
                                !membership.raisedBedField.isDeleted,
                        )
                        .map(
                            (membership) =>
                                membership.raisedBedField.positionIndex + 1,
                        ),
                ),
            ).sort((left, right) => left - right);

            return {
                configurationSource: planting.configurationSource,
                id: planting.id,
                isActive: planting.isActive,
                layoutStatus:
                    planting.configurationSource === 'legacy'
                        ? 'legacy-unknown'
                        : selectedSnapshotComplete
                          ? 'selected'
                          : 'selected-incomplete',
                lifecycleStartedAt: planting.lifecycleStartedAt,
                lifecycleStoppedAt: planting.lifecycleStoppedAt,
                plantCount: selectedSnapshotComplete
                    ? planting.plantCount
                    : null,
                plantSortId: planting.plantSortId,
                plantsPerAxis: selectedSnapshotComplete
                    ? planting.plantsPerAxis
                    : null,
                positionNumbers,
                selectedSeedingDistanceCm: selectedSnapshotComplete
                    ? planting.selectedSeedingDistanceCm
                    : null,
                spanColumns: selectedSnapshotComplete
                    ? planting.spanColumns
                    : null,
                spanRows: selectedSnapshotComplete ? planting.spanRows : null,
            };
        })
        .sort(
            (left, right) =>
                Number(right.isActive) - Number(left.isActive) ||
                timestamp(right.lifecycleStartedAt) -
                    timestamp(left.lifecycleStartedAt) ||
                right.id - left.id,
        );
}

/**
 * Resolves a legacy field task to a canonical planting only when both the
 * stable cycle identity and its current version match. Selected plantings do
 * not yet have field-task lifecycle events and therefore cannot match here.
 */
export function findCanonicalLegacyPlantingForTask(
    plantings: readonly RaisedBedPlantingReadModelInput[],
    identity: CanonicalLegacyPlantingTaskIdentity | null,
) {
    if (!identity) {
        return null;
    }

    return (
        plantings.find(
            (planting) =>
                planting.configurationSource === 'legacy' &&
                planting.isActive &&
                planting.legacyPlantPlaceEventId ===
                    identity.expectedPlantCycleEventId &&
                planting.lifecycleVersionEventId ===
                    identity.expectedPlantCycleVersionEventId &&
                planting.plantSortId === identity.expectedPlantSortId,
        ) ?? null
    );
}
