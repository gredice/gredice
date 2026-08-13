import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    type AdvancedSowingCartAuthorizationV1,
    advancedSowingCartAuthorizationKind,
    buildAdvancedSowingCartConfigurationV1,
} from '@gredice/js/plants';
import {
    assertAdvancedSowingPlanAvailable,
    assertLegacySowingCartTargetsAvailable,
    assertLegacySowingTargetAvailable,
    assertUniqueDirectSowingCartTargets,
    DuplicateDirectSowingCartTargetError,
    getLegacySowingCartMutationTarget,
    getLegacySowingCartTargets,
    LegacySowingSelectedPlantingConflictError,
} from './advancedSowingAvailability';
import { AdvancedSowingPlanBoundaryError } from './advancedSowingPlan';

function plan(selectedDistanceCm: number) {
    return buildAdvancedSowingCartConfigurationV1({
        anchorPositionIndex: 4,
        bedFieldCount: 18,
        maxDistanceCm: 60,
        minDistanceCm: 15,
        optimalDistanceCm: 30,
        selectedDistanceCm,
    });
}

function expectReason(
    operation: () => unknown,
    reason: AdvancedSowingPlanBoundaryError['reasonCode'],
) {
    assert.throws(operation, (error) => {
        assert.ok(error instanceof AdvancedSowingPlanBoundaryError);
        assert.equal(error.reasonCode, reason);
        return true;
    });
}

const commonInput = {
    authorizationsByCartItemId: new Map(),
    cartItems: [],
    gardenId: 1,
    plan: plan(15),
    plantings: [],
    raisedBedId: 2,
};

describe('Advanced Sowing server availability', () => {
    it('permits overlapping active and pending selections with a different layout', () => {
        assert.doesNotThrow(() =>
            assertAdvancedSowingPlanAvailable({
                ...commonInput,
                authorizationsByCartItemId: new Map([
                    [
                        10,
                        {
                            kind: advancedSowingCartAuthorizationKind,
                            plan: plan(30),
                            version: 1,
                        },
                    ],
                ]),
                cartItems: [
                    {
                        amount: 1,
                        entityTypeName: 'plantSort',
                        gardenId: 1,
                        id: 10,
                        positionIndex: 4,
                        raisedBedId: 2,
                        status: 'new',
                    },
                ],
                plantings: [
                    {
                        configurationSource: 'selected',
                        isActive: true,
                        layoutKey: plan(30).layoutKey,
                        memberships: [{ positionIndex: 4 }],
                    },
                ],
            }),
        );
    });

    it('rejects an overlapping active legacy or unknown layout', () => {
        expectReason(
            () =>
                assertAdvancedSowingPlanAvailable({
                    ...commonInput,
                    plantings: [
                        {
                            configurationSource: 'legacy',
                            isActive: true,
                            layoutKey: null,
                            memberships: [
                                { raisedBedField: { positionIndex: 4 } },
                            ],
                        },
                    ],
                }),
            'legacy_layout_unknown',
        );
    });

    it('rejects an equal active selected layout on any footprint field', () => {
        expectReason(
            () =>
                assertAdvancedSowingPlanAvailable({
                    ...commonInput,
                    plantings: [
                        {
                            configurationSource: 'selected',
                            isActive: true,
                            layoutKey: plan(15).layoutKey,
                            memberships: [{ positionIndex: 4 }],
                        },
                    ],
                }),
            'layout_conflict',
        );
    });

    it('rejects an overlapping pending unauthorized legacy item', () => {
        expectReason(
            () =>
                assertAdvancedSowingPlanAvailable({
                    ...commonInput,
                    cartItems: [
                        {
                            amount: 1,
                            entityTypeName: 'plantSort',
                            gardenId: 1,
                            id: 10,
                            positionIndex: 4,
                            raisedBedId: 2,
                            status: 'new',
                        },
                    ],
                }),
            'legacy_layout_unknown',
        );
    });

    it('rejects an equal overlapping pending authorization', () => {
        expectReason(
            () =>
                assertAdvancedSowingPlanAvailable({
                    ...commonInput,
                    authorizationsByCartItemId: new Map([
                        [
                            10,
                            {
                                kind: advancedSowingCartAuthorizationKind,
                                plan: plan(15),
                                version: 1,
                            },
                        ],
                    ]),
                    cartItems: [
                        {
                            amount: 1,
                            entityTypeName: 'plantSort',
                            gardenId: 1,
                            id: 10,
                            positionIndex: 4,
                            raisedBedId: 2,
                            status: 'new',
                        },
                    ],
                }),
            'layout_conflict',
        );
    });

    it('excludes the exact cart item being updated', () => {
        assert.doesNotThrow(() =>
            assertAdvancedSowingPlanAvailable({
                ...commonInput,
                cartItems: [
                    {
                        amount: 1,
                        entityTypeName: 'plantSort',
                        gardenId: 1,
                        id: 10,
                        positionIndex: 4,
                        raisedBedId: 2,
                        status: 'new',
                    },
                ],
                excludedCartItemId: 10,
            }),
        );
    });

    it('rejects a footprint with actionable legacy plant work', () => {
        expectReason(
            () =>
                assertAdvancedSowingPlanAvailable({
                    ...commonInput,
                    blockingPlantOperations: [
                        {
                            operationId: 71,
                            positionIndex: 4,
                            status: 'planned',
                        },
                    ],
                }),
            'plant_operation_conflict',
        );
    });
});

function selectedPlanting(positionIndex: number, isActive = true) {
    return {
        configurationSource: 'selected',
        isActive,
        layoutKey: plan(30).layoutKey,
        memberships: [{ raisedBedField: { positionIndex } }],
    };
}

const legacyCartItem = {
    amount: 1,
    entityTypeName: 'plantSort',
    gardenId: 1,
    id: 20,
    positionIndex: 4,
    raisedBedId: 2,
    status: 'new',
};

describe('legacy sowing selected-planting guard', () => {
    it('rejects an ordinary target in an active selected membership regardless of the rollout flag', () => {
        assert.throws(
            () =>
                assertLegacySowingTargetAvailable({
                    plantings: [selectedPlanting(4)],
                    positionIndex: 4,
                    raisedBedId: 2,
                }),
            (error) => {
                assert.ok(
                    error instanceof LegacySowingSelectedPlantingConflictError,
                );
                assert.equal(error.raisedBedId, 2);
                assert.equal(error.positionIndex, 4);
                return true;
            },
        );
    });

    it('allows inactive selected, active legacy, and non-overlapping selected memberships', () => {
        assert.doesNotThrow(() =>
            assertLegacySowingTargetAvailable({
                plantings: [
                    selectedPlanting(4, false),
                    selectedPlanting(5),
                    {
                        configurationSource: 'legacy',
                        isActive: true,
                        layoutKey: null,
                        memberships: [{ positionIndex: 4 }],
                    },
                ],
                positionIndex: 4,
                raisedBedId: 2,
            }),
        );
    });

    it('excludes authorized Advanced Sowing rows and non-pending rows from pre-pay legacy targets', () => {
        const authorization = {
            kind: advancedSowingCartAuthorizationKind,
            plan: plan(30),
            version: 1,
        } satisfies AdvancedSowingCartAuthorizationV1;
        assert.deepEqual(
            getLegacySowingCartTargets({
                authorizationsByCartItemId: new Map([[21, authorization]]),
                cartItems: [
                    legacyCartItem,
                    { ...legacyCartItem, id: 21 },
                    { ...legacyCartItem, id: 22, status: 'paid' },
                    { ...legacyCartItem, amount: 0, id: 23 },
                ],
            }),
            [{ cartItemId: 20, positionIndex: 4, raisedBedId: 2 }],
        );
    });

    it('loads each raised bed once and rejects a legacy target immediately before payment', async () => {
        const loadedRaisedBedIds: number[] = [];

        await assert.rejects(
            assertLegacySowingCartTargetsAvailable({
                authorizationsByCartItemId: new Map(),
                cartItems: [
                    legacyCartItem,
                    { ...legacyCartItem, id: 21, positionIndex: 5 },
                ],
                loadPlantingsForRaisedBed: async (raisedBedId) => {
                    loadedRaisedBedIds.push(raisedBedId);
                    return [selectedPlanting(5)];
                },
            }),
            LegacySowingSelectedPlantingConflictError,
        );
        assert.deepEqual(loadedRaisedBedIds, [2]);
    });

    it('rejects duplicate direct planting anchors before payment', () => {
        assert.throws(
            () =>
                assertUniqueDirectSowingCartTargets({
                    authorizationsByCartItemId: new Map(),
                    cartItems: [legacyCartItem, { ...legacyCartItem, id: 21 }],
                }),
            DuplicateDirectSowingCartTargetError,
        );
    });

    it('preserves an exact authorized item update but guards conversions, moves, and outlet fallback', () => {
        const existingItem = {
            ...legacyCartItem,
            entityId: '101',
        };
        const baseMutation = {
            amount: 1,
            entityId: '101',
            entityTypeName: 'plantSort',
            gardenId: 1,
            hasAdvancedSowingSelection: false,
            hasExistingAdvancedSowingAuthorization: true,
            positionIndex: 4,
            raisedBedId: 2,
        };

        assert.equal(
            getLegacySowingCartMutationTarget({
                existingItem,
                mutation: baseMutation,
            }),
            null,
        );
        assert.deepEqual(
            getLegacySowingCartMutationTarget({
                existingItem,
                mutation: { ...baseMutation, positionIndex: 5 },
            }),
            { positionIndex: 5, raisedBedId: 2 },
        );
        assert.deepEqual(
            getLegacySowingCartMutationTarget({
                existingItem,
                mutation: { ...baseMutation, outletOfferId: 9 },
            }),
            { positionIndex: 4, raisedBedId: 2 },
        );
        assert.equal(
            getLegacySowingCartMutationTarget({
                existingItem,
                mutation: { ...baseMutation, amount: 0 },
            }),
            null,
        );
    });
});
