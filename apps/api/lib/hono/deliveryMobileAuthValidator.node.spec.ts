import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import {
    authorizeDeliveryMobileBearer,
    createDeliveryMobileAuthValidator,
    type DeliveryMobileAuthDeps,
    type DeliveryMobileAuthVariables,
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

test('native delivery middleware maps authorization dependency failures to a private stable 503', async () => {
    let reported = 0;
    const dependencies = deps();
    dependencies.verifyAccessToken = async () => {
        throw new Error('private verification detail');
    };
    dependencies.onUnexpectedError = () => {
        reported += 1;
    };
    const app = new Hono<{
        Variables: DeliveryMobileAuthVariables;
    }>()
        .use('*', createDeliveryMobileAuthValidator(dependencies))
        .get('/', (context) => context.json({ ok: true }));

    const response = await app.request('/', {
        headers: { Authorization: 'Bearer native-token' },
    });

    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), {
        error: 'Ruta trenutačno nije dostupna.',
        code: 'ROUTE_TEMPORARILY_UNAVAILABLE',
    });
    assert.equal(reported, 1);
});
