import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { createJwt, verifyAccessJwt, verifyJwt } from './baseAuth';

test('admin deletion-email issuer produces a deletion-only token and rejects existing deletion links as sessions', async () => {
    const previousSecret = process.env.GREDICE_JWT_SIGN_SECRET;
    const secret = Buffer.from(
        'admin-deletion-test-secret-admin-deletion-test',
    );
    process.env.GREDICE_JWT_SIGN_SECRET = secret.toString('base64');
    try {
        const token = await createJwt(
            { sub: 'user-1', accountId: 'account-1' },
            '72h',
        );
        const verified = await verifyJwt(token);
        assert.ifError(verified.error);
        assert.equal(verified.result?.payload.tokenUse, 'account_delete');
        assert.equal(verified.result?.payload.accountId, 'account-1');
        assert.ok((await verifyAccessJwt(token)).error);

        const legacyInput = [
            { alg: 'HS256' },
            {
                sub: 'user-1',
                accountId: 'account-1',
                iss: 'urn:gredice:issuer:api',
                aud: 'urn:gredice:audience:web',
                exp: Math.floor(Date.now() / 1000) + 3600,
            },
        ]
            .map((value) =>
                Buffer.from(JSON.stringify(value)).toString('base64url'),
            )
            .join('.');
        const legacy = `${legacyInput}.${createHmac('sha256', secret).update(legacyInput).digest('base64url')}`;
        assert.ifError((await verifyJwt(legacy)).error);
        assert.ok((await verifyAccessJwt(legacy)).error);
        const session = await createJwt('user-1');
        assert.ifError((await verifyAccessJwt(session)).error);
    } finally {
        if (previousSecret === undefined)
            delete process.env.GREDICE_JWT_SIGN_SECRET;
        else process.env.GREDICE_JWT_SIGN_SECRET = previousSecret;
    }
});
