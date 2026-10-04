import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    advancedSowingCartAuthorizationKind,
    buildAdvancedSowingCartConfigurationV1,
} from '@gredice/js/plants';
import {
    AdvancedSowingFulfillmentInputError,
    buildSelectedPlantingFromPaidCheckout,
    selectedPlantingAggregateIdForCartItem,
    selectedPlantingInitialCommandIdForCartItem,
} from './advancedSowingFulfillment';

function authorization({
    anchorPositionIndex = 0,
    selectedDistanceCm = 30,
}: {
    anchorPositionIndex?: number;
    selectedDistanceCm?: number;
} = {}) {
    return {
        kind: advancedSowingCartAuthorizationKind,
        plan: buildAdvancedSowingCartConfigurationV1({
            anchorPositionIndex,
            bedFieldCount: 18,
            minDistanceCm: 15,
            optimalDistanceCm: 30,
            maxDistanceCm: 60,
            selectedDistanceCm,
        }),
        version: 1 as const,
    };
}

function fields() {
    return Array.from({ length: 18 }, (_, positionIndex) => ({
        id: 100 + positionIndex,
        positionIndex,
    }));
}

describe('Advanced Sowing paid checkout fulfillment', () => {
    it('builds a deterministic one-field density planting', () => {
        const input = buildSelectedPlantingFromPaidCheckout({
            authorization: authorization({ selectedDistanceCm: 15 }),
            bedFieldCount: 18,
            cartItemId: 42,
            fields: fields(),
            plantSortId: 101,
            positionIndex: 0,
            purchase: {
                cartItemId: 42,
                currency: 'sunflower',
                sunflowerAmount: 250,
            },
            raisedBedId: 7,
            scheduledDate: '2026-08-20',
            sowingLocation: 'direct',
        });

        assert.equal(
            input.eventAggregateId,
            'raised-bed-planting:cart-item:42',
        );
        assert.equal(input.plantCount, 4);
        assert.equal(input.plantsPerAxis, 2);
        assert.equal(input.spanRows, 1);
        assert.equal(input.spanColumns, 1);
        assert.deepEqual(input.memberships, [
            {
                isAnchor: true,
                raisedBedFieldId: 100,
                relativeColumn: 0,
                relativeRow: 0,
            },
        ]);
        assert.equal(
            input.lifecycleStarted.scheduledDate,
            '2026-08-20T00:00:00.000Z',
        );
        assert.deepEqual(input.lifecycleStarted.purchase, {
            cartItemId: 42,
            currency: 'sunflower',
            sunflowerAmount: 250,
        });
    });

    it('maps one 2x2 planting to four row-major memberships', () => {
        const input = buildSelectedPlantingFromPaidCheckout({
            authorization: authorization({
                anchorPositionIndex: 4,
                selectedDistanceCm: 60,
            }),
            bedFieldCount: 18,
            cartItemId: 77,
            fields: fields(),
            plantSortId: 202,
            positionIndex: 4,
            raisedBedId: 8,
            scheduledDate: null,
            sowingLocation: 'greenhouse',
        });

        assert.equal(input.plantCount, 1);
        assert.equal(input.spanRows, 2);
        assert.equal(input.spanColumns, 2);
        assert.deepEqual(input.memberships, [
            {
                isAnchor: true,
                raisedBedFieldId: 104,
                relativeColumn: 0,
                relativeRow: 0,
            },
            {
                isAnchor: false,
                raisedBedFieldId: 103,
                relativeColumn: 1,
                relativeRow: 0,
            },
            {
                isAnchor: false,
                raisedBedFieldId: 101,
                relativeColumn: 0,
                relativeRow: 1,
            },
            {
                isAnchor: false,
                raisedBedFieldId: 100,
                relativeColumn: 1,
                relativeRow: 1,
            },
        ]);
    });

    it('uses stable aggregate and UUID command identities for retries', () => {
        assert.equal(
            selectedPlantingAggregateIdForCartItem(42),
            selectedPlantingAggregateIdForCartItem(42),
        );
        const first = selectedPlantingInitialCommandIdForCartItem(42);
        assert.equal(first, selectedPlantingInitialCommandIdForCartItem(42));
        assert.match(first, /^[0-9a-f-]{36}$/u);
        assert.notEqual(first, selectedPlantingInitialCommandIdForCartItem(43));
    });

    it('fails closed when the paid bed geometry is incomplete', () => {
        assert.throws(
            () =>
                buildSelectedPlantingFromPaidCheckout({
                    authorization: authorization(),
                    bedFieldCount: 18,
                    cartItemId: 42,
                    fields: fields().filter(
                        (field) => field.positionIndex !== 0,
                    ),
                    plantSortId: 101,
                    positionIndex: 0,
                    raisedBedId: 7,
                    scheduledDate: null,
                    sowingLocation: 'direct',
                }),
            AdvancedSowingFulfillmentInputError,
        );
    });
});
