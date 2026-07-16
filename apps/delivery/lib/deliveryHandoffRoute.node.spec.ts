import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeliveryHandoffRouteHandlers } from './deliveryHandoffRoute';

const runId = 'delivery-run-1';
const targetStopId = 42;
const expectedRetryAttempt = 3;
const occurredAt = '2026-07-16T08:30:00.000Z';
const context = () => ({
    params: Promise.resolve({ runId, stopId: String(targetStopId) }),
});
const handoffRequest = () =>
    new Request('https://dostava.gredice.com/api/handoff', {
        method: 'POST',
        body: JSON.stringify({
            expectedRetryAttempt,
            mutations: [
                {
                    kind: 'scan',
                    clientOperationId: 'handoff-scan-1',
                    occurredAt,
                    tracePath: '/trag/harvest-1',
                },
            ],
        }),
        headers: { 'Content-Type': 'application/json' },
    });
const quietLogger = {
    error() {},
    warn() {},
};

class FakeDeliveryRunExecutionError extends Error {
    constructor(
        readonly code: string,
        message: string,
    ) {
        super(message);
    }
}

function executionErrorCode(error: unknown) {
    return error instanceof FakeDeliveryRunExecutionError ? error.code : null;
}

function assertPrivateNoStore(response: Response) {
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
}

test('GET authenticates drivers and admins while scoping manifest access by role', async (t) => {
    for (const [role, allowAnyRun] of [
        ['driver', false],
        ['admin', true],
    ] as const) {
        await t.test(role, async () => {
            let manifestCalled = false;
            const handlers = createDeliveryHandoffRouteHandlers({
                withAuth: async (roles, handler) => {
                    assert.deepEqual(roles, ['driver', 'admin']);
                    return await handler({
                        userId: `${role}-user`,
                        user: { role },
                    });
                },
                getManifest: async (input) => {
                    manifestCalled = true;
                    assert.deepEqual(input, {
                        readerUserId: `${role}-user`,
                        runId,
                        targetStopId,
                        allowAnyRun,
                    });
                    return { runId, targetStopId, items: [] };
                },
                applyMutations: async () => [],
                executionErrorCode,
                logger: quietLogger,
            });

            const response = await handlers.GET(
                new Request('https://dostava.gredice.com/api/handoff'),
                context(),
            );

            assert.equal(response.status, 200);
            assertPrivateNoStore(response);
            assert.equal(manifestCalled, true);
            assert.deepEqual(await response.json(), {
                runId,
                targetStopId,
                items: [],
            });
        });
    }
});

test('GET preserves private caching on an unauthorized response and never reads a manifest', async () => {
    let manifestCalled = false;
    const handlers = createDeliveryHandoffRouteHandlers({
        withAuth: async (roles) => {
            assert.deepEqual(roles, ['driver', 'admin']);
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        },
        getManifest: async () => {
            manifestCalled = true;
            return {};
        },
        applyMutations: async () => [],
        executionErrorCode,
        logger: quietLogger,
    });

    const response = await handlers.GET(
        new Request('https://dostava.gredice.com/api/handoff'),
        context(),
    );

    assert.equal(response.status, 401);
    assertPrivateNoStore(response);
    assert.equal(manifestCalled, false);
});

test('POST forwards the exact retry attempt for both drivers and admins', async (t) => {
    for (const role of ['driver', 'admin'] as const) {
        await t.test(role, async () => {
            let mutationCalled = false;
            const handlers = createDeliveryHandoffRouteHandlers({
                withAuth: async (roles, handler) => {
                    assert.deepEqual(roles, ['driver', 'admin']);
                    return await handler({
                        userId: `${role}-user`,
                        user: { role },
                    });
                },
                getManifest: async () => ({}),
                applyMutations: async (input) => {
                    mutationCalled = true;
                    assert.equal('allowAnyRun' in input, false);
                    assert.equal(input.driverUserId, `${role}-user`);
                    assert.equal(
                        input.expectedRetryAttempt,
                        expectedRetryAttempt,
                    );
                    return [{ clientOperationId: 'handoff-scan-1' }];
                },
                executionErrorCode,
                logger: quietLogger,
            });

            const response = await handlers.POST(handoffRequest(), context());

            assert.equal(response.status, 200);
            assertPrivateNoStore(response);
            assert.equal(mutationCalled, true);
        });
    }
});

test('POST keeps admins constrained to the assigned-driver mutation contract and sanitizes a cross-run rejection', async () => {
    const warnings: unknown[][] = [];
    let mutationCalled = false;
    const handlers = createDeliveryHandoffRouteHandlers({
        withAuth: async (roles, handler) => {
            assert.deepEqual(roles, ['driver', 'admin']);
            return await handler({
                userId: 'admin-user',
                user: { role: 'admin' },
            });
        },
        getManifest: async () => ({}),
        applyMutations: async (input) => {
            mutationCalled = true;
            assert.equal('allowAnyRun' in input, false);
            assert.equal(input.driverUserId, 'admin-user');
            assert.equal(input.runId, runId);
            assert.equal(input.targetStopId, targetStopId);
            assert.equal(input.expectedRetryAttempt, expectedRetryAttempt);
            assert.equal(input.mutations.length, 1);
            assert.deepEqual(input.mutations[0], {
                kind: 'scan',
                clientOperationId: 'handoff-scan-1',
                occurredAt: new Date(occurredAt),
                tracePath: '/trag/harvest-1',
            });
            throw new FakeDeliveryRunExecutionError(
                'active-run-not-found',
                'Run belongs to another driver: private-user-id',
            );
        },
        executionErrorCode,
        logger: {
            error() {},
            warn: (...args: unknown[]) => {
                warnings.push(args);
            },
        },
    });
    const response = await handlers.POST(handoffRequest(), context());
    const body = await response.json();

    assert.equal(response.status, 409);
    assertPrivateNoStore(response);
    assert.equal(mutationCalled, true);
    assert.deepEqual(body, {
        error: 'Aktivna ruta više nije dostupna.',
        code: 'active-run-not-found',
    });
    assert.equal(JSON.stringify(body).includes('private-user-id'), false);
    assert.deepEqual(warnings, [
        [
            'Delivery handoff mutation rejected',
            {
                code: 'active-run-not-found',
                runId,
                stopId: targetStopId,
                mutationCount: 1,
                userId: 'admin-user',
            },
        ],
    ]);
});

test('POST maps a retry-attempt mismatch to a localized conflict', async () => {
    const handlers = createDeliveryHandoffRouteHandlers({
        withAuth: async (_roles, handler) =>
            await handler({
                userId: 'driver-user',
                user: { role: 'driver' },
            }),
        getManifest: async () => ({}),
        applyMutations: async () => {
            throw new FakeDeliveryRunExecutionError(
                'route-revision-conflict',
                'Expected retry attempt 3 but current retry attempt is 4',
            );
        },
        executionErrorCode,
        logger: quietLogger,
    });

    const response = await handlers.POST(handoffRequest(), context());

    assert.equal(response.status, 409);
    assertPrivateNoStore(response);
    assert.deepEqual(await response.json(), {
        error: 'Ruta se promijenila. Osvježi popis uroda i pokušaj ponovno.',
        code: 'route-revision-conflict',
    });
});

test('GET maps unexpected failures to a sanitized private response and safe log context', async () => {
    const errors: unknown[][] = [];
    const handlers = createDeliveryHandoffRouteHandlers({
        withAuth: async (_roles, handler) =>
            await handler({
                userId: 'driver-user',
                user: { role: 'driver' },
            }),
        getManifest: async () => {
            throw new Error('postgres://secret-user:secret-password@database');
        },
        applyMutations: async () => [],
        executionErrorCode,
        logger: {
            error: (...args: unknown[]) => {
                errors.push(args);
            },
            warn() {},
        },
    });

    const response = await handlers.GET(
        new Request('https://dostava.gredice.com/api/handoff'),
        context(),
    );
    const body = await response.json();

    assert.equal(response.status, 503);
    assertPrivateNoStore(response);
    assert.deepEqual(body, {
        error: 'Provjeru predaje trenutačno nije moguće sinkronizirati.',
        code: 'handoff-manifest-failed',
    });
    assert.equal(JSON.stringify(body).includes('secret-password'), false);
    assert.deepEqual(errors, [
        [
            'Delivery handoff manifest failed',
            {
                errorType: 'Error',
                runId,
                stopId: targetStopId,
                userId: 'driver-user',
            },
        ],
    ]);
});
