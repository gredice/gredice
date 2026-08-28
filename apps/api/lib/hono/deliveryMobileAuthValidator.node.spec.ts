import assert from 'node:assert/strict';
import test from 'node:test';
import {
    authorizeDeliveryMobileBearer,
    type DeliveryMobileAuthDeps,
} from './deliveryMobileAuthValidator';

function deps({
    payload = {
        sub: 'driver-1',
        account_id: 'account-1',
        scope: 'delivery:route:read',
    },
    role = 'driver',
    accountIds = ['account-1'],
    verificationError,
}: {
    payload?: Record<string, unknown>;
    role?: string;
    accountIds?: string[];
    verificationError?: unknown;
} = {}): DeliveryMobileAuthDeps {
    return {
        verifyAccessToken: async (token) => {
            assert.equal(token, 'native-token');
            return { payload, error: verificationError };
        },
        getUser: async (userId) => ({
            id: userId,
            role,
            accountIds,
        }),
    };
}

test('native delivery authorization requires a bearer token verified for the dedicated audience', async () => {
    assert.deepEqual(
        await authorizeDeliveryMobileBearer({
            authorization: undefined,
            deps: deps(),
        }),
        {
            authorized: false,
            status: 401,
            code: 'SESSION_REQUIRED',
        },
    );
    assert.deepEqual(
        await authorizeDeliveryMobileBearer({
            authorization: 'Bearer native-token',
            deps: deps({ verificationError: new Error('wrong audience') }),
        }),
        {
            authorized: false,
            status: 401,
            code: 'SESSION_REQUIRED',
        },
    );
});

test('native delivery authorization requires route scope, role, and account binding', async () => {
    for (const dependency of [
        deps({
            payload: {
                sub: 'driver-1',
                account_id: 'account-1',
                scope: 'profile:read',
            },
        }),
        deps({ role: 'user' }),
        deps({ accountIds: ['different-account'] }),
        deps({
            payload: {
                sub: 'driver-1',
                accountId: 'account-1',
                scope: 'delivery:route:read',
            },
        }),
    ]) {
        assert.deepEqual(
            await authorizeDeliveryMobileBearer({
                authorization: 'Bearer native-token',
                deps: dependency,
            }),
            {
                authorized: false,
                status: 403,
                code: 'DELIVERY_ROLE_REQUIRED',
            },
        );
    }
});

test('native delivery authorization accepts account-bound drivers and admins', async () => {
    for (const role of ['driver', 'admin']) {
        assert.deepEqual(
            await authorizeDeliveryMobileBearer({
                authorization: 'Bearer native-token',
                deps: deps({ role }),
            }),
            {
                authorized: true,
                context: {
                    userId: 'driver-1',
                    accountId: 'account-1',
                    role,
                },
            },
        );
    }
});

test('native delivery authorization accepts an array-form scope claim', async () => {
    const result = await authorizeDeliveryMobileBearer({
        authorization: 'Bearer native-token',
        deps: deps({
            payload: {
                sub: 'driver-1',
                account_id: 'account-1',
                scope: ['profile:read', 'delivery:route:read'],
            },
        }),
    });

    assert.equal(result.authorized, true);
});
