import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDeliveryRunRequestBody } from './deliveryRunRequest';

const firstRequestId = '0f325da1-df30-4a22-8db1-93bcdb245f68';
const secondRequestId = 'c724532a-79fe-4c77-93e3-e92dc0aeb143';

test('accepts multiple unique delivery request IDs', () => {
    assert.deepEqual(
        parseDeliveryRunRequestBody({
            deliveryRequestIds: [firstRequestId, secondRequestId],
        }),
        [firstRequestId, secondRequestId],
    );
});

test('rejects duplicate, malformed, and empty selections', () => {
    assert.equal(
        parseDeliveryRunRequestBody({
            deliveryRequestIds: [firstRequestId, firstRequestId],
        }),
        null,
    );
    assert.equal(
        parseDeliveryRunRequestBody({ deliveryRequestIds: ['invalid'] }),
        null,
    );
    assert.equal(parseDeliveryRunRequestBody({ deliveryRequestIds: [] }), null);
});
