import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createGardenPacksRoutes,
    type GardenPacksRouteDependencies,
} from '../../app/api/[...route]/gardenPacksRoutes';

function deps(
    overrides: Partial<GardenPacksRouteDependencies> = {},
): GardenPacksRouteDependencies {
    return {
        authValidator: () => async (context, next) => {
            context.set('authContext', {
                accountId: 'account-owner',
                userId: 'test-user',
                user: {
                    id: 'test-user',
                    accountIds: ['account-owner'],
                    isTemporary: false,
                    role: 'user',
                },
            });
            await next();
        },
        isStorageEnabled: () => false,
        isStorageReady: async () => true,
        getPage: async () => ({
            purchases: [],
            hasMore: false,
            nextCursor: null,
        }),
        getPurchase: async () => undefined,
        purchase: async () => ({
            ok: false,
            code: 'PACKS_DISABLED',
            error: 'Paketi trenutačno nisu dostupni.',
            status: 503,
        }),
        ...overrides,
    };
}

test('owned reads and purchase always authenticate before disabled readiness or storage', async () => {
    let accessed = false;
    const app = createGardenPacksRoutes(
        deps({
            authValidator: () => async (context) =>
                context.json({ error: 'Unauthorized' }, 401),
            isStorageReady: async () => {
                accessed = true;
                return true;
            },
        }),
    );
    for (const [path, method] of [
        ['/', 'GET'],
        [`/${randomUUID()}`, 'GET'],
        ['/purchase', 'POST'],
    ]) {
        const response = await app.request(path ?? '/', { method });
        assert.equal(response.status, 401);
    }
    assert.equal(accessed, false);
});

test('default-off and missing guards return hidden inventory without pack-table access', async () => {
    let accessed = false;
    const dependencies = deps({
        isStorageReady: async () => {
            accessed = true;
            return false;
        },
        getPage: async () => {
            throw new Error('Pack table touched');
        },
    });
    const app = createGardenPacksRoutes(dependencies);
    const disabled = await app.request('/');
    assert.equal(disabled.status, 200);
    assert.equal(disabled.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(await disabled.json(), {
        enabled: false,
        accountId: null,
        purchases: [],
        hasMore: false,
        nextCursor: null,
    });
    assert.equal(accessed, false);
    dependencies.isStorageEnabled = () => true;
    const notReady = await app.request('/');
    assert.equal(notReady.status, 200);
    assert.equal(accessed, true);
});

test('route owner derives from session, foreign detail is 404, pagination validates and no account input can override ownership', async () => {
    const owners: string[] = [];
    const app = createGardenPacksRoutes(
        deps({
            isStorageEnabled: () => true,
            getPage: async (accountId) => {
                owners.push(accountId);
                return { purchases: [], hasMore: false, nextCursor: null };
            },
            getPurchase: async (accountId) => {
                owners.push(accountId);
                return undefined;
            },
        }),
    );
    const list = await app.request('/?accountId=foreign');
    assert.equal(list.status, 200);
    assert.equal((await list.json()).accountId, 'account-owner');
    assert.equal((await app.request(`/${randomUUID()}`)).status, 404);
    assert.deepEqual(owners, ['account-owner', 'account-owner']);
    assert.equal((await app.request('/?limit=51')).status, 400);
    assert.equal((await app.request('/not-a-uuid')).status, 400);
});

test('purchase validator rejects owner and money overrides, matches authenticated account and maps durable receipt/failures', async () => {
    const purchaseId = randomUUID();
    const command = {
        operationId: randomUUID(),
        productId: 'test-pack',
        quote: {
            productVersionId: 'test:v1',
            chargedSunflowers: 11,
            currency: 'sunflower',
        },
    };
    const app = createGardenPacksRoutes(
        deps({
            purchase: async (accountId, body) => {
                assert.equal(accountId, 'account-owner');
                assert.deepEqual(body, command);
                return {
                    ok: true,
                    replayed: true,
                    receipt: {
                        purchaseId,
                        productId: 'test-pack',
                        productVersionId: 'test:v1',
                        chargedSunflowers: 11,
                        currency: 'sunflower',
                        purchasedAt: '2026-10-02T00:00:00Z',
                        totalQuantity: 2,
                    },
                };
            },
        }),
    );
    const request = (body: unknown) =>
        app.request('/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    const valid = await request(command);
    assert.equal(valid.status, 200);
    assert.equal((await valid.json()).purchaseId, purchaseId);
    assert.equal(
        (await request({ ...command, accountId: 'foreign' })).status,
        400,
    );
    assert.equal(
        (
            await request({
                ...command,
                quote: { ...command.quote, chargedSunflowers: 0 },
            })
        ).status,
        400,
    );
    assert.equal((await request({ ...command, contents: [] })).status, 400);
    const failed = createGardenPacksRoutes(deps());
    assert.equal(
        (
            await failed.request('/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(command),
            })
        ).status,
        503,
    );
});
