import assert from 'node:assert/strict';
import test from 'node:test';
import { revalidatePublicNewsPages } from './publicNewsPages';

test('successful public invalidation never writes durable retry data', async (t) => {
    const originalEnv = { ...process.env };
    const originalFetch = globalThis.fetch;
    t.after(() => {
        process.env = originalEnv;
        globalThis.fetch = originalFetch;
    });
    process.env.VERCEL_ENV = 'production';
    process.env.GREDICE_NEWS_REVALIDATE_SECRET = 'test';
    const calls: string[] = [];
    globalThis.fetch = async (url, init) => {
        calls.push(String(url));
        assert.equal(
            init?.headers && new Headers(init.headers).get('authorization'),
            'Bearer test',
        );
        assert.deepEqual(JSON.parse(String(init?.body)), {
            slugs: ['novosti/a'],
        });
        return Response.json({ revalidated: true });
    };
    await revalidatePublicNewsPages(['page', 'novosti/a', 'novosti/a']);
    assert.deepEqual(calls, [
        'https://novosti.gredice.com/novosti/api/revalidate',
    ]);
    await revalidatePublicNewsPages(['private-page', null]);
    assert.equal(calls.length, 1);
});

test('failed public invalidation queues deduplicated slugs and save success survives retry outage', async (t) => {
    const originalEnv = { ...process.env };
    const originalFetch = globalThis.fetch;
    t.after(() => {
        process.env = originalEnv;
        globalThis.fetch = originalFetch;
    });
    process.env.VERCEL_ENV = 'production';
    process.env.GREDICE_NEWS_REVALIDATE_SECRET = 'test';
    process.env.GREDICE_NEWS_REVALIDATE_REST_API_URL = 'https://retry.invalid';
    process.env.GREDICE_NEWS_REVALIDATE_REST_API_TOKEN = 'test';
    const calls: string[] = [];
    globalThis.fetch = async (url, init) => {
        calls.push(String(url));
        if (calls.length === 1) return Response.json({}, { status: 503 });
        const command = JSON.parse(String(init?.body));
        assert.equal(command[0], 'EVAL');
        assert.equal(command[3], 'cms-news:production:revalidation:v1');
        assert.deepEqual(command.slice(5), ['novosti/old', 'novosti/new']);
        return Response.json({ result: 1 });
    };
    await revalidatePublicNewsPages([
        'novosti/old',
        'novosti/new',
        'novosti/old',
    ]);
    assert.deepEqual(calls, [
        'https://novosti.gredice.com/novosti/api/revalidate',
        'https://retry.invalid',
    ]);
    globalThis.fetch = async () => {
        throw new Error('Outage');
    };
    await assert.doesNotReject(() =>
        revalidatePublicNewsPages(['novosti/new']),
    );
});

test('preview runtime takes precedence over a copied public production flag', async (t) => {
    const originalEnv = { ...process.env };
    const originalFetch = globalThis.fetch;
    t.after(() => {
        process.env = originalEnv;
        globalThis.fetch = originalFetch;
    });
    process.env.VERCEL_ENV = 'preview';
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production';
    delete process.env.GREDICE_NEWS_REVALIDATE_URL;
    let calls = 0;
    globalThis.fetch = async () => {
        calls++;
        throw new Error('Production must not be contacted');
    };
    await revalidatePublicNewsPages(['novosti/a']);
    assert.equal(calls, 0);
});
