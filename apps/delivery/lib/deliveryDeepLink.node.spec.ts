import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCustomerDeliveryTrackerLink } from '@gredice/notifications/customer-delivery';
import {
    buildDeliveryDashboardRequestPath,
    buildDeliveryDeepLink,
    buildDeliveryLoginFailureReturnTarget,
    buildDeliveryOAuthCallbackPath,
    buildDeliveryReturnTarget,
    createDeliveryDashboardRequestPathTracker,
    deliveryDeepLinkRequestIdMaxLength,
    deliveryReturnTargetMaxLength,
    parseDeliveryDeepLink,
    parseDeliveryLoginFailure,
    resolveDeliveryDeepLinkAccount,
    safeDeliveryReturnTarget,
} from './deliveryDeepLink';

test('parses one bounded delivery request ID and rejects malformed values', () => {
    assert.deepEqual(parseDeliveryDeepLink(undefined), { kind: 'none' });
    assert.deepEqual(parseDeliveryDeepLink('delivery_123-abc'), {
        kind: 'request',
        requestId: 'delivery_123-abc',
    });
    assert.deepEqual(parseDeliveryDeepLink(['first', 'second']), {
        kind: 'invalid',
    });
    const maximumRequestId = 'a'.repeat(deliveryDeepLinkRequestIdMaxLength);
    assert.deepEqual(parseDeliveryDeepLink(maximumRequestId), {
        kind: 'request',
        requestId: maximumRequestId,
    });

    for (const value of [
        '',
        ' delivery',
        'delivery ',
        'delivery/request',
        'delivery?other=1',
        'delivery%2Frequest',
        'a'.repeat(deliveryDeepLinkRequestIdMaxLength + 1),
    ]) {
        assert.deepEqual(parseDeliveryDeepLink(value), { kind: 'invalid' });
    }
});

test('builds a delivery deep link only for a valid bounded request ID', () => {
    assert.equal(
        buildDeliveryDeepLink('request-123'),
        '/?delivery=request-123',
    );
    assert.equal(buildDeliveryDeepLink('request/123'), null);
});

test('adds only a validated request target to the dashboard request path', () => {
    assert.equal(
        buildDeliveryDashboardRequestPath({
            kind: 'request',
            requestId: 'request:account-b',
        }),
        '/api/dashboard?delivery=request%3Aaccount-b',
    );
    assert.equal(
        buildDeliveryDashboardRequestPath({ kind: 'none' }),
        '/api/dashboard',
    );
    assert.equal(
        buildDeliveryDashboardRequestPath({ kind: 'invalid' }),
        '/api/dashboard',
    );
});

test('uses a deep-link dashboard request only until its first success', () => {
    const targetedPath = '/api/dashboard?delivery=request-123';
    const tracker = createDeliveryDashboardRequestPathTracker(targetedPath);

    assert.equal(tracker.current(), targetedPath);
    tracker.recordSuccess('/api/dashboard?delivery=stale-request');
    assert.equal(tracker.current(), targetedPath);
    tracker.recordSuccess(targetedPath);
    assert.equal(tracker.current(), '/api/dashboard');
    tracker.recordSuccess('/api/dashboard');
    assert.equal(tracker.current(), '/api/dashboard');
});

test('selects only an account-owned deep-link target and requests a cookie switch', () => {
    const selected = resolveDeliveryDeepLinkAccount({
        authorizedAccountIds: ['account-a', 'account-b'],
        currentAccountId: 'account-a',
        ownerAccountId: 'account-b',
        target: { kind: 'request', requestId: 'request-b' },
    });
    assert.deepEqual(selected, {
        accountId: 'account-b',
        shouldSetAccountCookie: true,
    });

    for (const input of [
        {
            ownerAccountId: 'account-c',
            target: { kind: 'request', requestId: 'request-c' } as const,
        },
        {
            ownerAccountId: null,
            target: { kind: 'request', requestId: 'missing' } as const,
        },
        { ownerAccountId: 'account-b', target: { kind: 'invalid' } as const },
        { ownerAccountId: 'account-b', target: { kind: 'none' } as const },
    ]) {
        assert.deepEqual(
            resolveDeliveryDeepLinkAccount({
                authorizedAccountIds: ['account-a', 'account-b'],
                currentAccountId: 'account-a',
                ...input,
            }),
            {
                accountId: 'account-a',
                shouldSetAccountCookie: false,
            },
        );
    }
});

test('every generated tracker link parses back to the same request', () => {
    for (const requestId of [
        'delivery_123-abc',
        'request:opaque_1~revision-2',
        `request.${'a'.repeat(deliveryDeepLinkRequestIdMaxLength - 8)}`,
    ]) {
        const trackerUrl = new URL(buildCustomerDeliveryTrackerLink(requestId));
        assert.deepEqual(
            parseDeliveryDeepLink(trackerUrl.searchParams.get('delivery')),
            { kind: 'request', requestId },
        );
    }
});

test('keeps pathname and search for safe relative return targets', () => {
    assert.equal(
        safeDeliveryReturnTarget('/?delivery=request-123&source=email'),
        '/?delivery=request-123&source=email',
    );
    assert.equal(
        buildDeliveryReturnTarget('/', 'delivery=request-123'),
        '/?delivery=request-123',
    );
    assert.equal(
        safeDeliveryReturnTarget('/deliveries?view=history'),
        '/deliveries?view=history',
    );
});

test('falls back for unsafe, looping, or oversized return targets', () => {
    for (const value of [
        'https://evil.example/steal',
        '//evil.example/steal',
        '/\\evil.example/steal',
        '/#https://evil.example',
        '/api/dashboard',
        '/%61pi/dashboard',
        '/prijava/google-prijava/povratak',
        '/%70rijava/google-prijava/povratak',
        `/${'a'.repeat(deliveryReturnTargetMaxLength)}`,
    ]) {
        assert.equal(safeDeliveryReturnTarget(value), '/');
    }
});

test('carries a safe return target through OAuth and falls back safely', () => {
    assert.equal(
        buildDeliveryOAuthCallbackPath(
            'google',
            '/?delivery=request-123&source=notification',
        ),
        '/prijava/google-prijava/povratak?returnTo=%2F%3Fdelivery%3Drequest-123%26source%3Dnotification',
    );
    assert.equal(
        buildDeliveryOAuthCallbackPath('facebook', '//evil.example'),
        '/prijava/facebook-prijava/povratak?returnTo=%2F',
    );
});

test('uses only bounded login failure markers on a sanitized return target', () => {
    assert.equal(parseDeliveryLoginFailure('oauth-provider'), 'oauth-provider');
    assert.equal(
        parseDeliveryLoginFailure('oauth-missing-token'),
        'oauth-missing-token',
    );
    assert.equal(
        parseDeliveryLoginFailure('oauth-token-exchange'),
        'oauth-token-exchange',
    );
    assert.equal(parseDeliveryLoginFailure('provider-error-details'), null);
    assert.equal(
        parseDeliveryLoginFailure(['oauth-provider', 'oauth-token-exchange']),
        null,
    );

    assert.equal(
        buildDeliveryLoginFailureReturnTarget(
            '/?delivery=request-123&source=notification',
            'oauth-token-exchange',
        ),
        '/?delivery=request-123&source=notification&loginFailure=oauth-token-exchange',
    );
    assert.equal(
        buildDeliveryLoginFailureReturnTarget(
            'https://evil.example/steal',
            'oauth-provider',
        ),
        '/?loginFailure=oauth-provider',
    );
});
