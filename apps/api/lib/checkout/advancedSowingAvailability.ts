import type {
    AdvancedSowingCartAuthorizationV1,
    AdvancedSowingCartConfigurationV1,
} from '@gredice/js/plants';
import { AdvancedSowingPlanBoundaryError } from './advancedSowingPlan';

type PendingCartItem = {
    amount: number;
    entityTypeName: string;
    gardenId: number | null;
    id: number;
    positionIndex: number | null;
    raisedBedId: number | null;
    status: string;
};

type LegacySowingCartTarget = {
    cartItemId: number;
    positionIndex: number;
    raisedBedId: number;
};

type LegacySowingCartMutation = {
    amount: number;
    entityId: string;
    entityTypeName: string;
    gardenId?: number;
    hasAdvancedSowingSelection: boolean;
    hasExistingAdvancedSowingAuthorization: boolean;
    outletOfferId?: number;
    positionIndex?: number;
    raisedBedId?: number;
};

type RaisedBedPlantingAvailabilitySource = {
    configurationSource: string;
    isActive: boolean;
    isDeleted?: boolean;
    layoutKey: string | null;
    memberships: readonly unknown[];
};

export class LegacySowingSelectedPlantingConflictError extends Error {
    override readonly name = 'LegacySowingSelectedPlantingConflictError';

    constructor(
        readonly raisedBedId: number,
        readonly positionIndex: number,
    ) {
        super(
            'An active Advanced Sowing planting already occupies this raised-bed field.',
        );
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function membershipPositionIndex(value: unknown) {
    if (!isRecord(value) || value.isDeleted === true) {
        return null;
    }
    if (
        typeof value.positionIndex === 'number' &&
        Number.isSafeInteger(value.positionIndex) &&
        value.positionIndex >= 0
    ) {
        return value.positionIndex;
    }
    const raisedBedField = value.raisedBedField;
    return isRecord(raisedBedField) &&
        typeof raisedBedField.positionIndex === 'number' &&
        Number.isSafeInteger(raisedBedField.positionIndex) &&
        raisedBedField.positionIndex >= 0
        ? raisedBedField.positionIndex
        : null;
}

function overlaps(
    occupiedPositionIndices: ReadonlySet<number>,
    candidatePositionIndices: readonly number[],
) {
    return candidatePositionIndices.some((positionIndex) =>
        occupiedPositionIndices.has(positionIndex),
    );
}

function isActiveSelectedPlanting(
    planting: RaisedBedPlantingAvailabilitySource,
) {
    return (
        planting.configurationSource === 'selected' &&
        planting.isActive &&
        planting.isDeleted !== true
    );
}

/**
 * Legacy field rows have no layout identity, so they can never safely share a
 * physical field with an active selected planting. This applies independently
 * of the Advanced Sowing rollout flag because persisted occupancy remains
 * authoritative while the customer feature is disabled.
 */
export function assertLegacySowingTargetAvailable({
    plantings,
    positionIndex,
    raisedBedId,
}: {
    plantings: readonly RaisedBedPlantingAvailabilitySource[];
    positionIndex: number;
    raisedBedId: number;
}) {
    for (const planting of plantings) {
        if (!isActiveSelectedPlanting(planting)) {
            continue;
        }

        const positions = planting.memberships.map(membershipPositionIndex);
        if (
            positions.length === 0 ||
            positions.some((membershipPosition) => membershipPosition === null)
        ) {
            // A malformed active selected snapshot cannot prove that a legacy
            // target is safe, so fail closed for the whole raised bed.
            throw new LegacySowingSelectedPlantingConflictError(
                raisedBedId,
                positionIndex,
            );
        }
        if (positions.includes(positionIndex)) {
            throw new LegacySowingSelectedPlantingConflictError(
                raisedBedId,
                positionIndex,
            );
        }
    }
}

export function getLegacySowingCartTargets({
    authorizationsByCartItemId,
    cartItems,
}: {
    authorizationsByCartItemId: ReadonlyMap<
        number,
        AdvancedSowingCartAuthorizationV1
    >;
    cartItems: readonly PendingCartItem[];
}): LegacySowingCartTarget[] {
    return cartItems.flatMap((item) => {
        if (
            item.status !== 'new' ||
            item.amount <= 0 ||
            item.entityTypeName !== 'plantSort' ||
            authorizationsByCartItemId.has(item.id) ||
            item.raisedBedId === null ||
            item.positionIndex === null ||
            !Number.isSafeInteger(item.raisedBedId) ||
            item.raisedBedId <= 0 ||
            !Number.isSafeInteger(item.positionIndex) ||
            item.positionIndex < 0
        ) {
            return [];
        }

        return [
            {
                cartItemId: item.id,
                positionIndex: item.positionIndex,
                raisedBedId: item.raisedBedId,
            },
        ];
    });
}

/**
 * Resolves the physical legacy target that the ordinary cart mutation will
 * leave behind. Exact idempotent updates to an explicitly identified selected
 * row keep their server-owned authorization and are therefore excluded.
 */
export function getLegacySowingCartMutationTarget({
    existingItem,
    mutation,
}: {
    existingItem?: PendingCartItem & { entityId: string };
    mutation: LegacySowingCartMutation;
}): Omit<LegacySowingCartTarget, 'cartItemId'> | null {
    if (
        mutation.amount <= 0 ||
        mutation.hasAdvancedSowingSelection ||
        existingItem?.status === 'paid'
    ) {
        return null;
    }

    const mutationChangesAuthorizedTarget = existingItem
        ? mutation.amount !== existingItem.amount ||
          mutation.entityId !== existingItem.entityId ||
          mutation.entityTypeName !== existingItem.entityTypeName ||
          (mutation.gardenId !== undefined &&
              mutation.gardenId !== existingItem.gardenId) ||
          (mutation.raisedBedId !== undefined &&
              mutation.raisedBedId !== existingItem.raisedBedId) ||
          (mutation.positionIndex !== undefined &&
              mutation.positionIndex !== existingItem.positionIndex)
        : true;
    const keepsExistingAuthorization =
        mutation.hasExistingAdvancedSowingAuthorization &&
        mutation.outletOfferId === undefined &&
        !mutationChangesAuthorizedTarget;
    if (keepsExistingAuthorization) {
        return null;
    }

    const entityTypeName =
        existingItem?.entityTypeName ?? mutation.entityTypeName;
    const raisedBedId = existingItem?.raisedBedId ?? mutation.raisedBedId;
    const positionIndex =
        existingItem && mutation.positionIndex === undefined
            ? existingItem.positionIndex
            : mutation.positionIndex;
    if (
        entityTypeName !== 'plantSort' ||
        typeof raisedBedId !== 'number' ||
        !Number.isSafeInteger(raisedBedId) ||
        raisedBedId <= 0 ||
        typeof positionIndex !== 'number' ||
        !Number.isSafeInteger(positionIndex) ||
        positionIndex < 0
    ) {
        return null;
    }

    return { positionIndex, raisedBedId };
}

export async function assertLegacySowingCartTargetsAvailable({
    authorizationsByCartItemId,
    cartItems,
    loadPlantingsForRaisedBed,
}: {
    authorizationsByCartItemId: ReadonlyMap<
        number,
        AdvancedSowingCartAuthorizationV1
    >;
    cartItems: readonly PendingCartItem[];
    loadPlantingsForRaisedBed: (
        raisedBedId: number,
    ) => Promise<readonly RaisedBedPlantingAvailabilitySource[]>;
}) {
    const targets = getLegacySowingCartTargets({
        authorizationsByCartItemId,
        cartItems,
    });
    const plantingsByRaisedBedId = new Map(
        await Promise.all(
            Array.from(
                new Set(targets.map((target) => target.raisedBedId)),
            ).map(
                async (raisedBedId) =>
                    [
                        raisedBedId,
                        await loadPlantingsForRaisedBed(raisedBedId),
                    ] as const,
            ),
        ),
    );

    for (const target of targets) {
        assertLegacySowingTargetAvailable({
            plantings: plantingsByRaisedBedId.get(target.raisedBedId) ?? [],
            positionIndex: target.positionIndex,
            raisedBedId: target.raisedBedId,
        });
    }
}

export function assertNoBlockingLegacyPlantOperations(
    blockingPlantOperations: readonly unknown[],
) {
    if (blockingPlantOperations.length > 0) {
        throw new AdvancedSowingPlanBoundaryError('plant_operation_conflict');
    }
}

function assertActivePlantingsAvailable(
    plan: AdvancedSowingCartConfigurationV1,
    plantings: readonly RaisedBedPlantingAvailabilitySource[],
) {
    const occupiedPositionIndices = new Set(plan.occupiedPositionIndices);
    for (const planting of plantings) {
        if (!planting.isActive || planting.isDeleted === true) {
            continue;
        }
        const positions = planting.memberships.map(membershipPositionIndex);
        if (
            positions.length === 0 ||
            positions.some((positionIndex) => positionIndex === null)
        ) {
            throw new AdvancedSowingPlanBoundaryError('target_mismatch');
        }
        const validPositions = positions.filter(
            (positionIndex): positionIndex is number => positionIndex !== null,
        );
        if (!overlaps(occupiedPositionIndices, validPositions)) {
            continue;
        }
        if (
            planting.configurationSource !== 'selected' ||
            typeof planting.layoutKey !== 'string' ||
            planting.layoutKey.length === 0
        ) {
            throw new AdvancedSowingPlanBoundaryError('legacy_layout_unknown');
        }
        if (planting.layoutKey === plan.layoutKey) {
            throw new AdvancedSowingPlanBoundaryError('layout_conflict');
        }
    }
}

function assertPendingCartAvailable({
    authorizationsByCartItemId,
    cartItems,
    excludedCartItemId,
    gardenId,
    plan,
    raisedBedId,
}: {
    authorizationsByCartItemId: ReadonlyMap<
        number,
        AdvancedSowingCartAuthorizationV1
    >;
    cartItems: readonly PendingCartItem[];
    excludedCartItemId?: number;
    gardenId: number;
    plan: AdvancedSowingCartConfigurationV1;
    raisedBedId: number;
}) {
    const occupiedPositionIndices = new Set(plan.occupiedPositionIndices);
    for (const item of cartItems) {
        if (
            item.id === excludedCartItemId ||
            item.status !== 'new' ||
            item.amount <= 0 ||
            item.entityTypeName !== 'plantSort' ||
            item.gardenId !== gardenId ||
            item.raisedBedId !== raisedBedId
        ) {
            continue;
        }

        const authorization = authorizationsByCartItemId.get(item.id);
        if (!authorization) {
            if (
                item.positionIndex !== null &&
                occupiedPositionIndices.has(item.positionIndex)
            ) {
                throw new AdvancedSowingPlanBoundaryError(
                    'legacy_layout_unknown',
                );
            }
            continue;
        }
        if (
            overlaps(
                occupiedPositionIndices,
                authorization.plan.occupiedPositionIndices,
            ) &&
            authorization.plan.layoutKey === plan.layoutKey
        ) {
            throw new AdvancedSowingPlanBoundaryError('layout_conflict');
        }
    }
}

/**
 * Server-side UX/pre-pay validation. The storage creation transaction remains
 * authoritative for races that happen after this check.
 */
export function assertAdvancedSowingPlanAvailable({
    authorizationsByCartItemId,
    blockingPlantOperations = [],
    cartItems,
    excludedCartItemId,
    gardenId,
    plan,
    plantings,
    raisedBedId,
}: {
    authorizationsByCartItemId: ReadonlyMap<
        number,
        AdvancedSowingCartAuthorizationV1
    >;
    blockingPlantOperations?: readonly unknown[];
    cartItems: readonly PendingCartItem[];
    excludedCartItemId?: number;
    gardenId: number;
    plan: AdvancedSowingCartConfigurationV1;
    plantings: readonly RaisedBedPlantingAvailabilitySource[];
    raisedBedId: number;
}) {
    assertNoBlockingLegacyPlantOperations(blockingPlantOperations);
    assertActivePlantingsAvailable(plan, plantings);
    assertPendingCartAvailable({
        authorizationsByCartItemId,
        cartItems,
        excludedCartItemId,
        gardenId,
        plan,
        raisedBedId,
    });
}
