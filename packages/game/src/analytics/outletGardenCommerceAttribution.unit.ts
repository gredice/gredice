import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOutletGardenCommerceAttributionValue } from './outletGardenCommerceAttribution';

const now = Date.parse('2026-08-12T10:00:00.000Z');
const holdExpiresAt = '2026-08-12T10:10:00.000Z';
const value = JSON.stringify({
    cartItemId: 11,
    holdExpiresAt,
    outletOfferId: 302,
});
const item = {
    id: 11,
    outlet: {
        expired: false,
        holdExpiresAt,
        offerId: 302,
        status: 'held',
    },
};

test('resolves only a matching unexpired Outlet hold', () => {
    assert.deepEqual(
        resolveOutletGardenCommerceAttributionValue(value, [item], now),
        { cartItemId: 11, holdExpiresAt, outletOfferId: 302 },
    );
    assert.equal(
        resolveOutletGardenCommerceAttributionValue(value, [], now),
        null,
    );
    assert.equal(
        resolveOutletGardenCommerceAttributionValue(
            value,
            [{ ...item, outlet: { ...item.outlet, offerId: 303 } }],
            now,
        ),
        null,
    );
});

test('fails closed for expired or malformed attribution', () => {
    assert.equal(
        resolveOutletGardenCommerceAttributionValue(
            value,
            [item],
            Date.parse(holdExpiresAt),
        ),
        null,
    );
    assert.equal(
        resolveOutletGardenCommerceAttributionValue('{bad', [item], now),
        null,
    );
});
