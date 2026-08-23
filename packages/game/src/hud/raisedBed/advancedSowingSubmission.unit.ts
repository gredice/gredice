import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    advancedSowingCartAuthorizationKind,
    buildAdvancedSowingCartConfigurationV1,
    buildAdvancedSowingSelectionSummaryV1,
} from '@gredice/js/plants';
import {
    findAdvancedSowingCartItem,
    findDirectSowingCartItem,
    getAdvancedSowingPlanAvailability,
    getLegacySowingTargetAvailability,
    getPendingAdvancedSowingTargetAvailability,
    getRaisedBedPlantingCountsByPosition,
    readAdvancedSowingSelectionSummary,
} from './advancedSowingSubmission';

function plan(selectedDistanceCm = 15) {
    return buildAdvancedSowingCartConfigurationV1({
        anchorPositionIndex: 17,
        bedFieldCount: 18,
        maxDistanceCm: 60,
        minDistanceCm: 10,
        optimalDistanceCm: 30,
        selectedDistanceCm,
    });
}

function summary(selectedDistanceCm = 15) {
    return buildAdvancedSowingSelectionSummaryV1({
        kind: advancedSowingCartAuthorizationKind,
        plan: plan(selectedDistanceCm),
        version: 1,
    });
}

function cartItem({
    id,
    selectedDistanceCm,
}: {
    id: number;
    selectedDistanceCm: number;
}) {
    return {
        amount: 1,
        advancedSowingSelection: summary(selectedDistanceCm),
        entityId: '101',
        entityTypeName: 'plantSort',
        gardenId: 1,
        id,
        positionIndex: 17,
        raisedBedId: 1,
        status: 'new',
    };
}

describe('Advanced Sowing Garden submission', () => {
    it('strictly reads the public selection summary', () => {
        assert.deepEqual(
            readAdvancedSowingSelectionSummary(summary()),
            summary(),
        );
        assert.equal(
            readAdvancedSowingSelectionSummary({
                ...summary(),
                occupiedPositionIndices: [17, 17],
            }),
            null,
        );
    });

    it('uses the summary and explicit id to select one co-plant cart row', () => {
        const items = [
            cartItem({ id: 21, selectedDistanceCm: 15 }),
            cartItem({ id: 22, selectedDistanceCm: 30 }),
        ];

        assert.equal(
            findAdvancedSowingCartItem({
                cartItems: items,
                gardenId: 1,
                plantSortId: 101,
                positionIndex: 17,
                raisedBedId: 1,
                selectedCartItemId: 22,
            })?.id,
            22,
        );
        assert.equal(
            findAdvancedSowingCartItem({
                cartItems: items,
                gardenId: 1,
                plantSortId: 101,
                positionIndex: 17,
                raisedBedId: 1,
            }),
            null,
        );
    });

    it('preserves the explicitly selected row when direct sowing replaces a co-plant', () => {
        const items = [
            cartItem({ id: 21, selectedDistanceCm: 15 }),
            cartItem({ id: 22, selectedDistanceCm: 30 }),
        ];

        assert.equal(
            findDirectSowingCartItem({
                cartItems: items,
                gardenId: 1,
                positionIndex: 17,
                raisedBedId: 1,
                selectedCartItemId: 22,
            })?.id,
            22,
        );
    });

    it('fails closed for an overlapping active legacy planting', () => {
        assert.deepEqual(
            getAdvancedSowingPlanAvailability({
                cartItems: [],
                gardenId: 1,
                plan: plan(60),
                plantings: [
                    {
                        configurationSource: 'legacy',
                        isActive: true,
                        layoutKey: null,
                        memberships: [{ positionIndex: 16 }],
                    },
                ],
                raisedBedId: 1,
            }),
            { available: false, reason: 'legacy-layout-unknown' },
        );
    });

    it('blocks the same layout but permits a different selected co-plant layout', () => {
        const selectedPlan = plan(15);
        const commonInput = {
            cartItems: [],
            gardenId: 1,
            plan: selectedPlan,
            raisedBedId: 1,
        };

        assert.deepEqual(
            getAdvancedSowingPlanAvailability({
                ...commonInput,
                plantings: [
                    {
                        configurationSource: 'selected',
                        isActive: true,
                        layoutKey: selectedPlan.layoutKey,
                        memberships: [{ positionIndex: 17 }],
                    },
                ],
            }),
            { available: false, reason: 'same-layout' },
        );
        assert.deepEqual(
            getAdvancedSowingPlanAvailability({
                ...commonInput,
                plantings: [
                    {
                        configurationSource: 'selected',
                        isActive: true,
                        layoutKey: plan(30).layoutKey,
                        memberships: [{ positionIndex: 17 }],
                    },
                ],
            }),
            { available: true },
        );
    });

    it('uses the legacy plant density to permit only a different co-plant layout', () => {
        const legacyPlanting = {
            configurationSource: 'legacy',
            isActive: true,
            layoutKey: null,
            memberships: [{ positionIndex: 17 }],
            plantSortId: 101,
        };
        const legacyLayoutKeysByPlantSortId = new Map([
            [101, plan(30).layoutKey],
        ]);

        assert.deepEqual(
            getAdvancedSowingPlanAvailability({
                cartItems: [],
                gardenId: 1,
                legacyLayoutKeysByPlantSortId,
                plan: plan(15),
                plantings: [legacyPlanting],
                raisedBedId: 1,
            }),
            { available: true },
        );
        assert.deepEqual(
            getAdvancedSowingPlanAvailability({
                cartItems: [],
                gardenId: 1,
                legacyLayoutKeysByPlantSortId,
                plan: plan(30),
                plantings: [legacyPlanting],
                raisedBedId: 1,
            }),
            { available: false, reason: 'same-layout' },
        );
    });

    it('blocks a third logical planting in the same physical field', () => {
        assert.deepEqual(
            getAdvancedSowingPlanAvailability({
                cartItems: [],
                gardenId: 1,
                plan: plan(60),
                plantings: [
                    {
                        configurationSource: 'selected',
                        isActive: true,
                        layoutKey: plan(15).layoutKey,
                        memberships: [{ positionIndex: 17 }],
                    },
                    {
                        configurationSource: 'selected',
                        isActive: true,
                        layoutKey: plan(30).layoutKey,
                        memberships: [{ positionIndex: 17 }],
                    },
                ],
                raisedBedId: 1,
            }),
            { available: false, reason: 'planting-limit' },
        );
    });

    it('counts legacy projections once and includes pending selections', () => {
        const counts = getRaisedBedPlantingCountsByPosition({
            cartItems: [
                cartItem({ id: 21, selectedDistanceCm: 15 }),
                {
                    ...cartItem({ id: 22, selectedDistanceCm: 15 }),
                    gardenId: 2,
                },
            ],
            fields: [{ active: true, plantSortId: 101, positionIndex: 17 }],
            gardenId: 1,
            plantings: [
                {
                    configurationSource: 'legacy',
                    isActive: true,
                    memberships: [{ positionIndex: 17 }],
                },
            ],
            raisedBedId: 1,
        });

        assert.equal(counts.get(17), 2);
    });

    it('excludes the exact row being updated from pending-cart collisions', () => {
        const existingItem = cartItem({ id: 21, selectedDistanceCm: 15 });
        assert.deepEqual(
            getAdvancedSowingPlanAvailability({
                cartItems: [existingItem],
                excludedCartItemId: 21,
                gardenId: 1,
                plan: plan(15),
                plantings: [],
                raisedBedId: 1,
            }),
            { available: true },
        );
    });

    it('blocks a direct target covered by another pending Advanced Sowing row', () => {
        const existingItem = cartItem({ id: 21, selectedDistanceCm: 15 });

        assert.deepEqual(
            getPendingAdvancedSowingTargetAvailability({
                cartItems: [existingItem],
                gardenId: 1,
                positionIndex: 17,
                raisedBedId: 1,
            }),
            { available: false, reason: 'pending-advanced-sowing' },
        );
        assert.deepEqual(
            getPendingAdvancedSowingTargetAvailability({
                cartItems: [existingItem],
                excludedCartItemId: 21,
                gardenId: 1,
                positionIndex: 17,
                raisedBedId: 1,
            }),
            { available: true },
        );
    });

    it('blocks only legacy submission on an active selected membership', () => {
        const selectedPlantings = [
            {
                configurationSource: 'selected',
                isActive: true,
                layoutKey: plan(30).layoutKey,
                memberships: [{ positionIndex: 17 }],
            },
        ];

        assert.deepEqual(
            getLegacySowingTargetAvailability({
                plantings: selectedPlantings,
                positionIndex: 17,
            }),
            { available: false, reason: 'selected-planting' },
        );
        assert.deepEqual(
            getLegacySowingTargetAvailability({
                plantings: selectedPlantings,
                positionIndex: 16,
            }),
            { available: true },
        );

        // A different selected layout still follows the Advanced Sowing
        // co-plant contract even though the legacy path is blocked.
        assert.deepEqual(
            getAdvancedSowingPlanAvailability({
                cartItems: [],
                gardenId: 1,
                plan: plan(15),
                plantings: selectedPlantings,
                raisedBedId: 1,
            }),
            { available: true },
        );
    });

    it('fails closed when an active selected membership snapshot is malformed', () => {
        assert.deepEqual(
            getLegacySowingTargetAvailability({
                plantings: [
                    {
                        configurationSource: 'selected',
                        isActive: true,
                        memberships: [{ positionIndex: '17' }],
                    },
                ],
                positionIndex: 4,
            }),
            { available: false, reason: 'malformed-selected-layout' },
        );
    });
});
