import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { initAuth } from '@gredice/auth';
import { Hono } from 'hono';
import { authValidator } from '../hono/authValidator';
import {
    createJwt,
    verifyAccessJwt,
    verifyJwt,
    verifyOAuthStateJwt,
} from './auth';
import { createOAuthStateFromSession } from './oauthSessionState';

const secret = Buffer.from('test-token-purpose-secret-test-token-purpose');
const auth = initAuth({
    jwt: {
        namespace: 'gredice',
        issuer: 'api',
        audience: 'web',
        jwtSecretFactory: () => secret,
    },
    getUser: () => null,
});

function legacyToken(claims: Record<string, unknown>) {
    const input = [
        { alg: 'HS256' },
        {
            sub: 'user-1',
            iss: 'urn:gredice:issuer:api',
            aud: 'urn:gredice:audience:web',
            exp: Math.floor(Date.now() / 1000) + 3600,
            ...claims,
        },
    ]
        .map((value) =>
            Buffer.from(JSON.stringify(value)).toString('base64url'),
        )
        .join('.');
    return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
}

test('API deletion tokens are rejected by shared access verification, API bearer/cookies and OAuth', async () => {
    const previousSecret = process.env.GREDICE_JWT_SIGN_SECRET;
    process.env.GREDICE_JWT_SIGN_SECRET = secret.toString('base64');
    try {
        const apiToken = await createJwt(
            { sub: 'user-1', accountId: 'account-1' },
            '72h',
        );
        const legacy = legacyToken({ accountId: 'account-1' });
        const app = new Hono();
        app.use('*', authValidator(['user']));
        app.get('/', (context) => context.text('authorized'));

        for (const token of [apiToken, legacy]) {
            const verified = await verifyJwt(token);
            assert.ifError(verified.error);
            assert.equal(verified.result?.payload.accountId, 'account-1');
            if (token !== legacy)
                assert.equal(
                    verified.result?.payload.tokenUse,
                    'account_delete',
                );
            for (const verify of [verifyAccessJwt, auth.verifyAccessJwt]) {
                const result = await verify(token);
                assert.ok(result.error);
                assert.equal(result.result, undefined);
            }
            assert.ok((await verifyOAuthStateJwt(token)).error);
            const state = await createOAuthStateFromSession(token);
            assert.equal(state.split('.').length, 1);
            for (const headers of [
                new Headers({ Authorization: `Bearer ${token}` }),
                new Headers({ Cookie: `gredice_session=${token}` }),
            ]) {
                assert.equal((await app.request('/', { headers })).status, 401);
            }
        }
    } finally {
        if (previousSecret === undefined)
            delete process.env.GREDICE_JWT_SIGN_SECRET;
        else process.env.GREDICE_JWT_SIGN_SECRET = previousSecret;
    }
});

test('access verification preserves valid legacy sessions and rejects malformed and other purposes', async () => {
    const token = await auth.createJwt('user-1');
    assert.equal(
        (await auth.verifyAccessJwt(token)).result?.payload.tokenUse,
        'access',
    );
    assert.ifError((await auth.verifyAccessJwt(legacyToken({}))).error);
    for (const tokenUse of [
        'account_delete',
        'oauth_state',
        '',
        null,
        1,
        {},
        ['access'],
    ]) {
        const result = await auth.verifyAccessJwt(legacyToken({ tokenUse }));
        assert.ok(result.error);
        assert.equal(result.result, undefined);
    }
    assert.ok(
        (
            await auth.verifyAccessJwt(
                await auth.createJwt('user-1', new Date(0)),
            )
        ).error,
    );
    assert.ok(
        (
            await auth.verifyAccessJwt(
                await auth.createJwt('user-1', undefined, {
                    audience: 'delivery-android',
                }),
            )
        ).error,
    );
    assert.ok((await auth.verifyAccessJwt(`${token.slice(0, -5)}wrong`)).error);
});

test('OAuth session exchange creates purpose-bound state and supports in-flight legacy callbacks', async () => {
    const previousSecret = process.env.GREDICE_JWT_SIGN_SECRET;
    process.env.GREDICE_JWT_SIGN_SECRET = secret.toString('base64');
    try {
        for (const session of [
            await auth.createJwt('user-1'),
            legacyToken({}),
        ]) {
            const state = await createOAuthStateFromSession(session);
            const verified = await verifyOAuthStateJwt(state);
            assert.ifError(verified.error);
            assert.equal(verified.result?.payload.sub, 'user-1');
            assert.equal(verified.result?.payload.tokenUse, 'oauth_state');
            assert.ok((await verifyAccessJwt(state)).error);
        }
        assert.ifError((await verifyOAuthStateJwt(legacyToken({}))).error);
        assert.ok(
            (await verifyOAuthStateJwt(await auth.createJwt('user-1'))).error,
        );
        assert.equal(
            (await createOAuthStateFromSession('invalid-token')).split('.')
                .length,
            1,
        );
    } finally {
        if (previousSecret === undefined)
            delete process.env.GREDICE_JWT_SIGN_SECRET;
        else process.env.GREDICE_JWT_SIGN_SECRET = previousSecret;
    }
});
