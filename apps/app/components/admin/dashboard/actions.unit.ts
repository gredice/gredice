import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

const storageExports = await import('@gredice/storage');
const calls: string[] = [];
let authError: Error | undefined;
const cachedAnalytics = { cached: true };

mock.module('../../../lib/auth/auth.ts', {
    namedExports: {
        auth: async (roles: string[]) => {
            calls.push('auth');
            assert.deepEqual(roles, ['admin']);
            if (authError) throw authError;
        },
    },
});
mock.module('@gredice/storage', {
    namedExports: {
        ...storageExports,
        redisCached: async () => {
            calls.push('cache');
            return cachedAnalytics;
        },
    },
});
const { getAnalyticsData } = await import('./actions.ts');

test('dashboard analytics rejects unauthorized callers before reading cached data', async () => {
    calls.length = 0;
    authError = new Error('Unauthorized');
    await assert.rejects(getAnalyticsData(7), authError);
    assert.deepEqual(calls, ['auth']);
});

test('dashboard analytics checks admin access before returning a cache hit', async () => {
    calls.length = 0;
    authError = undefined;
    assert.equal(await getAnalyticsData(7), cachedAnalytics);
    assert.deepEqual(calls, ['auth', 'cache']);
});
