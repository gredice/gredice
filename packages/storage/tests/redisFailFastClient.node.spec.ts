import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createTcpServer, type Socket } from 'node:net';
import { performance } from 'node:perf_hooks';
import test, { type TestContext } from 'node:test';
import { redisFailFastClient } from '../src/cache/redisCache';

async function listen(
    server: Readonly<{
        listen: (port: number, host: string, callback: () => void) => unknown;
        address: () => unknown;
    }>,
) {
    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address();
    assert.ok(
        typeof address === 'object' &&
            address !== null &&
            'port' in address &&
            typeof address.port === 'number',
    );
    return `http://127.0.0.1:${address.port.toString()}`;
}

function useGrediceRedisCredentials(t: TestContext, url: string) {
    const previousUrl = process.env.GREDICE_SILO_KV_REST_API_URL;
    const previousToken = process.env.GREDICE_SILO_KV_REST_API_TOKEN;
    process.env.GREDICE_SILO_KV_REST_API_URL = url;
    process.env.GREDICE_SILO_KV_REST_API_TOKEN = 'disposable-test-only';
    t.after(() => {
        if (previousUrl === undefined)
            delete process.env.GREDICE_SILO_KV_REST_API_URL;
        else process.env.GREDICE_SILO_KV_REST_API_URL = previousUrl;
        if (previousToken === undefined)
            delete process.env.GREDICE_SILO_KV_REST_API_TOKEN;
        else process.env.GREDICE_SILO_KV_REST_API_TOKEN = previousToken;
    });
}

test('fail-fast Redis client is null without credentials and rejects invalid timeouts', () => {
    const previousUrl = process.env.PLANTS_SILO_KV_REST_API_URL;
    delete process.env.PLANTS_SILO_KV_REST_API_URL;
    try {
        assert.equal(redisFailFastClient('plants', { timeoutMs: 100 }), null);
    } finally {
        if (previousUrl !== undefined)
            process.env.PLANTS_SILO_KV_REST_API_URL = previousUrl;
    }
    for (const timeoutMs of [0, -1, 1.5, Number.NaN]) {
        assert.throws(
            () => redisFailFastClient('gredice', { timeoutMs }),
            RangeError,
        );
    }
});

test('fail-fast Redis client sends single commands through the REST transport', async (t) => {
    const requests: { path: string | undefined; body: string }[] = [];
    const server = createHttpServer((request, response) => {
        let body = '';
        request.on('data', (chunk) => {
            body += String(chunk);
        });
        request.on('end', () => {
            requests.push({ path: request.url, body });
            response.writeHead(200, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ result: 3 }));
        });
    });
    const url = await listen(server);
    t.after(
        () => new Promise<void>((resolve) => server.close(() => resolve())),
    );
    useGrediceRedisCredentials(t, url);

    const client = redisFailFastClient('gredice', { timeoutMs: 1_000 });
    assert.ok(client);
    assert.equal(redisFailFastClient('gredice', { timeoutMs: 1_000 }), client);
    assert.equal(await client.incr('rate:key'), 3);
    assert.deepEqual(requests, [
        { path: '/', body: JSON.stringify(['incr', 'rate:key']) },
    ]);
});

test('fail-fast Redis client aborts a stalled command after its timeout without retrying', async (t) => {
    const sockets = new Set<Socket>();
    let connections = 0;
    const server = createTcpServer((socket) => {
        connections++;
        sockets.add(socket);
        socket.on('error', () => undefined);
        socket.on('close', () => sockets.delete(socket));
        // Read and drop the request, never answer.
        socket.resume();
    });
    const url = await listen(server);
    t.after(async () => {
        for (const socket of sockets) socket.destroy();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });
    useGrediceRedisCredentials(t, url);

    const client = redisFailFastClient('gredice', { timeoutMs: 150 });
    assert.ok(client);
    const startedAt = performance.now();
    await assert.rejects(client.incr('rate:key'), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.name, 'TimeoutError');
        return true;
    });
    const elapsedMs = performance.now() - startedAt;
    assert.ok(elapsedMs >= 100, `rejected after ${elapsedMs.toFixed(0)} ms`);
    assert.ok(elapsedMs < 1_500, `rejected after ${elapsedMs.toFixed(0)} ms`);

    // The default cache client would retry with backoff here.
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(connections, 1);
    assert.equal(sockets.size, 0, 'the aborted request closed its socket');
});
