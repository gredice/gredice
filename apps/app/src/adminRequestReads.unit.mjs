import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import test from 'node:test';
import server from 'next/dist/compiled/react-server-dom-webpack/server.node.js';
import React from 'react';
import { createAdminApprovalData } from './adminApprovalData.ts';
import { classifyAdminRequest } from './adminRequestAttribution.ts';
import { adminRequestRead } from './adminRequestReads.ts';
import { countPendingPlantingTasks } from './approvalTaskEligibility.ts';
import { buildSelectedPlantingApprovalTasks } from './selectedPlantingApprovalTasks.ts';

async function render(component) {
    const errors = [];
    const stream = await server.renderToReadableStream(
        React.createElement(component),
        undefined,
        { onError: (error) => errors.push(error) },
    );
    const body = await new Response(stream).text();
    if (errors.length) throw errors[0];
    return body;
}

function legacyField(overrides = {}) {
    return {
        active: true,
        plantStatus: 'pendingVerification',
        plantSortId: 12,
        plantCycles: [{ active: true }],
        ...overrides,
    };
}

function selectedPlanting(overrides = {}) {
    return {
        id: 7,
        configurationSource: 'selected',
        isActive: true,
        isDeleted: false,
        anchorPositionIndex: 0,
        memberships: [
            {
                isDeleted: false,
                raisedBedField: { isDeleted: false, positionIndex: 0 },
            },
        ],
        selectedTask: {
            status: 'pendingVerification',
            identity: { expectedPlantSortId: 12 },
            completion: { completedAt: '2026-10-02T01:00:00Z' },
        },
        ...overrides,
    };
}

function bed(overrides = {}) {
    return {
        id: 5,
        physicalId: 'G-05',
        status: 'active',
        fields: [],
        plantings: [],
        ...overrides,
    };
}

test('concurrent layout/page readers share one load, and separate requests stay fresh', async () => {
    const calls = [];
    const records = [];
    let account = 'first-admin';
    const read = adminRequestRead(
        'test.private-navigation',
        async () => {
            calls.push(account);
            await Promise.resolve();
            return account;
        },
        async (...args) => records.push(args),
    );
    async function Navigation() {
        const [layout, page] = await Promise.all([read(), read()]);
        assert.equal(layout, account);
        assert.equal(page, account);
        return layout;
    }
    await render(Navigation);
    assert.deepEqual(calls, ['first-admin']);
    assert.equal(records.length, 1);
    account = 'second-admin';
    await render(Navigation);
    assert.deepEqual(calls, ['first-admin', 'second-admin']);
    assert.equal(records.length, 2);
});

test('a failed request shares its rejection, while a later request retries', async () => {
    let attempts = 0;
    const records = [];
    const read = adminRequestRead(
        'test.retry',
        async () => {
            attempts += 1;
            if (attempts === 1) throw new Error('temporary storage failure');
            return 4;
        },
        async (...args) => records.push(args),
    );
    async function Navigation() {
        const results = await Promise.allSettled([read(), read()]);
        assert.equal(results[0].status, results[1].status);
        return results[0].status;
    }
    assert.match(await render(Navigation), /rejected/);
    assert.equal(attempts, 1);
    assert.equal(records[0][2], true);
    assert.match(await render(Navigation), /fulfilled/);
    assert.equal(attempts, 2);
    assert.equal(records[1][2], false);
});

test('overlapping Admin render requests cannot share private read results', async () => {
    const request = new AsyncLocalStorage();
    const calls = [];
    const read = adminRequestRead(
        'test.concurrent-private-navigation',
        async () => {
            const account = request.getStore();
            calls.push(account);
            await new Promise((resolve) => setTimeout(resolve, 1));
            return account;
        },
        async () => {},
    );
    async function Navigation() {
        const results = await Promise.all([read(), read()]);
        assert.deepEqual(results, [request.getStore(), request.getStore()]);
        return results[0];
    }
    const pages = await Promise.all([
        request.run('first-admin', () => render(Navigation)),
        request.run('second-admin', () => render(Navigation)),
    ]);
    assert.match(pages[0], /first-admin/);
    assert.doesNotMatch(pages[0], /second-admin/);
    assert.match(pages[1], /second-admin/);
    assert.deepEqual(calls.sort(), ['first-admin', 'second-admin']);
});

test('badge and approval list share three core loads without a catalogue dependency', async () => {
    const calls = { requests: 0, operations: 0, raisedBeds: 0 };
    const raisedBeds = [
        bed({ fields: [legacyField()], plantings: [selectedPlanting()] }),
    ];
    const readers = createAdminApprovalData({
        requests: async () => {
            calls.requests += 1;
            return [{ id: 'status-request' }];
        },
        operations: async () => {
            calls.operations += 1;
            return [{ id: 4 }, { id: 5 }];
        },
        raisedBeds: async () => {
            calls.raisedBeds += 1;
            return raisedBeds;
        },
    });
    async function Approvals() {
        const [layoutCount, pageData, dashboardCount] = await Promise.all([
            readers.getPendingAdminApprovalTaskCount(),
            readers.getPendingApprovalData(),
            readers.getPendingAdminApprovalTaskCount(),
        ]);
        assert.equal(layoutCount, 5);
        assert.equal(dashboardCount, 5);
        assert.equal(pageData.raisedBeds, raisedBeds);
        return layoutCount;
    }
    await render(Approvals);
    assert.deepEqual(calls, { requests: 1, operations: 1, raisedBeds: 1 });
    await render(Approvals);
    assert.deepEqual(calls, { requests: 2, operations: 2, raisedBeds: 2 });
    console.info(
        'admin-read-diagnostic',
        JSON.stringify({
            scenario: 'approval count plus approval page in one render',
            measuredCoreReadsPerRender:
                Object.values(calls).reduce((a, b) => a + b, 0) / 2,
        }),
    );
});

test('count includes precisely eligible legacy and selected planting tasks', () => {
    const beds = [
        bed({
            fields: [
                legacyField(),
                legacyField({ active: false }),
                legacyField({ plantStatus: 'planned' }),
                legacyField({ plantSortId: null }),
                legacyField({ plantCycles: [{ active: false }] }),
            ],
            plantings: [
                selectedPlanting(),
                selectedPlanting({ configurationSource: 'legacy' }),
                selectedPlanting({ isActive: false }),
                selectedPlanting({ isDeleted: true }),
                selectedPlanting({ selectedTask: null }),
                selectedPlanting({ selectedTask: { status: 'planned' } }),
                selectedPlanting({
                    selectedTask: {
                        status: 'pendingVerification',
                        completion: null,
                    },
                }),
                selectedPlanting({ memberships: [] }),
                selectedPlanting({
                    memberships: [
                        {
                            isDeleted: true,
                            raisedBedField: { isDeleted: false },
                        },
                    ],
                }),
                selectedPlanting({
                    memberships: [
                        {
                            isDeleted: false,
                            raisedBedField: { isDeleted: true },
                        },
                    ],
                }),
            ],
        }),
        bed({ status: 'abandoned', plantings: [selectedPlanting()] }),
    ];
    assert.equal(countPendingPlantingTasks(beds), 2);
    assert.equal(buildSelectedPlantingApprovalTasks(beds).length, 1);
    assert.equal(countPendingPlantingTasks([]), 0);
});

test('header attribution distinguishes prefetch without logging private request values', () => {
    assert.deepEqual(classifyAdminRequest(new Headers()), {
        rsc: false,
        routerPrefetch: false,
        segmentPrefetch: false,
        browserPrefetch: false,
    });
    assert.deepEqual(
        classifyAdminRequest(
            new Headers({
                rsc: '1',
                'next-router-prefetch': '1',
                'next-router-segment-prefetch': '/admin',
                cookie: 'secret',
                authorization: 'secret',
                'next-url': '/admin/accounts/private?token=secret',
            }),
        ),
        {
            rsc: true,
            routerPrefetch: true,
            segmentPrefetch: true,
            browserPrefetch: false,
        },
    );
    assert.equal(
        classifyAdminRequest(
            new Headers({ 'sec-purpose': 'prefetch;prerender' }),
        ).browserPrefetch,
        true,
    );
});
