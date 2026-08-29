import assert from 'node:assert/strict';
import test from 'node:test';
import { DeliveryNativeAuthError } from '@gredice/storage';
import { Hono } from 'hono';
import { openAPIRouteHandler } from 'hono-openapi';
import {
    createDeliveryMobileRoutes,
    createTestDeliveryMobileAuthMiddleware,
    type DeliveryMobileRouteDeps,
    type DeliveryNativeAuthRouteDeps,
} from '../../app/api/[...route]/deliveryMobileRoutes';

const expiresAt = new Date('2026-09-27T10:00:00.000Z');
const tokenRequest = {
    grant_type: 'authorization_code',
    client_id: 'gredice-delivery-android',
    redirect_uri: 'https://dostava.gredice.com/android/auth/callback',
    code: 'grant-id.grant-secret',
    code_verifier: 'native-verifier-abcdefghijklmnopqrstuvwxyz-0123456789-._~',
};

function nativeAuth(
    overrides: Partial<DeliveryNativeAuthRouteDeps> = {},
): DeliveryNativeAuthRouteDeps {
    return {
        exchangeCode: async () => ({
            userId: 'driver-user',
            accountId: 'driver-account',
            familyId: 'family-id',
            expiresAt,
            refreshToken: 'refresh-id.refresh-secret',
        }),
        rotateRefresh: async () => ({
            userId: 'driver-user',
            accountId: 'driver-account',
            familyId: 'family-id',
            expiresAt,
            refreshToken: 'rotated-id.rotated-secret',
        }),
        revokeRefresh: async () => true,
        issueAccessToken: async () => 'scoped-access-token',
        rateLimitAllows: async () => true,
        retryAfterSeconds: 600,
        onUnexpectedError: () => undefined,
        ...overrides,
    };
}

function routes(native: DeliveryNativeAuthRouteDeps, enabled = true) {
    return createDeliveryMobileRoutes({
        enabled: () => enabled,
        authValidator: createTestDeliveryMobileAuthMiddleware(),
        now: () => new Date('2026-08-28T10:00:00.000Z'),
        readActiveRoute: async () => ({
            response: {
                schemaVersion: 1,
                generatedAt: '2026-08-28T10:00:00.000Z',
                route: null,
            },
            omittedInvalidNodeCount: 0,
        }),
        recordRead: () => undefined,
        onUnexpectedError: () => undefined,
        nativeAuth: native,
    } satisfies DeliveryMobileRouteDeps);
}

test('disabled native auth fails closed before exchanging or rotating credentials', async () => {
    let exchangeCalls = 0;
    let refreshCalls = 0;
    const app = routes(
        nativeAuth({
            exchangeCode: async () => {
                exchangeCalls += 1;
                throw new Error('must not exchange while disabled');
            },
            rotateRefresh: async () => {
                refreshCalls += 1;
                throw new Error('must not rotate while disabled');
            },
        }),
        false,
    );

    for (const request of [
        jsonRequest('/auth/token', tokenRequest),
        jsonRequest('/auth/refresh', {
            grant_type: 'refresh_token',
            client_id: 'gredice-delivery-android',
            refresh_token: 'refresh-id.refresh-secret',
        }),
    ]) {
        const response = await app.request(request);
        assert.equal(response.status, 503);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(response.headers.get('pragma'), 'no-cache');
        assert.deepEqual(await response.json(), {
            error: 'Android Auto trenutačno nije dostupan.',
            code: 'ANDROID_AUTO_DISABLED',
        });
    }
    assert.equal(exchangeCalls, 0);
    assert.equal(refreshCalls, 0);
});

test('disabled native auth still permits idempotent session revocation', async () => {
    let revokeCalls = 0;
    const app = routes(
        nativeAuth({
            revokeRefresh: async () => {
                revokeCalls += 1;
                return true;
            },
        }),
        false,
    );

    const response = await app.request(
        jsonRequest('/auth/revoke', {
            client_id: 'gredice-delivery-android',
            refresh_token: 'refresh-id.refresh-secret',
        }),
    );

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(revokeCalls, 1);
});

function jsonRequest(path: string, body: unknown) {
    return new Request(`https://api.gredice.test${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

test('native token exchange forwards only the fixed public-client protocol and returns no-store credentials', async () => {
    const inputs: unknown[] = [];
    const app = routes(
        nativeAuth({
            exchangeCode: async (input) => {
                inputs.push(input);
                return {
                    userId: 'driver-user',
                    accountId: 'driver-account',
                    familyId: 'family-id',
                    expiresAt,
                    refreshToken: 'refresh-id.refresh-secret',
                };
            },
        }),
    );
    const response = await app.request(
        jsonRequest('/auth/token', tokenRequest),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('pragma'), 'no-cache');
    assert.deepEqual(inputs, [
        {
            code: tokenRequest.code,
            codeVerifier: tokenRequest.code_verifier,
            clientId: tokenRequest.client_id,
            redirectUri: tokenRequest.redirect_uri,
        },
    ]);
    assert.deepEqual(await response.json(), {
        access_token: 'scoped-access-token',
        token_type: 'Bearer',
        expires_in: 900,
        refresh_token: 'refresh-id.refresh-secret',
        refresh_expires_at: expiresAt.toISOString(),
        scope: 'delivery:route:read',
    });
});

test('native auth maps stable protocol failures without reflecting credentials', async () => {
    const app = routes(
        nativeAuth({
            exchangeCode: async () => {
                throw new DeliveryNativeAuthError('PKCE_MISMATCH');
            },
        }),
    );
    const response = await app.request(
        jsonRequest('/auth/token', tokenRequest),
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(body.code, 'PKCE_MISMATCH');
    assert.doesNotMatch(JSON.stringify(body), /grant-secret|native-verifier/);
});

test('native auth maps every storage failure to a stable private response', async () => {
    const cases = [
        ['AUTH_CODE_INVALID', 400],
        ['AUTH_CODE_EXPIRED', 400],
        ['AUTH_CODE_REPLAYED', 400],
        ['PKCE_MISMATCH', 400],
        ['DELIVERY_ROLE_REQUIRED', 403],
        ['ACCOUNT_NOT_ELIGIBLE', 403],
        ['REFRESH_INVALID', 401],
        ['REFRESH_REVOKED', 401],
        ['REFRESH_EXPIRED', 401],
        ['REFRESH_REPLAYED', 401],
    ] as const;

    for (const [code, status] of cases) {
        const isRefresh = code.startsWith('REFRESH_');
        const dependency = nativeAuth(
            isRefresh
                ? {
                      rotateRefresh: async () => {
                          throw new DeliveryNativeAuthError(code);
                      },
                  }
                : {
                      exchangeCode: async () => {
                          throw new DeliveryNativeAuthError(code);
                      },
                  },
        );
        const request = isRefresh
            ? jsonRequest('/auth/refresh', {
                  grant_type: 'refresh_token',
                  client_id: 'gredice-delivery-android',
                  refresh_token: 'refresh-id.refresh-secret',
              })
            : jsonRequest('/auth/token', tokenRequest);
        const response = await routes(dependency).request(request);

        assert.equal(response.status, status, code);
        assert.equal(response.headers.get('cache-control'), 'no-store', code);
        assert.equal((await response.json()).code, code);
    }
});

test('native refresh is rate limited before credential rotation', async () => {
    let rotations = 0;
    const app = routes(
        nativeAuth({
            rateLimitAllows: async () => false,
            rotateRefresh: async () => {
                rotations += 1;
                throw new Error('must not rotate');
            },
        }),
    );
    const response = await app.request(
        jsonRequest('/auth/refresh', {
            grant_type: 'refresh_token',
            client_id: 'gredice-delivery-android',
            refresh_token: 'refresh-id.refresh-secret',
        }),
    );

    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '600');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(rotations, 0);
    assert.equal((await response.json()).code, 'RATE_LIMITED');
});

test('native revoke is idempotent and never returns credential material', async () => {
    let revocations = 0;
    const app = routes(
        nativeAuth({
            revokeRefresh: async () => {
                revocations += 1;
                return false;
            },
        }),
    );
    const response = await app.request(
        jsonRequest('/auth/revoke', {
            client_id: 'gredice-delivery-android',
            refresh_token: 'unknown-id.unknown-secret',
        }),
    );

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await response.text(), '');
    assert.equal(revocations, 1);
});

test('native auth OpenAPI exposes versioned token lifecycle routes', async () => {
    const app = new Hono().get(
        '/docs',
        openAPIRouteHandler(routes(nativeAuth()), {
            documentation: {
                info: { title: 'Delivery Mobile API', version: '1.0.0' },
            },
        }),
    );
    const response = await app.request('/docs');
    const specification = await response.json();

    assert.equal(response.status, 200);
    assert.ok(specification.paths['/auth/token'].post);
    assert.ok(specification.paths['/auth/refresh'].post);
    assert.ok(specification.paths['/auth/revoke'].post);
});
