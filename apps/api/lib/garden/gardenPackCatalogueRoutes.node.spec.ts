import assert from 'node:assert/strict';
import test from 'node:test';
import { createGardenPackCatalogueRoutes } from '../../app/api/[...route]/gardenPackCatalogueRoutes';

type Dependencies = NonNullable<
    Parameters<typeof createGardenPackCatalogueRoutes>[0]
>;
function dependencies(overrides: Partial<Dependencies> = {}): Dependencies {
    return {
        auth: () => async (context, next) => {
            context.set('authContext', {
                accountId: 'owner',
                userId: 'user',
                user: {
                    id: 'user',
                    accountIds: ['owner'],
                    isTemporary: false,
                    role: 'user',
                },
            });
            await next();
        },
        storageEnabled: () => true,
        salesEnabled: () => true,
        ready: async () => true,
        offers: async () => [],
        ...overrides,
    };
}

test('authentication precedes rollout and readiness', async () => {
    let accessed = false;
    const app = createGardenPackCatalogueRoutes(
        dependencies({
            auth: () => async (context) =>
                context.json({ error: 'Unauthorized' }, 401),
            ready: async () => {
                accessed = true;
                return true;
            },
        }),
    );
    assert.equal((await app.request('/')).status, 401);
    assert.equal(accessed, false);
});

test('storage/sales off and missing guards never access the catalogue', async () => {
    for (const override of [
        { storageEnabled: () => false },
        { salesEnabled: () => false },
        { ready: async () => false },
    ]) {
        const app = createGardenPackCatalogueRoutes(
            dependencies({
                ...override,
                offers: async () => {
                    throw new Error('Must not access source');
                },
            }),
        );
        const response = await app.request('/');
        assert.equal(response.status, 200);
        assert.equal(
            response.headers.get('Cache-Control'),
            'private, no-store',
        );
        assert.deepEqual(await response.json(), {
            enabled: false,
            accountId: null,
            offers: [],
        });
    }
});

test('catalogue owner is session-derived and temporary failures are sanitized', async () => {
    const response = await createGardenPackCatalogueRoutes(
        dependencies(),
    ).request('/?accountId=foreign');
    assert.deepEqual(await response.json(), {
        enabled: true,
        accountId: 'owner',
        offers: [],
    });
    for (const override of [
        {
            ready: async () => {
                throw new Error('private database error');
            },
        },
        {
            offers: async () => {
                throw new Error('private source error');
            },
        },
    ]) {
        const failed = await createGardenPackCatalogueRoutes(
            dependencies(override),
        ).request('/');
        assert.equal(failed.status, 503);
        assert.deepEqual(await failed.json(), {
            error: 'Ponudu paketa trenutačno nije moguće učitati.',
        });
    }
});
