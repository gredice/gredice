import assert from 'node:assert/strict';
import test from 'node:test';
import {
    deliveryOperationalErrorContext,
    deliveryOperationalOpaqueId,
    deliveryOperationFailureLogContext,
    deliveryOperationRejectionLogContext,
    deliveryRouteFallbackLogContext,
    deliveryRouteFallbackLogMessage,
} from './deliveryOperationalLogging';

test('builds stable privacy-safe route fallback metadata without raw errors', () => {
    const privateMessage =
        'Customer at Private Street 12, coordinates 45.8, 15.9 failed';
    const error = Object.assign(new Error(privateMessage), {
        code: 'routes-provider-unavailable',
    });

    const context = deliveryRouteFallbackLogContext({
        error,
        nodeCount: 12,
        phase: 'reroute',
    });

    assert.equal(
        deliveryRouteFallbackLogMessage,
        'Delivery route fallback selected',
    );
    assert.deepEqual(context, {
        errorCode: 'routes-provider-unavailable',
        errorName: 'Error',
        fallback: 'local',
        nodeCount: 12,
        phase: 'reroute',
        provider: 'google',
    });
    assert.doesNotMatch(JSON.stringify(context), /Private Street|45\.8|15\.9/u);
    assert.equal('error' in context, false);
    assert.equal('message' in context, false);
    assert.equal('stack' in context, false);
});

test('builds bounded driver-operation contexts without identities or raw errors', () => {
    const privateMessage =
        'Driver private-user at Private Street 12 failed for customer 099123';

    const failure = deliveryOperationFailureLogContext({
        error: Object.assign(new Error(privateMessage), {
            code: 'storage-unavailable',
        }),
        mutationCount: 14,
    });
    const rejection = deliveryOperationRejectionLogContext({
        errorCode: 'route-revision-conflict',
        mutationCount: 3,
    });

    assert.deepEqual(failure, {
        errorCode: 'storage-unavailable',
        errorName: 'Error',
        mutationCount: 14,
    });
    assert.deepEqual(rejection, {
        errorCode: 'route-revision-conflict',
        mutationCount: 3,
    });
    assert.doesNotMatch(
        JSON.stringify(failure),
        /private-user|Private Street/u,
    );
    assert.equal('error' in failure, false);
    assert.deepEqual(
        deliveryOperationFailureLogContext({
            error: privateMessage,
            mutationCount: 10_001,
        }),
        { errorCode: 'unclassified', errorName: 'UnknownError' },
    );
    assert.deepEqual(
        deliveryOperationRejectionLogContext({
            errorCode: 'private address / invalid',
            mutationCount: -1,
        }),
        { errorCode: 'unclassified' },
    );
});

test('retains only bounded opaque operational identifiers', () => {
    const opaqueId = '123e4567-e89b-42d3-a456-426614174000';
    assert.equal(deliveryOperationalOpaqueId(opaqueId), opaqueId);
    assert.equal(
        deliveryOperationalOpaqueId('run_01JZ:pickup-2'),
        'id-unavailable',
    );
    assert.equal(
        deliveryOperationalOpaqueId('Private Street 12 / customer'),
        'id-unavailable',
    );
    assert.equal(
        deliveryOperationalOpaqueId('x'.repeat(129)),
        'id-unavailable',
    );
});

test('normalizes unknown or unsafe error fields to bounded tokens', () => {
    assert.deepEqual(
        deliveryOperationalErrorContext({
            code: 'contains customer address / private',
            name: 'not-used',
        }),
        { errorCode: 'unclassified', errorName: 'UnknownError' },
    );
    assert.deepEqual(deliveryOperationalErrorContext(null), {
        errorCode: 'unclassified',
        errorName: 'UnknownError',
    });
    assert.equal(
        deliveryRouteFallbackLogContext({
            error: new Error('private provider response'),
            nodeCount: 1,
            phase: 'initial-route',
        }).errorCode,
        'google-initial-route-failed',
    );
});
