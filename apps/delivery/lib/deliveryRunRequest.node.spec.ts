import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDeliveryRunRequestBody } from './deliveryRunRequest';

const firstRequestId = '0f325da1-df30-4a22-8db1-93bcdb245f68';
const secondRequestId = 'c724532a-79fe-4c77-93e3-e92dc0aeb143';

test('accepts multiple unique delivery request IDs', () => {
    assert.deepEqual(
        parseDeliveryRunRequestBody(
            { deliveryRequestIds: [firstRequestId, secondRequestId] },
            26,
        ),
        [firstRequestId, secondRequestId],
    );
});

test('rejects duplicate, malformed, empty, and oversized selections', () => {
    assert.equal(
        parseDeliveryRunRequestBody(
            { deliveryRequestIds: [firstRequestId, firstRequestId] },
            26,
        ),
        null,
    );
    assert.equal(
        parseDeliveryRunRequestBody({ deliveryRequestIds: ['invalid'] }, 26),
        null,
    );
    assert.equal(
        parseDeliveryRunRequestBody({ deliveryRequestIds: [] }, 26),
        null,
    );
    assert.equal(
        parseDeliveryRunRequestBody(
            { deliveryRequestIds: [firstRequestId, secondRequestId] },
            1,
        ),
        null,
    );
});
