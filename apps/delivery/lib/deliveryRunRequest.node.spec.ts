import assert from 'node:assert/strict';
import test from 'node:test';
import {
    parseDeliveryRunPreflightRequestBody,
    parseDeliveryRunStartRequestBody,
} from './deliveryRunRequest';

const firstRequestId = '0f325da1-df30-4a22-8db1-93bcdb245f68';
const secondRequestId = 'c724532a-79fe-4c77-93e3-e92dc0aeb143';
const preparationToken = `${firstRequestId}.abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678`;

test('accepts multiple unique preflight request IDs', () => {
    assert.deepEqual(
        parseDeliveryRunPreflightRequestBody({
            deliveryRequestIds: [firstRequestId, secondRequestId],
        }),
        [firstRequestId, secondRequestId],
    );
});

test('rejects duplicate, malformed, and empty selections', () => {
    assert.equal(
        parseDeliveryRunPreflightRequestBody({
            deliveryRequestIds: [firstRequestId, firstRequestId],
        }),
        null,
    );
    assert.equal(
        parseDeliveryRunPreflightRequestBody({
            deliveryRequestIds: ['invalid'],
        }),
        null,
    );
    assert.equal(
        parseDeliveryRunPreflightRequestBody({ deliveryRequestIds: [] }),
        null,
    );
});

test('accepts a private preparation token for route start', () => {
    assert.deepEqual(
        parseDeliveryRunStartRequestBody({
            deliveryRequestIds: [firstRequestId, secondRequestId],
            preparationToken,
        }),
        {
            deliveryRequestIds: [firstRequestId, secondRequestId],
            preparationToken,
        },
    );
});

test('keeps tokenless starts compatible and rejects malformed tokens', () => {
    assert.deepEqual(
        parseDeliveryRunStartRequestBody({
            deliveryRequestIds: [firstRequestId],
        }),
        {
            deliveryRequestIds: [firstRequestId],
            preparationToken: undefined,
        },
    );
    assert.equal(
        parseDeliveryRunStartRequestBody({
            deliveryRequestIds: [firstRequestId],
            preparationToken: `${firstRequestId}.short`,
        }),
        null,
    );
});
