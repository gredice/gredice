import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createOAuthCallbackErrorRedirect,
    oauthCallbackCookieNames,
    resolveOAuthCallback,
    sanitizeOAuthCallbackUrl,
} from './oauthCallbackContract';

const matchingState = {
    state: 'signed-oauth-state',
    storedState: 'signed-oauth-state',
};

test('continues a valid callback and preserves its encoded internal return path', () => {
    const callbackUrl = new URL(
        '/prijava/google-prijava/povratak',
        'https://farma.gredice.com',
    );
    callbackUrl.searchParams.set(
        'returnTo',
        '/operations/42?tab=dokazi#fotografije',
    );

    const result = resolveOAuthCallback({
        provider: 'google',
        code: 'authorization-code',
        storedRedirect: callbackUrl.toString(),
        ...matchingState,
    });

    assert.equal(result.kind, 'continue');
    if (result.kind !== 'continue') {
        return;
    }
    assert.equal(result.code, 'authorization-code');
    assert.equal(result.state, matchingState.state);
    assert.equal(result.callbackUrl, callbackUrl.toString());
    assert.deepEqual(result.clearCookieNames, oauthCallbackCookieNames);
});

test('rejects missing or mismatched callback state before using an authorization code', () => {
    const missingCookie = resolveOAuthCallback({
        provider: 'google',
        code: 'authorization-code',
        state: matchingState.state,
    });
    const missingState = resolveOAuthCallback({
        provider: 'google',
        code: 'authorization-code',
        storedState: matchingState.storedState,
    });
    const mismatch = resolveOAuthCallback({
        provider: 'facebook',
        code: 'authorization-code',
        state: 'returned-state',
        storedState: 'different-cookie-state',
    });

    for (const result of [missingCookie, missingState, mismatch]) {
        assert.equal(result.kind, 'redirect');
        if (result.kind !== 'redirect') {
            continue;
        }
        assert.equal(result.error, 'state_invalid');
        assert.equal(
            new URL(result.redirectUrl).searchParams.get('error'),
            'state_invalid',
        );
        assert.deepEqual(result.clearCookieNames, oauthCallbackCookieNames);
    }
});

test('maps provider cancellation to a bounded callback error', () => {
    const results = [
        resolveOAuthCallback({
            provider: 'google',
            providerError: 'access_denied',
            ...matchingState,
        }),
        resolveOAuthCallback({
            provider: 'facebook',
            providerError: 'access_denied',
            providerErrorReason: 'user_denied',
            ...matchingState,
        }),
    ];

    for (const result of results) {
        assert.equal(result.kind, 'redirect');
        if (result.kind !== 'redirect') {
            continue;
        }
        assert.equal(result.error, 'canceled');
        assert.equal(
            new URL(result.redirectUrl).searchParams.get('error'),
            'canceled',
        );
        assert.equal(result.redirectUrl.includes('access_denied'), false);
        assert.equal(result.redirectUrl.includes('user_denied'), false);
    }
});

test('maps other provider failures to a bounded provider error', () => {
    const result = resolveOAuthCallback({
        provider: 'facebook',
        providerError: 'temporarily_unavailable',
        providerErrorReason: 'upstream detail that must not be forwarded',
        ...matchingState,
    });

    assert.equal(result.kind, 'redirect');
    if (result.kind !== 'redirect') {
        return;
    }
    assert.equal(result.error, 'provider_error');
    assert.equal(
        new URL(result.redirectUrl).searchParams.get('error'),
        'provider_error',
    );
    assert.equal(result.redirectUrl.includes('temporarily_unavailable'), false);
    assert.equal(result.redirectUrl.includes('upstream'), false);
});

test('falls back when a callback target has an unsafe origin or path', () => {
    const unsafeTargets = [
        'https://attacker.example/prijava/google-prijava/povratak',
        'https://farm-attacker-gredice.vercel.app/prijava/google-prijava/povratak',
        'https://farma.gredice.com/operations/42',
        'https://farma.gredice.com/prijava/facebook-prijava/povratak',
        'https://farma.gredice.com/prijava/google-prijava/povratak?token=raw',
        '//farma.gredice.com/prijava/google-prijava/povratak',
    ];

    for (const storedRedirect of unsafeTargets) {
        const result = resolveOAuthCallback({
            provider: 'google',
            code: 'authorization-code',
            storedRedirect,
            ...matchingState,
        });

        assert.equal(result.kind, 'continue');
        if (result.kind !== 'continue') {
            continue;
        }
        assert.equal(
            result.callbackUrl,
            'https://vrt.gredice.com/prijava/google-prijava/povratak',
        );
    }
});

test('accepts only provider-matched desktop callback targets', () => {
    assert.equal(
        sanitizeOAuthCallbackUrl(
            'google',
            'gredice-farm://auth-callback/google',
        ),
        'gredice-farm://auth-callback/google',
    );
    assert.equal(
        sanitizeOAuthCallbackUrl(
            'google',
            'gredice-farm://auth-callback/facebook',
        ),
        undefined,
    );
});

test('uses callback_error without replacing a validated return path', () => {
    const callbackUrl =
        'https://farma.gredice.com/prijava/google-prijava/povratak?returnTo=%2Fnotifications%2F17';
    const redirectUrl = createOAuthCallbackErrorRedirect(
        'google',
        callbackUrl,
        'callback_error',
    );
    const parsed = new URL(redirectUrl);

    assert.equal(parsed.searchParams.get('returnTo'), '/notifications/17');
    assert.equal(parsed.searchParams.get('error'), 'callback_error');
});

test('uses callback_error when a state-valid callback has no code', () => {
    const result = resolveOAuthCallback({
        provider: 'google',
        ...matchingState,
    });

    assert.equal(result.kind, 'redirect');
    if (result.kind !== 'redirect') {
        return;
    }
    assert.equal(result.error, 'callback_error');
    assert.equal(
        new URL(result.redirectUrl).searchParams.get('error'),
        'callback_error',
    );
});

test('declares state, redirect and timezone cleanup for every callback outcome', () => {
    const success = resolveOAuthCallback({
        provider: 'google',
        code: 'authorization-code',
        ...matchingState,
    });
    const failure = resolveOAuthCallback({
        provider: 'google',
        code: 'authorization-code',
        state: 'wrong-state',
        storedState: matchingState.storedState,
    });

    assert.deepEqual(success.clearCookieNames, [
        'oauth_state',
        'oauth_redirect',
        'oauth_timezone',
    ]);
    assert.deepEqual(failure.clearCookieNames, success.clearCookieNames);
});
