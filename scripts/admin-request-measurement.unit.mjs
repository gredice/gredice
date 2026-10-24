import assert from 'node:assert/strict';
import test from 'node:test';
import {
    adminMeasurementPaths,
    adminMeasurementStorageState,
    measureAdminRequests,
    parseAdminMeasurementOptions,
    sanitizeAdminNetworkRequest,
    sanitizeAdminResponseHeaders,
    summarizeAdminNetworkRequests,
    validateAdminMeasurementOrigin,
} from './admin-request-measurement.mjs';

const origin = 'https://app.gredice.com';

test('measurement requires a local state and constrains origin, paths, and runtime', () => {
    assert.throws(() => parseAdminMeasurementOptions([]));
    assert.throws(() =>
        parseAdminMeasurementOptions([
            '--storage-state',
            'https://private/state',
        ]),
    );
    for (const value of [
        'https://attacker.example',
        'https://app.gredice.com.evil.example',
        'https://user:secret@app.gredice.com',
        'https://app.gredice.com/admin',
        'https://app.gredice.com?token=secret',
        'https://app.gredice.com/#secret',
        'file:///private/state',
    ]) {
        assert.throws(() => validateAdminMeasurementOrigin(value));
    }
    assert.equal(validateAdminMeasurementOrigin(origin), origin);
    assert.equal(
        validateAdminMeasurementOrigin('http://127.0.0.1:4567'),
        'http://127.0.0.1:4567',
    );
    assert.equal(
        parseAdminMeasurementOptions([
            '--storage-state',
            './ignored-state.json',
        ]).idleMs,
        15000,
    );
    for (const args of [
        ['--idle-ms', 'Infinity'],
        ['--idle-ms', '0'],
        ['--idle-ms', '60001'],
        ['--idle-ms', '1e4'],
        ['--timeout-ms', '120001'],
        ['--timeout-ms', '30000', '--idle-ms', '30000'],
        ['--settle-ms', '0'],
        ['--routes', '/admin/accounts/private'],
        ['--output', '/private/report.json'],
        ['--idle-ms', '1000', '--idle-ms', '1000'],
    ]) {
        assert.throws(() =>
            parseAdminMeasurementOptions([
                '--storage-state',
                'state.json',
                ...args,
            ]),
        );
    }
    assert.equal(adminMeasurementPaths.includes('/admin/automations'), false);
});

test('local state loads only target Admin session cookies without local storage', () => {
    const cookie = {
        name: 'gredice_session',
        value: 'private',
        domain: '.gredice.com',
    };
    const state = adminMeasurementStorageState(
        {
            cookies: [
                cookie,
                { ...cookie, domain: '.com' },
                { ...cookie, domain: 'attacker.example' },
                { ...cookie, name: 'unrelated-authentication' },
                { ...cookie, value: 5 },
            ],
            origins: [
                {
                    origin,
                    localStorage: [{ name: 'secret', value: 'private' }],
                },
            ],
        },
        origin,
    );
    assert.deepEqual(state, { cookies: [cookie], origins: [] });
    assert.throws(() => adminMeasurementStorageState({ cookies: [] }, origin));
    assert.throws(() =>
        adminMeasurementStorageState(
            { cookies: [cookie] },
            'http://localhost:4567',
        ),
    );
});

test('sanitized network attribution never retains paths, queries, or header values', () => {
    const request = sanitizeAdminNetworkRequest(
        {
            url: `${origin}/admin/accounts/private-id?token=secret-query`,
            method: 'POST',
            headers: {
                rsc: '1',
                'next-router-prefetch': '1',
                'next-router-segment-prefetch': '/admin/accounts/private-id',
                'sec-purpose': 'prefetch;prerender',
                authorization: 'Bearer private-token',
                cookie: 'gredice_session=private-cookie',
                'next-url': '/admin/accounts/private-id?token=secret-query',
            },
        },
        origin,
    );
    assert.deepEqual(request, {
        route: '/admin/other',
        method: 'other',
        rsc: true,
        routerPrefetch: true,
        segmentPrefetch: true,
        browserPrefetch: true,
    });
    assert.doesNotMatch(
        JSON.stringify(request),
        /private|secret|token|cookie|query/,
    );
    assert.equal(
        sanitizeAdminNetworkRequest(
            {
                url: 'https://attacker.example/private',
                method: 'GET',
                headers: {},
            },
            origin,
        ),
        null,
    );
    assert.equal(
        sanitizeAdminNetworkRequest(
            { url: 'invalid', method: 'GET', headers: {} },
            origin,
        ),
        null,
    );
});

test('summary separates recorded activity phases and prefetch from ordinary RSC', () => {
    const request = sanitizeAdminNetworkRequest(
        {
            url: `${origin}/admin/approvals?private=secret`,
            method: 'GET',
            headers: { rsc: '1' },
        },
        origin,
    );
    const groups = summarizeAdminNetworkRequests([
        { ...request, phase: 'navigation', status: 200 },
        { ...request, phase: 'settle', routerPrefetch: true, status: 200 },
        { ...request, phase: 'idle', failed: true },
        { ...request, phase: 'idle', status: 503 },
        {
            ...request,
            phase: 'idle',
            method: 'other',
            blocked: true,
            failed: true,
        },
    ]);
    assert.equal(groups.length, 4);
    assert.equal(groups[0].category, 'ordinary-rsc');
    assert.equal(groups[1].category, 'indicated-prefetch');
    assert.equal(groups[2].requests, 2);
    assert.equal(groups[2].failed, 1);
    assert.equal(groups[2].httpErrors, 1);
    assert.equal(groups[3].blocked, 1);
    assert.doesNotMatch(JSON.stringify(groups), /private|secret/);
});

test('response attribution reduces cache and server headers to bounded categories', () => {
    assert.deepEqual(
        sanitizeAdminResponseHeaders({
            'X-Vercel-Cache': 'HIT',
            Server: 'Vercel',
            'Cache-Control': 'private, no-store, max-age=0',
            'Set-Cookie': 'gredice_session=private-cookie',
            'X-Matched-Path': '/admin/accounts/private-id',
        }),
        { vercelCache: 'HIT', server: 'vercel', cacheControl: 'no-store' },
    );
    assert.deepEqual(sanitizeAdminResponseHeaders({}), {
        vercelCache: 'missing',
        server: 'missing',
        cacheControl: 'missing',
    });
    const unknown = sanitizeAdminResponseHeaders({
        'X-Vercel-Cache': 'private-cache-key',
        Server: 'private-origin',
        'Cache-Control': 'private-cache-key',
    });
    assert.deepEqual(unknown, {
        vercelCache: 'other',
        server: 'other',
        cacheControl: 'other',
    });
    assert.doesNotMatch(
        JSON.stringify(unknown),
        /private-cache-key|private-origin/,
    );
});

test('timeout joins delayed browser startup and closes it before returning', async () => {
    let closed = 0;
    let contexts = 0;
    const report = await measureAdminRequests(
        {
            launch: async () => {
                await new Promise((resolve) => setTimeout(resolve, 20));
                return {
                    close: async () => {
                        closed += 1;
                    },
                    newContext: async () => {
                        contexts += 1;
                    },
                };
            },
        },
        { origin, idleMs: 1000, settleMs: 1000, timeoutMs: 1 },
        { cookies: [], origins: [] },
    );
    assert.equal(report.outcome, 'incomplete');
    assert.equal(closed, 1);
    assert.equal(contexts, 0);
});

test('browser failure details stay out of the report', async () => {
    const report = await measureAdminRequests(
        {
            launch: async () => {
                throw new Error('https://private.example?token=secret');
            },
        },
        { origin, idleMs: 1000, settleMs: 1000, timeoutMs: 30000 },
        { cookies: [], origins: [] },
    );
    assert.equal(report.outcome, 'incomplete');
    assert.doesNotMatch(
        JSON.stringify(report),
        /private|secret|private\.example/,
    );
});
