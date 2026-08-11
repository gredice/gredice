import {
    readSelectedPlantingOwnerTaskSnapshot,
    type SelectedPlantingOwnerTaskSnapshot,
    type SelectedPlantingOwnerTaskStatus,
} from './selectedPlantingOwnerActions';

export type AdvancedSowingGardenPlantingInput = {
    id: number;
    anchorPositionIndex: number;
    configurationSource: 'legacy' | 'selected';
    isActive: boolean;
    layoutKey: string | null;
    layoutVersion: number;
    lifecycleStartedAt: Date | string;
    lifecycleStatus?: string | null;
    lifecycleVersionEventId?: number | null;
    memberships: readonly {
        isAnchor: boolean;
        positionIndex: number;
        relativeColumn: number;
        relativeRow: number;
    }[];
    plantCount: number | null;
    plantSortId: number;
    plantsPerAxis: number | null;
    selectedSeedingDistanceCm: number | null;
    selectedTask?: {
        scheduledDate: string | null;
        sowingLocation: 'direct' | 'greenhouse';
        status: SelectedPlantingOwnerTaskStatus;
        verification: null | { verifiedAt: Date | string };
    } | null;
    spanColumns: number;
    spanRows: number;
};

export type AdvancedSowingGardenPlantingVisual = {
    id: number;
    anchorPositionIndex: number;
    expectedLifecycleVersionEventId: number | null;
    layoutKey: string;
    lifecycleStartedAt: string | null;
    lifecycleStatus: string | null;
    memberships: Array<{
        isAnchor: boolean;
        positionIndex: number;
        relativeColumn: number;
        relativeRow: number;
    }>;
    plantCount: number;
    plantSortId: number;
    plantsPerAxis: number;
    selectedSeedingDistanceCm: number;
    selectedTask: SelectedPlantingOwnerTaskSnapshot | null;
    spanColumns: number;
    spanRows: number;
};

type ParsedAdvancedSowingGardenPlantingInput = Omit<
    AdvancedSowingGardenPlantingInput,
    'lifecycleVersionEventId' | 'selectedTask'
> & {
    lifecycleVersionEventId: number | null;
    selectedTask: SelectedPlantingOwnerTaskSnapshot | null;
};

export type AdvancedSowingGardenFootprintGroup = {
    anchorPositionIndex: number;
    key: string;
    plantings: AdvancedSowingGardenPlantingVisual[];
    positionIndices: number[];
    spanColumns: number;
    spanRows: number;
};

function isPositiveSafeInteger(value: number | null): value is number {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    );
}

function isNonNegativeSafeInteger(value: number) {
    return Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function readNullableNumber(value: unknown) {
    return typeof value === 'number' || value === null ? value : null;
}

function readNullableString(value: unknown) {
    return typeof value === 'string' || value === null ? value : null;
}

function readIsoDateString(value: Date | string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function readAdvancedSowingGardenPlantingInput(
    value: unknown,
): ParsedAdvancedSowingGardenPlantingInput | null {
    if (!isRecord(value) || !Array.isArray(value.memberships)) {
        return null;
    }
    if (
        typeof value.id !== 'number' ||
        typeof value.anchorPositionIndex !== 'number' ||
        (value.configurationSource !== 'legacy' &&
            value.configurationSource !== 'selected') ||
        typeof value.isActive !== 'boolean' ||
        (typeof value.layoutKey !== 'string' && value.layoutKey !== null) ||
        typeof value.layoutVersion !== 'number' ||
        !(
            typeof value.lifecycleStartedAt === 'string' ||
            value.lifecycleStartedAt instanceof Date
        ) ||
        typeof value.plantSortId !== 'number' ||
        typeof value.spanColumns !== 'number' ||
        typeof value.spanRows !== 'number'
    ) {
        return null;
    }

    const memberships = value.memberships.flatMap((membership) => {
        if (
            !isRecord(membership) ||
            typeof membership.isAnchor !== 'boolean' ||
            typeof membership.positionIndex !== 'number' ||
            typeof membership.relativeColumn !== 'number' ||
            typeof membership.relativeRow !== 'number'
        ) {
            return [];
        }

        return [
            {
                isAnchor: membership.isAnchor,
                positionIndex: membership.positionIndex,
                relativeColumn: membership.relativeColumn,
                relativeRow: membership.relativeRow,
            },
        ];
    });
    if (memberships.length !== value.memberships.length) {
        return null;
    }

    return {
        anchorPositionIndex: value.anchorPositionIndex,
        configurationSource: value.configurationSource,
        id: value.id,
        isActive: value.isActive,
        layoutKey: value.layoutKey,
        layoutVersion: value.layoutVersion,
        lifecycleStartedAt: value.lifecycleStartedAt,
        lifecycleStatus: readNullableString(value.lifecycleStatus),
        lifecycleVersionEventId: readNullableNumber(
            value.lifecycleVersionEventId,
        ),
        memberships,
        plantCount: readNullableNumber(value.plantCount),
        plantSortId: value.plantSortId,
        plantsPerAxis: readNullableNumber(value.plantsPerAxis),
        selectedSeedingDistanceCm: readNullableNumber(
            value.selectedSeedingDistanceCm,
        ),
        selectedTask: readSelectedPlantingOwnerTaskSnapshot(value.selectedTask),
        spanColumns: value.spanColumns,
        spanRows: value.spanRows,
    };
}

function isCompleteSelectedPlanting(
    planting: ParsedAdvancedSowingGardenPlantingInput,
    bedFieldCount: number,
) {
    if (
        planting.configurationSource !== 'selected' ||
        !planting.isActive ||
        !Number.isSafeInteger(planting.id) ||
        planting.id <= 0 ||
        !isNonNegativeSafeInteger(planting.anchorPositionIndex) ||
        planting.anchorPositionIndex >= bedFieldCount ||
        !Number.isSafeInteger(planting.plantSortId) ||
        planting.plantSortId <= 0 ||
        !isPositiveSafeInteger(planting.plantsPerAxis) ||
        !isPositiveSafeInteger(planting.plantCount) ||
        typeof planting.selectedSeedingDistanceCm !== 'number' ||
        !Number.isFinite(planting.selectedSeedingDistanceCm) ||
        planting.selectedSeedingDistanceCm <= 0 ||
        !isPositiveSafeInteger(planting.spanRows) ||
        !isPositiveSafeInteger(planting.spanColumns) ||
        planting.layoutVersion !== 1 ||
        !planting.layoutKey?.trim() ||
        planting.memberships.length !==
            planting.spanRows * planting.spanColumns ||
        planting.plantCount !== planting.plantsPerAxis ** 2
    ) {
        return false;
    }

    const positions = new Set<number>();
    const coordinates = new Set<string>();
    let anchorCount = 0;

    for (const membership of planting.memberships) {
        if (
            !isNonNegativeSafeInteger(membership.positionIndex) ||
            membership.positionIndex >= bedFieldCount ||
            !isNonNegativeSafeInteger(membership.relativeRow) ||
            membership.relativeRow >= planting.spanRows ||
            !isNonNegativeSafeInteger(membership.relativeColumn) ||
            membership.relativeColumn >= planting.spanColumns
        ) {
            return false;
        }

        positions.add(membership.positionIndex);
        coordinates.add(
            `${membership.relativeRow.toString()}:${membership.relativeColumn.toString()}`,
        );
        if (membership.isAnchor) {
            anchorCount += 1;
            if (membership.positionIndex !== planting.anchorPositionIndex) {
                return false;
            }
        }
    }

    return (
        positions.size === planting.memberships.length &&
        coordinates.size === planting.memberships.length &&
        anchorCount === 1
    );
}

/**
 * Produces one Garden visual per persisted selected planting. Every visual is
 * derived from immutable planting snapshots and memberships; current catalogue
 * spacing is deliberately not accepted by this boundary.
 */
export function buildAdvancedSowingGardenPlantingVisuals(
    value: unknown,
    bedFieldCount: number,
): AdvancedSowingGardenPlantingVisual[] {
    if (!Number.isSafeInteger(bedFieldCount) || bedFieldCount <= 0) {
        return [];
    }

    const plantings = Array.isArray(value)
        ? value.flatMap((planting) => {
              const parsed = readAdvancedSowingGardenPlantingInput(planting);
              return parsed ? [parsed] : [];
          })
        : [];
    const seenPlantingIds = new Set<number>();

    return plantings.flatMap((planting) => {
        if (
            seenPlantingIds.has(planting.id) ||
            !isCompleteSelectedPlanting(planting, bedFieldCount)
        ) {
            return [];
        }
        seenPlantingIds.add(planting.id);
        const lifecycleVersionEventId =
            planting.lifecycleVersionEventId ?? null;

        return [
            {
                anchorPositionIndex: planting.anchorPositionIndex,
                expectedLifecycleVersionEventId: isPositiveSafeInteger(
                    lifecycleVersionEventId,
                )
                    ? lifecycleVersionEventId
                    : null,
                id: planting.id,
                layoutKey: planting.layoutKey ?? '',
                lifecycleStartedAt: readIsoDateString(
                    planting.lifecycleStartedAt,
                ),
                lifecycleStatus: planting.lifecycleStatus ?? null,
                memberships: [...planting.memberships].sort(
                    (left, right) =>
                        left.relativeRow - right.relativeRow ||
                        left.relativeColumn - right.relativeColumn,
                ),
                plantCount: planting.plantCount ?? 0,
                plantSortId: planting.plantSortId,
                plantsPerAxis: planting.plantsPerAxis ?? 0,
                selectedSeedingDistanceCm:
                    planting.selectedSeedingDistanceCm ?? 0,
                selectedTask: planting.selectedTask ?? null,
                spanColumns: planting.spanColumns,
                spanRows: planting.spanRows,
            },
        ];
    });
}

export function indexAdvancedSowingPlantingsByPosition(
    plantings: readonly AdvancedSowingGardenPlantingVisual[],
) {
    const plantingsByPosition = new Map<
        number,
        AdvancedSowingGardenPlantingVisual[]
    >();

    for (const planting of plantings) {
        for (const membership of planting.memberships) {
            const existing =
                plantingsByPosition.get(membership.positionIndex) ?? [];
            existing.push(planting);
            plantingsByPosition.set(membership.positionIndex, existing);
        }
    }

    for (const positionPlantings of plantingsByPosition.values()) {
        positionPlantings.sort((left, right) => left.id - right.id);
    }

    return plantingsByPosition;
}

export function groupAdvancedSowingGardenPlantingsByFootprint(
    plantings: readonly AdvancedSowingGardenPlantingVisual[],
): AdvancedSowingGardenFootprintGroup[] {
    const groupsByFootprint = new Map<
        string,
        AdvancedSowingGardenFootprintGroup
    >();

    for (const planting of plantings) {
        const positionIndices = planting.memberships
            .map((membership) => membership.positionIndex)
            .sort((left, right) => left - right);
        const footprintKey = [
            planting.anchorPositionIndex,
            planting.spanRows,
            planting.spanColumns,
            ...positionIndices,
        ].join(':');
        const existing = groupsByFootprint.get(footprintKey);
        if (existing) {
            existing.plantings.push(planting);
            continue;
        }

        groupsByFootprint.set(footprintKey, {
            anchorPositionIndex: planting.anchorPositionIndex,
            key: footprintKey,
            plantings: [planting],
            positionIndices,
            spanColumns: planting.spanColumns,
            spanRows: planting.spanRows,
        });
    }

    return Array.from(groupsByFootprint.values())
        .map((group) => ({
            ...group,
            plantings: group.plantings.sort(
                (left, right) => left.id - right.id,
            ),
        }))
        .sort(
            (left, right) =>
                right.anchorPositionIndex - left.anchorPositionIndex ||
                left.key.localeCompare(right.key),
        );
}
