import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeliveryMobileAccessJwt, createJwt, verifyJwt } from './auth';

test('createJwt supports account-bound payloads', async () => {
    const previousSecret = process.env.GREDICE_JWT_SIGN_SECRET;
    process.env.GREDICE_JWT_SIGN_SECRET = Buffer.from(
        'test-secret-test-secret-test-secret',
    ).toString('base64');

    try {
        const token = await createJwt(
            { sub: 'user-1', accountId: 'account-1' },
            '72h',
        );
        const { result, error } = await verifyJwt(token, { expiry: '72h' });

        assert.ifError(error);
        assert.equal(result?.payload.sub, 'user-1');
        assert.equal(result?.payload.accountId, 'account-1');
    } finally {
        if (previousSecret === undefined) {
            delete process.env.GREDICE_JWT_SIGN_SECRET;
        } else {
            process.env.GREDICE_JWT_SIGN_SECRET = previousSecret;
        }
    }
});

test('native access JWT uses a dedicated audience and read-only account scope', async () => {
    const previousSecret = process.env.GREDICE_JWT_SIGN_SECRET;
    process.env.GREDICE_JWT_SIGN_SECRET = Buffer.from(
        'test-secret-test-secret-test-secret',
    ).toString('base64');

    try {
        const token = await createDeliveryMobileAccessJwt({
            userId: 'driver-1',
            accountId: 'account-1',
            scope: 'delivery:route:read',
            expiresInMs: 15 * 60 * 1_000,
        });
        const native = await verifyJwt(token, {
            audience: 'delivery-android',
        });
        const web = await verifyJwt(token);

        assert.ifError(native.error);
        assert.equal(native.result?.payload.sub, 'driver-1');
        assert.equal(native.result?.payload.account_id, 'account-1');
        assert.equal(native.result?.payload.scope, 'delivery:route:read');
        assert.ok(web.error);
        assert.equal(web.result, undefined);
    } finally {
        if (previousSecret === undefined) {
            delete process.env.GREDICE_JWT_SIGN_SECRET;
        } else {
            process.env.GREDICE_JWT_SIGN_SECRET = previousSecret;
        }
    }
});
