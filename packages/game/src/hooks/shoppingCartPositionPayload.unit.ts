import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getCartItemOutletOfferId,
    type ShoppingCartPositionCartItem,
    shoppingCartPositionUpdatePayload,
} from './shoppingCartPositionPayload';

function cartItem(
    overrides: Partial<ShoppingCartPositionCartItem> = {},
): ShoppingCartPositionCartItem {
    return {
        id: 11,
        entityTypeName: 'plantSort',
        entityId: '101',
        amount: 1,
        gardenId: 1,
        raisedBedId: 2,
        additionalData: null,
        currency: 'eur',
        ...overrides,
    };
}

test('shoppingCartPositionUpdatePayload keeps the outlet offer from cart info', () => {
    const payload = shoppingCartPositionUpdatePayload(
        cartItem({
            outlet: { offerId: 302 },
            additionalData: JSON.stringify({ outletOfferId: 302 }),
        }),
        8,
    );

    assert.deepEqual(payload, {
        id: 11,
        entityTypeName: 'plantSort',
        entityId: '101',
        amount: 1,
        gardenId: 1,
        raisedBedId: 2,
        positionIndex: 8,
        additionalData: JSON.stringify({ outletOfferId: 302 }),
        currency: 'eur',
        outletOfferId: 302,
    });
});

test('getCartItemOutletOfferId falls back to optimistic additional data', () => {
    assert.equal(
        getCartItemOutletOfferId(
            cartItem({
                additionalData: JSON.stringify({ outletOfferId: 301 }),
            }),
        ),
        301,
    );
});

test('shoppingCartPositionUpdatePayload leaves ordinary plant sorts ordinary', () => {
    const payload = shoppingCartPositionUpdatePayload(
        cartItem({
            additionalData: JSON.stringify({
                scheduledDate: '2026-07-01T00:00:00.000Z',
            }),
        }),
        4,
    );

    assert.equal('outletOfferId' in payload, false);
    assert.equal(payload.positionIndex, 4);
    assert.equal(
        payload.additionalData,
        JSON.stringify({ scheduledDate: '2026-07-01T00:00:00.000Z' }),
    );
});
