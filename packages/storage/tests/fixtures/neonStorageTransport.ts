import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { Duplex } from 'node:stream';
import test from 'node:test';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { neonPoolErrorDetails } from '../../src/neonPoolError';
import { closeStorage, storage } from '../../src/storage';

function postgresMessage(type: string, payload: Buffer) {
    const header = Buffer.alloc(5);
    header.write(type);
    header.writeInt32BE(payload.length + 4, 1);
    return Buffer.concat([header, payload]);
}

function sendBinary(socket: Duplex, payload: Buffer) {
    assert.ok(payload.length < 126);
    socket.write(Buffer.concat([Buffer.from([0x82, payload.length]), payload]));
}

test('real WebSocket transport distinguishes pool teardown from failures', async (t) => {
    // A loopback PostgreSQL/WebSocket peer that ends TCP on Postgres Terminate
    // without a WebSocket close handshake. No credentials or external traffic.
    const peers = new Set<Duplex>();
    const server = createServer();
    let terminations = 0;
    server.on('upgrade', (request, socket) => {
        const key = request.headers['sec-websocket-key'];
        assert.equal(typeof key, 'string');
        const accept = createHash('sha1')
            .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
            .digest('base64');
        socket.write(
            'HTTP/1.1 101 Switching Protocols\r\n' +
                'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
                `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
        );
        peers.add(socket);
        socket.on('close', () => peers.delete(socket));
        let pending = Buffer.alloc(0);
        let started = false;
        socket.on('data', (chunk: Buffer) => {
            pending = Buffer.concat([pending, chunk]);
            while (pending.length >= 6) {
                const opcode = pending[0] & 0x0f;
                const length = pending[1] & 0x7f;
                assert.ok(length < 126, 'fixture uses short masked frames');
                if (pending.length < length + 6) return;
                const mask = pending.subarray(2, 6);
                const payload = Buffer.from(pending.subarray(6, length + 6));
                for (let index = 0; index < length; index += 1) {
                    payload[index] ^= mask[index % 4];
                }
                pending = pending.subarray(length + 6);
                if (opcode === 8) {
                    socket.destroy();
                    return;
                }
                if (payload[0] === 0x58) {
                    terminations += 1;
                    socket.destroy();
                    return;
                }
                if (!started) {
                    started = true;
                    sendBinary(
                        socket,
                        Buffer.concat([
                            postgresMessage('R', Buffer.alloc(4)),
                            postgresMessage('Z', Buffer.from('I')),
                        ]),
                    );
                } else if (payload[0] === 0x51) {
                    if (payload.toString().includes('disconnect')) {
                        socket.destroy();
                        return;
                    }
                    sendBinary(
                        socket,
                        Buffer.concat([
                            postgresMessage('C', Buffer.from('SELECT 0\0')),
                            postgresMessage('Z', Buffer.from('I')),
                        ]),
                    );
                }
            }
        });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    neonConfig.wsProxy = () => `127.0.0.1:${address.port}`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineConnect = false;
    neonConfig.coalesceWrites = false;
    t.after(async () => {
        await closeStorage();
        for (const socket of peers) socket.destroy();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });
    const nativeWebSocket = globalThis.WebSocket;

    await t.test(
        'native transport reproduces seven errors after idle eviction',
        async () => {
            const pool = new Pool({
                connectionString: process.env.POSTGRES_URL,
                idleTimeoutMillis: 10,
            });
            const errors: unknown[] = [];
            pool.on('error', (error: unknown) => {
                errors.push(error);
                assert.equal(pool.totalCount, 0);
                assert.equal(pool.idleCount, 0);
                assert.equal(pool.waitingCount, 0);
            });
            t.after(() => pool.end());
            const clients = await Promise.all(
                Array.from({ length: 7 }, () => pool.connect()),
            );
            const ended = clients.map(
                (client) =>
                    new Promise<void>((resolve) => client.once('end', resolve)),
            );
            for (const client of clients) client.release();
            await Promise.all(ended);
            assert.equal(terminations, 7);
            assert.equal(errors.length, 7);
            for (const error of errors) {
                assert.deepEqual(neonPoolErrorDetails(error), {
                    kind: 'error-event',
                    code: undefined,
                });
            }
        },
    );

    const db = storage();
    assert.ok('$client' in db && db.$client instanceof Pool);
    const pool = db.$client;
    pool.options.idleTimeoutMillis = 10;
    const logs = t.mock.method(console, 'error', () => undefined);

    await t.test(
        'storage transport does not report its own idle teardown as a failure',
        async () => {
            assert.equal(globalThis.WebSocket, nativeWebSocket);
            const clients = await Promise.all(
                Array.from({ length: 7 }, () => pool.connect()),
            );
            const ended = clients.map((client) => once(client, 'end'));
            for (const client of clients) client.release();
            await Promise.all(ended);
            assert.equal(terminations, 14);
            assert.equal(logs.mock.callCount(), 0);
            assert.equal(pool.totalCount, 0);
            await pool.query('select 1');
        },
    );

    await t.test(
        'unexpected idle peer loss still produces sanitized diagnostics',
        async () => {
            const client = await pool.connect();
            const error = once(pool, 'error');
            const ended = new Promise<void>((resolve) =>
                client.once('end', resolve),
            );
            client.release();
            for (const socket of peers) socket.destroy();
            await error;
            await ended;
            assert.deepEqual(logs.mock.calls.at(-1)?.arguments, [
                'Neon pool background connection error',
                {
                    event: 'storage.neon.pool.error',
                    error: { kind: 'error', code: undefined },
                    totalCount: 0,
                    idleCount: 0,
                    waitingCount: 0,
                },
            ]);
            assert.equal(logs.mock.callCount(), 1);
            assert.doesNotMatch(
                JSON.stringify(logs.mock.calls),
                /secret|postgresql|127\.0\.0\.1/,
            );
        },
    );

    await t.test(
        'active transport loss rejects the query and permits replacement',
        async () => {
            await assert.rejects(pool.query('select disconnect'), {
                message: 'Connection terminated unexpectedly',
            });
            assert.equal(logs.mock.callCount(), 1);
            await pool.query('select 1');
        },
    );
});
