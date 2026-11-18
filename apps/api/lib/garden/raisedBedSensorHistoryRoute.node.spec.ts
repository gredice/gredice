import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Hono } from 'hono';
import { type AuthVariables, authValidator } from '../hono/authValidator';
import { raisedBedSensorHistoryRoute } from './raisedBedSensorHistoryRoute';
import { readRaisedBedSensorHistory } from './readRaisedBedSensorHistory';

const basePath = '/api/gardens/85/raised-beds/188/sensors';
const moisturePath = `${basePath}/31/soil_moisture`;
const upstreamValues = [
    { timeStamp: '2026-11-17T09:42:00Z', valueSerialized: '0' },
    { timeStamp: '2026-11-17T09:43:00Z', valueSerialized: '34.5' },
    { timeStamp: '2026-11-17T09:44:00Z' },
    { valueSerialized: null },
];

const previousKey = process.env.SIGNALCO_API_KEY;
before(() => {
    process.env.SIGNALCO_API_KEY = 'test-signalco-key';
});
after(() => {
    if (previousKey === undefined) {
        delete process.env.SIGNALCO_API_KEY;
    } else {
        process.env.SIGNALCO_API_KEY = previousKey;
    }
});

function appWithHistory(
    overrides: Partial<
        NonNullable<Parameters<typeof raisedBedSensorHistoryRoute>[0]>
    > = {},
) {
    return new Hono<{ Variables: AuthVariables }>().route(
        '/api/gardens',
        raisedBedSensorHistoryRoute({
            auth: (roles) => async (context, next) => {
                assert.deepEqual(roles, ['user', 'admin']);
                context.set('authContext', {
                    accountId: 'account-1',
                    userId: 'user-1',
                    user: {
                        id: 'user-1',
                        accountIds: ['account-1'],
                        isTemporary: false,
                        role: 'user',
                    },
                });
                await next();
            },
            getRaisedBed: async () => ({
                gardenId: 85,
                accountId: 'account-1',
            }),
            getRaisedBedSensors: async () => [
                { id: 31, sensorSignalcoId: 'owned-sensor' },
                { id: 32, sensorSignalcoId: null },
            ],
            ...overrides,
        }),
    );
}

function connectionReset() {
    return new TypeError('fetch failed', {
        cause: Object.assign(new Error('Socket disconnected before TLS'), {
            code: 'ECONNRESET',
        }),
    });
}

test('authorized moisture history retries a TLS reset and a gateway error, preserving the Signalco readings', async (t) => {
    const requests: URL[] = [];
    const recovered = t.mock.method(console, 'warn', () => {});
    t.mock.method(globalThis, 'fetch', async (request: Request) => {
        assert.equal(request.method, 'GET');
        assert.equal(request.cache, 'no-store');
        requests.push(new URL(request.url));
        if (requests.length === 1) throw connectionReset();
        if (requests.length === 2) return new Response(null, { status: 502 });
        return Response.json({ values: upstreamValues });
    });

    const response = await appWithHistory().request(moisturePath);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), {
        id: 31,
        type: 'soil_moisture',
        values: upstreamValues,
    });
    assert.equal(requests.length, 3);
    for (const url of requests) {
        assert.equal(url.origin, 'https://api.signalco.io');
        assert.equal(url.pathname, '/api/contact/history');
        assert.deepEqual(Object.fromEntries(url.searchParams), {
            entityId: 'owned-sensor',
            channelName: 'zigbee2mqtt',
            contactName: 'soil_moisture',
            duration: '5.00:00',
        });
    }
    assert.equal(recovered.mock.callCount(), 1);
});

test('persistent TLS resets stop after three attempts and return a private 503 without readings', async (t) => {
    const logged = t.mock.method(console, 'error', () => {});
    const fetch = t.mock.method(globalThis, 'fetch', async () => {
        throw connectionReset();
    });
    const response = await appWithHistory().request(moisturePath);
    assert.equal(fetch.mock.callCount(), 3);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), {
        error: 'Sensor history unavailable',
    });
    assert.deepEqual(logged.mock.calls[0]?.arguments, [
        'Signalco sensor history read failed',
        { attempts: 3, reason: 'ECONNRESET' },
    ]);
    assert.equal(logged.mock.callCount(), 1);
});

test('the per-attempt deadline aborts a stalled response body and retries with a fresh signal', async (t) => {
    const signals: AbortSignal[] = [];
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    t.mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
        assert.equal(milliseconds, 2_000);
        return timeout(25);
    });
    t.mock.method(console, 'warn', () => {});
    t.mock.method(globalThis, 'fetch', async (request: Request) => {
        const { signal } = request;
        signals.push(signal);
        if (signals.length > 1) {
            return Response.json({ values: upstreamValues });
        }
        return new Response(
            new ReadableStream({
                start(controller) {
                    const keepAlive = setTimeout(
                        () => controller.close(),
                        1_000,
                    );
                    signal.addEventListener(
                        'abort',
                        () => {
                            clearTimeout(keepAlive);
                            controller.error(signal.reason);
                        },
                        { once: true },
                    );
                },
            }),
        );
    });

    const response = await appWithHistory().request(moisturePath);
    assert.equal(response.status, 200);
    assert.equal(signals.length, 2);
    assert.equal(signals[0]?.reason.name, 'TimeoutError');
    assert.equal(signals[1]?.aborted, false);
});

test('non-retryable upstream responses return an error with no history', async (t) => {
    t.mock.method(console, 'error', () => {});
    const failures = [
        {
            status: 502,
            upstream: () => new Response('invalid query', { status: 400 }),
        },
        {
            status: 502,
            upstream: () =>
                new Response('private upstream details', { status: 401 }),
        },
        { status: 503, upstream: () => new Response(null, { status: 429 }) },
        {
            status: 503,
            upstream: () =>
                new Response(null, {
                    status: 503,
                    headers: { 'retry-after': '30' },
                }),
        },
        { status: 502, upstream: () => new Response('not json') },
        {
            status: 502,
            upstream: () => Response.json({ error: 'unavailable' }),
        },
        { status: 502, upstream: () => Response.json({ values: [17] }) },
        { status: 502, upstream: () => Response.json({ values: [null] }) },
        {
            status: 502,
            upstream: () => Response.json({ values: [{ timeStamp: 17 }] }),
        },
        {
            status: 502,
            upstream: () => Response.json({ values: [{ valueSerialized: 0 }] }),
        },
        {
            status: 502,
            upstream: () => {
                throw new TypeError('fetch failed', {
                    cause: Object.assign(new Error('certificate has expired'), {
                        code: 'CERT_HAS_EXPIRED',
                    }),
                });
            },
        },
    ];
    for (const { status, upstream } of failures) {
        const fetch = t.mock.method(globalThis, 'fetch', async () =>
            upstream(),
        );
        const response = await appWithHistory().request(moisturePath);
        assert.equal(response.status, status);
        assert.deepEqual(await response.json(), {
            error: 'Sensor history unavailable',
        });
        assert.equal(fetch.mock.callCount(), 1);
        fetch.mock.restore();
    }
});

test('an explicit empty temperature history succeeds and keeps the selected range', async (t) => {
    const fetch = t.mock.method(
        globalThis,
        'fetch',
        async (request: Request) => {
            const url = new URL(request.url);
            assert.equal(url.searchParams.get('contactName'), 'temperature');
            assert.equal(url.searchParams.get('duration'), '30.00:00');
            return Response.json({ values: [] });
        },
    );
    const response = await appWithHistory().request(
        `${basePath}/31/soil_temperature?duration=30`,
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        id: 31,
        type: 'soil_temperature',
        values: [],
    });
    assert.equal(fetch.mock.callCount(), 1);
});

test('unauthenticated requests, account and garden mismatches, and unbound sensors never contact Signalco', async (t) => {
    const fetch = t.mock.method(
        globalThis,
        'fetch',
        async () => new Response(),
    );
    const unavailableSensors = t.mock.fn(async () => []);
    const cases = [
        {
            app: appWithHistory({
                auth: authValidator,
                getRaisedBedSensors: unavailableSensors,
            }),
            path: moisturePath,
            status: 401,
        },
        {
            app: appWithHistory({
                getRaisedBed: async () => ({
                    accountId: 'other-account',
                    gardenId: 85,
                }),
                getRaisedBedSensors: unavailableSensors,
            }),
            path: moisturePath,
            status: 404,
        },
        {
            app: appWithHistory({
                getRaisedBed: async () => ({
                    accountId: 'account-1',
                    gardenId: 86,
                }),
                getRaisedBedSensors: unavailableSensors,
            }),
            path: moisturePath,
            status: 404,
        },
        {
            app: appWithHistory(),
            path: `${basePath}/99/soil_moisture`,
            status: 404,
        },
        {
            app: appWithHistory(),
            path: `${basePath}/32/soil_moisture`,
            status: 404,
        },
    ];
    for (const { app, path, status } of cases) {
        const response = await app.request(path);
        assert.equal(response.status, status);
    }
    assert.equal(unavailableSensors.mock.callCount(), 0);
    assert.equal(fetch.mock.callCount(), 0);
});

test('client cancellation stops the retry backoff', async (t) => {
    const controller = new AbortController();
    const fetch = t.mock.method(globalThis, 'fetch', async () => {
        setTimeout(() => controller.abort(), 10);
        throw connectionReset();
    });
    await assert.rejects(
        readRaisedBedSensorHistory(
            'owned-sensor',
            'soil_moisture',
            '5',
            controller.signal,
        ),
        { name: 'AbortError' },
    );
    assert.equal(fetch.mock.callCount(), 1);
});
