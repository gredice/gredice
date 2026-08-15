import {
    ADVANCED_SOWING_MAX_PLANTINGS_PER_FIELD,
    type AdvancedSowingCartConfigurationV1,
    type AdvancedSowingLayoutKey,
    type AdvancedSowingSelectionSummaryV1,
    advancedSowingSelectionSummaryKind,
} from '@gredice/js/plants';

export type AdvancedSowingPlanAvailability =
    | { available: true }
    | {
          available: false;
          reason:
              | 'legacy-layout-unknown'
              | 'malformed-layout'
              | 'planting-limit'
              | 'same-layout';
      };

export type LegacySowingTargetAvailability =
    | { available: true }
    | {
          available: false;
          reason: 'malformed-selected-layout' | 'selected-planting';
      };

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAdvancedSowingLayoutKey(
    value: unknown,
): value is AdvancedSowingLayoutKey {
    return (
        typeof value === 'string' &&
        /^v1:fields:\d+x\d+:plants:\d+x\d+$/u.test(value)
    );
}

function isPositiveNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    );
}

function readPositionIndices(value: unknown) {
    if (
        !Array.isArray(value) ||
        value.some(
            (positionIndex) =>
                typeof positionIndex !== 'number' ||
                !Number.isSafeInteger(positionIndex) ||
                positionIndex < 0,
        )
    ) {
        return null;
    }

    const positionIndices = Array.from(new Set<number>(value));
    return positionIndices.length === value.length ? positionIndices : null;
}

export function readAdvancedSowingSelectionSummary(
    value: unknown,
): AdvancedSowingSelectionSummaryV1 | null {
    if (
        !isRecord(value) ||
        value.kind !== advancedSowingSelectionSummaryKind ||
        value.version !== 1 ||
        !isPositiveNumber(value.selectedDistanceCm) ||
        !isAdvancedSowingLayoutKey(value.layoutKey) ||
        !isPositiveSafeInteger(value.plantCount) ||
        !isPositiveSafeInteger(value.fieldSpanRows) ||
        !isPositiveSafeInteger(value.fieldSpanColumns)
    ) {
        return null;
    }

    const occupiedPositionIndices = readPositionIndices(
        value.occupiedPositionIndices,
    );
    if (
        !occupiedPositionIndices ||
        occupiedPositionIndices.length !==
            value.fieldSpanRows * value.fieldSpanColumns
    ) {
        return null;
    }

    return {
        fieldSpanColumns: value.fieldSpanColumns,
        fieldSpanRows: value.fieldSpanRows,
        kind: advancedSowingSelectionSummaryKind,
        layoutKey: value.layoutKey,
        occupiedPositionIndices,
        plantCount: value.plantCount,
        selectedDistanceCm: value.selectedDistanceCm,
        version: 1,
    };
}

export function readAdvancedSowingCartItemSelectionSummary(item: unknown) {
    return isRecord(item)
        ? readAdvancedSowingSelectionSummary(item.advancedSowingSelection)
        : null;
}

function cartItemMatchesTarget(
    item: Record<string, unknown>,
    {
        gardenId,
        plantSortId,
        positionIndex,
        raisedBedId,
    }: {
        gardenId: number;
        plantSortId: number;
        positionIndex: number;
        raisedBedId: number;
    },
) {
    return (
        item.entityTypeName === 'plantSort' &&
        item.entityId === plantSortId.toString() &&
        item.gardenId === gardenId &&
        item.raisedBedId === raisedBedId &&
        item.positionIndex === positionIndex
    );
}

/**
 * Resolves an existing selected cart row only when its public selection
 * summary proves which Advanced Sowing row is being edited. Ambiguous rows are
 * deliberately treated as a new selection instead of mutating the wrong row.
 */
export function findAdvancedSowingCartItem<T>({
    cartItems,
    gardenId,
    layoutKey,
    plantSortId,
    positionIndex,
    raisedBedId,
    selectedCartItemId,
}: {
    cartItems: readonly T[];
    gardenId: number;
    layoutKey?: string | null;
    plantSortId: number;
    positionIndex: number;
    raisedBedId: number;
    selectedCartItemId?: number;
}): T | null {
    const matches = cartItems.filter((item) => {
        if (
            !isRecord(item) ||
            !cartItemMatchesTarget(item, {
                gardenId,
                plantSortId,
                positionIndex,
                raisedBedId,
            })
        ) {
            return false;
        }
        if (
            selectedCartItemId !== undefined &&
            item.id !== selectedCartItemId
        ) {
            return false;
        }

        const summary = readAdvancedSowingCartItemSelectionSummary(item);
        return (
            summary !== null && (!layoutKey || summary.layoutKey === layoutKey)
        );
    });

    return matches.length === 1 ? (matches[0] ?? null) : null;
}

function overlaps(
    occupiedPositionIndices: ReadonlySet<number>,
    candidatePositionIndices: readonly number[],
) {
    return candidatePositionIndices.some((positionIndex) =>
        occupiedPositionIndices.has(positionIndex),
    );
}

function readPlantingPositionIndices(planting: Record<string, unknown>) {
    if (!Array.isArray(planting.memberships)) {
        return null;
    }

    const positionIndices = planting.memberships.flatMap((membership) =>
        isRecord(membership) &&
        typeof membership.positionIndex === 'number' &&
        Number.isSafeInteger(membership.positionIndex) &&
        membership.positionIndex >= 0
            ? [membership.positionIndex]
            : [],
    );
    if (positionIndices.length !== planting.memberships.length) {
        return null;
    }

    return Array.from(new Set(positionIndices));
}

function incrementPositionCount(
    countByPositionIndex: Map<number, number>,
    positionIndex: number,
) {
    countByPositionIndex.set(
        positionIndex,
        (countByPositionIndex.get(positionIndex) ?? 0) + 1,
    );
}

/**
 * Counts persisted and pending logical plantings per physical field. Legacy
 * field rows are counted only when their first-class projection is absent.
 */
export function getRaisedBedPlantingCountsByPosition({
    cartItems,
    fields,
    gardenId,
    plantings,
    raisedBedId,
}: {
    cartItems: readonly unknown[];
    fields: unknown;
    gardenId: number;
    plantings: unknown;
    raisedBedId: number;
}) {
    const countByPositionIndex = new Map<number, number>();
    const projectedLegacyPositions = new Set<number>();

    if (Array.isArray(plantings)) {
        for (const planting of plantings) {
            if (
                !isRecord(planting) ||
                planting.isActive !== true ||
                planting.isDeleted === true
            ) {
                continue;
            }
            const positionIndices = readPlantingPositionIndices(planting);
            if (!positionIndices) {
                continue;
            }
            for (const positionIndex of positionIndices) {
                incrementPositionCount(countByPositionIndex, positionIndex);
                if (planting.configurationSource === 'legacy') {
                    projectedLegacyPositions.add(positionIndex);
                }
            }
        }
    }

    if (Array.isArray(fields)) {
        for (const field of fields) {
            if (
                !isRecord(field) ||
                field.active !== true ||
                field.isDeleted === true ||
                typeof field.plantSortId !== 'number' ||
                typeof field.positionIndex !== 'number' ||
                !Number.isSafeInteger(field.positionIndex) ||
                field.positionIndex < 0 ||
                projectedLegacyPositions.has(field.positionIndex)
            ) {
                continue;
            }
            incrementPositionCount(countByPositionIndex, field.positionIndex);
        }
    }

    for (const item of cartItems) {
        if (
            !isRecord(item) ||
            item.status !== 'new' ||
            item.entityTypeName !== 'plantSort' ||
            item.gardenId !== gardenId ||
            item.raisedBedId !== raisedBedId ||
            typeof item.amount !== 'number' ||
            item.amount <= 0
        ) {
            continue;
        }
        const summary = readAdvancedSowingCartItemSelectionSummary(item);
        if (summary) {
            for (const positionIndex of summary.occupiedPositionIndices) {
                incrementPositionCount(countByPositionIndex, positionIndex);
            }
        } else if (
            typeof item.positionIndex === 'number' &&
            Number.isSafeInteger(item.positionIndex) &&
            item.positionIndex >= 0
        ) {
            incrementPositionCount(countByPositionIndex, item.positionIndex);
        }
    }

    return countByPositionIndex;
}

/**
 * A legacy cart row has no layout key and therefore cannot safely share a
 * physical field with an active selected planting. This read-model guard is
 * intentionally independent of the customer feature flag.
 */
export function getLegacySowingTargetAvailability({
    plantings,
    positionIndex,
}: {
    plantings: unknown;
    positionIndex: number;
}): LegacySowingTargetAvailability {
    if (!Array.isArray(plantings)) {
        return { available: true };
    }

    for (const planting of plantings) {
        if (
            !isRecord(planting) ||
            planting.configurationSource !== 'selected' ||
            planting.isActive !== true ||
            planting.isDeleted === true
        ) {
            continue;
        }

        const plantingPositionIndices = readPlantingPositionIndices(planting);
        if (!plantingPositionIndices || plantingPositionIndices.length === 0) {
            return {
                available: false,
                reason: 'malformed-selected-layout',
            };
        }
        if (plantingPositionIndices.includes(positionIndex)) {
            return { available: false, reason: 'selected-planting' };
        }
    }

    return { available: true };
}

/**
 * Mirrors the persisted planting collision contract in the Garden read model:
 * an overlapping legacy/unknown layout fails closed, an equal selected layout
 * conflicts, and a different complete selected layout can share the fields.
 * Pending cart selections follow the same rule.
 */
export function getAdvancedSowingPlanAvailability({
    cartItems,
    excludedCartItemId,
    gardenId,
    legacyLayoutKeysByPlantSortId = new Map(),
    plan,
    plantings,
    raisedBedId,
}: {
    cartItems: readonly unknown[];
    excludedCartItemId?: number;
    gardenId: number;
    legacyLayoutKeysByPlantSortId?: ReadonlyMap<number, string>;
    plan: AdvancedSowingCartConfigurationV1;
    plantings: unknown;
    raisedBedId: number;
}): AdvancedSowingPlanAvailability {
    const occupiedPositionIndices = new Set(plan.occupiedPositionIndices);
    const plantingCountByPositionIndex = new Map<number, number>();

    function incrementCount(positionIndex: number) {
        plantingCountByPositionIndex.set(
            positionIndex,
            (plantingCountByPositionIndex.get(positionIndex) ?? 0) + 1,
        );
    }

    if (Array.isArray(plantings)) {
        for (const planting of plantings) {
            if (
                !isRecord(planting) ||
                planting.isActive !== true ||
                planting.isDeleted === true
            ) {
                continue;
            }

            const plantingPositionIndices =
                readPlantingPositionIndices(planting);
            if (!plantingPositionIndices) {
                return { available: false, reason: 'malformed-layout' };
            }
            if (!overlaps(occupiedPositionIndices, plantingPositionIndices)) {
                continue;
            }
            for (const positionIndex of plantingPositionIndices) {
                if (occupiedPositionIndices.has(positionIndex)) {
                    incrementCount(positionIndex);
                }
            }

            let existingLayoutKey = planting.layoutKey;
            if (planting.configurationSource === 'legacy') {
                existingLayoutKey =
                    typeof planting.plantSortId === 'number'
                        ? legacyLayoutKeysByPlantSortId.get(
                              planting.plantSortId,
                          )
                        : undefined;
            } else if (planting.configurationSource !== 'selected') {
                existingLayoutKey = undefined;
            }
            if (
                typeof existingLayoutKey !== 'string' ||
                !existingLayoutKey.trim()
            ) {
                return { available: false, reason: 'legacy-layout-unknown' };
            }
            if (existingLayoutKey === plan.layoutKey) {
                return { available: false, reason: 'same-layout' };
            }
        }
    }

    for (const item of cartItems) {
        if (
            !isRecord(item) ||
            item.status !== 'new' ||
            item.entityTypeName !== 'plantSort' ||
            item.gardenId !== gardenId ||
            item.raisedBedId !== raisedBedId ||
            item.id === excludedCartItemId
        ) {
            continue;
        }

        const summary = readAdvancedSowingCartItemSelectionSummary(item);
        if (summary) {
            const overlappingPositions = summary.occupiedPositionIndices.filter(
                (positionIndex) => occupiedPositionIndices.has(positionIndex),
            );
            if (
                overlappingPositions.length > 0 &&
                summary.layoutKey === plan.layoutKey
            ) {
                return { available: false, reason: 'same-layout' };
            }
            for (const positionIndex of overlappingPositions) {
                incrementCount(positionIndex);
            }
            continue;
        }

        if (
            typeof item.positionIndex === 'number' &&
            occupiedPositionIndices.has(item.positionIndex)
        ) {
            return { available: false, reason: 'legacy-layout-unknown' };
        }
    }

    if (
        plan.occupiedPositionIndices.some(
            (positionIndex) =>
                (plantingCountByPositionIndex.get(positionIndex) ?? 0) >=
                ADVANCED_SOWING_MAX_PLANTINGS_PER_FIELD,
        )
    ) {
        return { available: false, reason: 'planting-limit' };
    }

    return { available: true };
}
