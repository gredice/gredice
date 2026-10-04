import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildOutletCartItemPayload,
    ShoppingCartMutationError,
    shoppingCartMutationErrorFromResponse,
} from './shoppingCartItemMutation';

test('buildOutletCartItemPayload builds a new outlet field reservation', () => {
    const payload = buildOutletCartItemPayload({
        gardenId: 1,
        outletOfferId: 302,
        plantSortId: 101,
        positionIndex: 0,
        raisedBedId: 2,
    });

    assert.deepEqual(payload, {
        entityTypeName: 'plantSort',
        entityId: '101',
        amount: 1,
        gardenId: 1,
        raisedBedId: 2,
        positionIndex: 0,
        additionalData: JSON.stringify({ outletOfferId: 302 }),
        outletOfferId: 302,
    });
    assert.equal('advancedSowingSelection' in payload, false);
    assert.equal('currency' in payload, false);
    assert.equal('forceCreate' in payload, false);
});

test('buildOutletCartItemPayload preserves an existing item and explicit payment currency', () => {
    assert.deepEqual(
        buildOutletCartItemPayload({
            cartItemId: 41,
            currency: 'eur',
            gardenId: 1,
            outletOfferId: 302,
            plantSortId: 101,
            positionIndex: 8,
            raisedBedId: 2,
        }),
        {
            id: 41,
            entityTypeName: 'plantSort',
            entityId: '101',
            amount: 1,
            gardenId: 1,
            raisedBedId: 2,
            positionIndex: 8,
            additionalData: JSON.stringify({ outletOfferId: 302 }),
            currency: 'eur',
            outletOfferId: 302,
        },
    );
});

test('shoppingCartMutationErrorFromResponse preserves the API error contract', async () => {
    const error = await shoppingCartMutationErrorFromResponse(
        new Response(
            JSON.stringify({
                code: 'OUTLET_TARGET_UNAVAILABLE',
                error: 'Outlet target is not available',
            }),
            { status: 409 },
        ),
    );

    assert.ok(error instanceof Error);
    assert.ok(error instanceof ShoppingCartMutationError);
    assert.equal(error.name, 'ShoppingCartMutationError');
    assert.equal(error.status, 409);
    assert.equal(error.code, 'OUTLET_TARGET_UNAVAILABLE');
    assert.equal(error.message, 'Outlet target is not available');
});

test('shoppingCartMutationErrorFromResponse supports uncoded API errors', async () => {
    const error = await shoppingCartMutationErrorFromResponse(
        new Response(JSON.stringify({ message: 'Cart item not found' }), {
            status: 404,
        }),
    );

    assert.equal(error.status, 404);
    assert.equal(error.code, null);
    assert.equal(error.message, 'Cart item not found');
});

test('shoppingCartMutationErrorFromResponse hides malformed response bodies', async () => {
    const error = await shoppingCartMutationErrorFromResponse(
        new Response('<html>Proxy error</html>', { status: 502 }),
    );

    assert.equal(error.status, 502);
    assert.equal(error.code, null);
    assert.equal(error.message, 'Failed to set shopping cart item');
});

test('shoppingCartMutationErrorFromResponse falls back for empty response bodies', async () => {
    const error = await shoppingCartMutationErrorFromResponse(
        new Response('', { status: 500 }),
    );

    assert.equal(error.status, 500);
    assert.equal(error.code, null);
    assert.equal(error.message, 'Failed to set shopping cart item');
});
