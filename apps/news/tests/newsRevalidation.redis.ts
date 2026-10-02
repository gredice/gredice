import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { setTimeout } from 'node:timers/promises';
import {
    acknowledgeNewsRevalidations,
    enqueueNewsRevalidation,
    readPendingNewsRevalidations,
} from '@gredice/storage/cmsNewsRevalidation';

test('durable retry survives failed reads and concurrent changes without losing newer work', async (t) => {
    const originalFetch = globalThis.fetch;
    const testUrl = process.env.GREDICE_NEWS_RETRY_TEST_URL;
    const testToken = process.env.GREDICE_NEWS_RETRY_TEST_TOKEN;
    const key = `cms-news:verification:${randomUUID()}`;
    let redis: (command: (string | number)[]) => Promise<unknown>;
    if (testUrl && testToken) {
        redis = async (command) => {
            const response = await originalFetch(testUrl, {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${testToken}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify(command),
                signal: AbortSignal.timeout(5000),
            });
            assert.equal(response.status, 200);
            const payload: unknown = await response.json();
            assert.ok(
                payload && typeof payload === 'object' && 'result' in payload,
            );
            return payload.result;
        };
        // Only remove this random verification key; never scan/flush shared storage.
        t.after(() => redis(['DEL', key]));
    } else {
        const container = execFileSync(
            'docker',
            ['run', '--rm', '--detach', 'redis:7-alpine'],
            { encoding: 'utf8' },
        ).trim();
        t.after(() =>
            execFileSync('docker', ['rm', '--force', container], {
                stdio: 'ignore',
            }),
        );
        redis = async (command) =>
            JSON.parse(
                execFileSync(
                    'docker',
                    [
                        'exec',
                        container,
                        'redis-cli',
                        '--json',
                        ...command.map(String),
                    ],
                    { encoding: 'utf8' },
                ),
            );
    }
    for (let attempt = 0; ; attempt++) {
        try {
            assert.equal(await redis(['PING']), 'PONG');
            break;
        } catch {
            assert.ok(attempt < 10);
            await setTimeout(100);
        }
    }
    const originalEnv = { ...process.env };
    t.after(() => {
        globalThis.fetch = originalFetch;
        process.env = originalEnv;
    });
    process.env.GREDICE_NEWS_REVALIDATE_REST_API_URL = 'https://retry.invalid';
    process.env.GREDICE_NEWS_REVALIDATE_REST_API_TOKEN = 'test';
    process.env.GREDICE_NEWS_REVALIDATE_KEY = key;
    globalThis.fetch = async (_input, init) => {
        const command: unknown = JSON.parse(String(init?.body));
        assert.ok(Array.isArray(command));
        assert.ok(
            command.every(
                (value) =>
                    typeof value === 'string' || typeof value === 'number',
            ),
        );
        return Response.json({ result: await redis(command) });
    };
    assert.deepEqual(await readPendingNewsRevalidations(), []);
    await enqueueNewsRevalidation(['novosti/a', 'novosti/a']);
    const first = await readPendingNewsRevalidations();
    assert.equal(first.length, 1);
    assert.equal(await redis(['TTL', key]), -1);
    const workingFetch = globalThis.fetch;
    globalThis.fetch = async () => {
        throw new Error('Outage');
    };
    await assert.rejects(readPendingNewsRevalidations);
    globalThis.fetch = workingFetch;
    assert.deepEqual(await readPendingNewsRevalidations(), first);
    await enqueueNewsRevalidation(['novosti/a']);
    await acknowledgeNewsRevalidations(first);
    const newer = await readPendingNewsRevalidations();
    assert.equal(newer.length, 1);
    assert.notEqual(newer[0]?.token, first[0]?.token);
    await acknowledgeNewsRevalidations(newer);
    assert.deepEqual(await readPendingNewsRevalidations(), []);
    const longSlug = `novosti/${'a'.repeat(10_000)}`;
    await enqueueNewsRevalidation([longSlug]);
    const longPending = await readPendingNewsRevalidations();
    assert.equal(longPending.length, 1);
    assert.match(longPending[0]?.slug ?? '', /^tag:[\w-]{43}$/u);
    await acknowledgeNewsRevalidations(longPending);
    assert.deepEqual(await readPendingNewsRevalidations(), []);
    // Admission is atomic at the bound; never discard admitted work to make room.
    for (let i = 0; i < 512; i += 8) {
        await enqueueNewsRevalidation(
            Array.from({ length: 8 }, (_, offset) => `novosti/p-${i + offset}`),
        );
    }
    await assert.rejects(
        () => enqueueNewsRevalidation(['novosti/overflow']),
        /full/u,
    );
    assert.equal((await readPendingNewsRevalidations()).length, 512);
    await enqueueNewsRevalidation(['novosti/p-0']);
    await assert.rejects(
        () =>
            enqueueNewsRevalidation(
                Array.from({ length: 9 }, (_, i) => `novosti/x-${i}`),
            ),
        /Too many/u,
    );
});
