import assert from 'node:assert/strict';
import test from 'node:test';
import {
    deliveryNativeAuthorizationReturnTarget,
    deliveryNativeCallbackUrl,
    isDeliveryNativeAuthorizationReturnTarget,
    parseDeliveryNativeAuthorizationRequest,
} from './deliveryNativeAuthorization';

const valid = {
    client_id: 'gredice-delivery-android',
    redirect_uri: 'https://dostava.gredice.com/android/auth/callback',
    code_challenge: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
    code_challenge_method: 'S256',
    state: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
};

test('native authorization accepts only the fixed client, redirect, and S256 request', () => {
    const parsed = parseDeliveryNativeAuthorizationRequest(valid);
    assert.ok(parsed);
    const returnTarget = deliveryNativeAuthorizationReturnTarget(parsed);
    assert.equal(
        returnTarget,
        '/prijava/android?client_id=gredice-delivery-android&redirect_uri=https%3A%2F%2Fdostava.gredice.com%2Fandroid%2Fauth%2Fcallback&code_challenge=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG&code_challenge_method=S256&state=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
    );
    assert.equal(
        isDeliveryNativeAuthorizationReturnTarget(
            new URL(returnTarget, 'https://dostava.gredice.com'),
        ),
        true,
    );

    for (const mutation of [
        { client_id: 'other-client' },
        { redirect_uri: 'https://attacker.example/callback' },
        { code_challenge_method: 'plain' },
        { code_challenge: 'short' },
        { state: '../unexpected' },
    ]) {
        assert.equal(
            parseDeliveryNativeAuthorizationRequest({
                ...valid,
                ...mutation,
            }),
            null,
        );
    }
});

test('native callback contains only the short-lived code and state', () => {
    const callback = new URL(
        deliveryNativeCallbackUrl({
            code: 'grant-id.grant-secret',
            state: 'random-state',
        }),
    );
    assert.equal(callback.origin, 'https://dostava.gredice.com');
    assert.equal(callback.pathname, '/android/auth/callback');
    assert.deepEqual([...callback.searchParams.keys()].sort(), [
        'code',
        'state',
    ]);
    assert.equal(callback.searchParams.has('access_token'), false);
    assert.equal(callback.searchParams.has('refresh_token'), false);
});
