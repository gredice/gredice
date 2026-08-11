import {
    type AdvancedSowingCartConfigurationV1,
    type AdvancedSowingLayoutKey,
    type AdvancedSowingSelectionSummaryV1,
    advancedSowingSelectionSummaryKind,
} from '@gredice/js/plants';

export type AdvancedSowingPlanAvailability =
    | { available: true }
    | {
          available: false;
          reason: 'legacy-layout-unknown' | 'malformed-layout' | 'same-layout';
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
    plan,
    plantings,
    raisedBedId,
}: {
    cartItems: readonly unknown[];
    excludedCartItemId?: number;
    gardenId: number;
    plan: AdvancedSowingCartConfigurationV1;
    plantings: unknown;
    raisedBedId: number;
}): AdvancedSowingPlanAvailability {
    const occupiedPositionIndices = new Set(plan.occupiedPositionIndices);

    if (Array.isArray(plantings)) {
        for (const planting of plantings) {
            if (!isRecord(planting) || planting.isActive !== true) {
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
            if (
                planting.configurationSource !== 'selected' ||
                typeof planting.layoutKey !== 'string' ||
                !planting.layoutKey.trim()
            ) {
                return { available: false, reason: 'legacy-layout-unknown' };
            }
            if (planting.layoutKey === plan.layoutKey) {
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
            if (
                overlaps(
                    occupiedPositionIndices,
                    summary.occupiedPositionIndices,
                ) &&
                summary.layoutKey === plan.layoutKey
            ) {
                return { available: false, reason: 'same-layout' };
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

    return { available: true };
}
