import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { handleDueWorkCron, runDueWork } from './dueWork';

function fixture() {
    const calls = { read: 0, run: 0, next: 0, acknowledge: 0 };
    const now = new Date('2026-10-02T12:20:00.000Z');
    const signal: {
        generation: number;
        dueAt: number | null;
        checkedAt: number;
    } = {
        generation: 9,
        dueAt: null,
        checkedAt: now.getTime(),
    };
    const retryAt = new Date(now.getTime() + 60_000);
    const acknowledgements: unknown[][] = [];
    const deps = {
        now: () => now,
        read: async () => {
            calls.read++;
            return signal;
        },
        nextDueAt: async () => {
            calls.next++;
            return retryAt;
        },
        acknowledge: async (...args: unknown[]) => {
            calls.acknowledge++;
            acknowledgements.push(args);
            return true;
        },
    };
    const run = async () => {
        calls.run++;
        return Response.json({ success: true });
    };
    return { calls, now, signal, retryAt, deps, run, acknowledgements };
}

function attribution(t: TestContext, enabled = true) {
    const previous = process.env.DUE_WORK_ATTRIBUTION;
    t.after(() => {
        if (previous === undefined) delete process.env.DUE_WORK_ATTRIBUTION;
        else process.env.DUE_WORK_ATTRIBUTION = previous;
    });
    if (enabled) process.env.DUE_WORK_ATTRIBUTION = '1';
    else delete process.env.DUE_WORK_ATTRIBUTION;
    const records: Record<string, unknown>[] = [];
    t.mock.method(console, 'info', (event: string, data: string) => {
        assert.equal(event, 'due-work-dispatch');
        records.push(JSON.parse(data));
    });
    t.mock.method(console, 'warn', () => undefined);
    return records;
}

test('idle minute polls avoid the worker and PostgreSQL projection', async () => {
    const f = fixture();
    for (let minute = 0; minute < 39; minute++) {
        const response = await runDueWork('automations', f.run, {}, f.deps);
        assert.equal((await response.json()).skipped, true);
        f.now.setTime(f.now.getTime() + 60_000);
    }
    assert.deepEqual(f.calls, { read: 39, run: 0, next: 0, acknowledge: 0 });
});

test('future retry waits until due; successful work publishes the next claim deadline', async () => {
    const f = fixture();
    f.signal.dueAt = f.retryAt.getTime();
    await runDueWork('order-confirmation-emails', f.run, {}, f.deps);
    assert.equal(f.calls.run, 0);
    f.now.setTime(f.retryAt.getTime());
    await runDueWork('order-confirmation-emails', f.run, {}, f.deps);
    assert.equal(f.calls.run, 1);
    assert.deepEqual(f.acknowledgements[0], [
        'order-confirmation-emails',
        9,
        f.retryAt,
        f.now,
    ]);
});

test('the common UTC recovery hour checks durable work with an empty or lost hint', async () => {
    const f = fixture();
    f.signal.checkedAt = new Date('2026-10-02T11:59:59.999Z').getTime();
    await runDueWork('checkout-notifications', f.run, {}, f.deps);
    assert.equal(f.calls.run, 1);
    assert.equal(f.calls.next, 1);
    f.deps.read = async () => ({ generation: 0, checkedAt: 0, dueAt: null });
    await runDueWork('checkout-notifications', f.run, {}, f.deps);
    assert.equal(f.calls.run, 2);
});

test('missing or failed Redis fails open and leaves failures unacknowledged', async () => {
    const f = fixture();
    const noSignal = { ...f.deps, read: async () => null };
    await runDueWork('automations', f.run, {}, noSignal);
    assert.equal(f.calls.run, 1);
    assert.equal(f.calls.next, 0);
    await runDueWork(
        'automations',
        f.run,
        {},
        {
            ...f.deps,
            read: async () => {
                throw new Error('Redis offline');
            },
        },
    );
    assert.equal(f.calls.run, 2);
    f.signal.dueAt = f.now.getTime();
    for (const response of [
        Response.json({ success: false }),
        Response.json({ success: false }, { status: 500 }),
    ]) {
        await runDueWork('automations', async () => response, {}, f.deps);
    }
    assert.equal(f.calls.acknowledge, 0);
});

test('projection failure or raced CAS keeps committed worker responses successful', async () => {
    const f = fixture();
    f.signal.dueAt = f.now.getTime();
    const response = await runDueWork(
        'automations',
        f.run,
        {},
        {
            ...f.deps,
            nextDueAt: async () => {
                throw new Error('projection failure');
            },
        },
    );
    assert.equal(response.status, 200);
    assert.equal(f.calls.acknowledge, 0);
    const raced = await runDueWork(
        'automations',
        f.run,
        {},
        { ...f.deps, acknowledge: async () => false },
    );
    assert.equal(raced.status, 200);
});

test('disabled rollout workers do not query a due projection; maintenance can force a scan', async () => {
    const f = fixture();
    await runDueWork(
        'delivery-lifecycle-emails',
        f.run,
        { enabled: false },
        f.deps,
    );
    assert.equal(f.calls.run, 1);
    assert.equal(f.calls.next, 0);
    assert.deepEqual(f.acknowledgements[0], [
        'delivery-lifecycle-emails',
        9,
        null,
        f.now,
    ]);
    await runDueWork(
        'stripe-checkout-orphan-recovery',
        f.run,
        { force: true },
        f.deps,
    );
    assert.equal(f.calls.run, 2);
    assert.equal(f.calls.next, 1);
});

test('cron authorization rejects before touching signals, queues or cross-app calls', async () => {
    const f = fixture();
    const response = await handleDueWorkCron(
        new Request('https://example.test'),
        'social-publishing',
        f.run,
        {},
        f.deps,
    );
    assert.equal(response.status, 401);
    assert.deepEqual(f.calls, { read: 0, run: 0, next: 0, acknowledge: 0 });
});

test('hourly social recovery scans PostgreSQL without making an empty cross-app call', async () => {
    const f = fixture();
    f.signal.checkedAt = 0;
    await runDueWork(
        'social-publishing',
        f.run,
        { recoveryPreflight: true },
        {
            ...f.deps,
            nextDueAt: async () => {
                f.calls.next++;
                return null;
            },
        },
    );
    assert.equal(f.calls.run, 0);
    assert.equal(f.calls.next, 1);
    assert.deepEqual(f.acknowledgements[0], [
        'social-publishing',
        9,
        null,
        f.now,
    ]);
    await runDueWork(
        'social-publishing',
        f.run,
        { recoveryPreflight: true },
        {
            ...f.deps,
            nextDueAt: async () => f.now,
        },
    );
    assert.equal(f.calls.run, 1);
});

test('attribution is off by default and authorization produces no worker record', async (t) => {
    const records = attribution(t, false);
    const f = fixture();
    await runDueWork('automations', f.run, {}, f.deps);
    assert.deepEqual(records, []);
    process.env.DUE_WORK_ATTRIBUTION = '1';
    assert.equal(
        (
            await handleDueWorkCron(
                new Request('https://example.test'),
                'automations',
                f.run,
                {},
                f.deps,
            )
        ).status,
        401,
    );
    assert.deepEqual(records, []);
    assert.deepEqual(f.calls, { read: 1, run: 0, next: 0, acknowledge: 0 });
});

test('attribution separates Redis-only skips from PostgreSQL recovery preflight skips', async (t) => {
    const records = attribution(t);
    const f = fixture();
    await runDueWork('automations', f.run, {}, f.deps);
    f.signal.checkedAt = 0;
    await runDueWork(
        'social-publishing',
        f.run,
        { recoveryPreflight: true },
        { ...f.deps, nextDueAt: async () => null },
    );
    assert.deepEqual(
        records.map((record) => ({
            reason: record.reason,
            recoveryDue: record.recoveryDue,
            workerStarted: record.workerStarted,
            acknowledgement: record.acknowledgement,
        })),
        [
            {
                reason: 'idle-signal',
                recoveryDue: false,
                workerStarted: false,
                acknowledgement: 'not-attempted',
            },
            {
                reason: 'recovery-preflight',
                recoveryDue: true,
                workerStarted: false,
                acknowledgement: 'acknowledged',
            },
        ],
    );
    assert.equal(f.calls.run, 0);
    assert.equal(f.calls.read, 2);
    assert.equal(f.calls.acknowledge, 1);
});

test('attribution classifies worker causes without adding queue or Redis operations', async (t) => {
    const records = attribution(t);
    const f = fixture();
    f.signal.dueAt = f.now.getTime() - 60_000;
    await runDueWork('automations', f.run, {}, f.deps);
    f.signal.checkedAt = 0;
    await runDueWork('automations', f.run, {}, f.deps);
    await runDueWork('automations', f.run, { force: true }, f.deps);
    await runDueWork('automations', f.run, { enabled: false }, f.deps);
    await runDueWork(
        'automations',
        f.run,
        {},
        { ...f.deps, read: async () => null },
    );
    await runDueWork(
        'automations',
        f.run,
        {},
        {
            ...f.deps,
            read: async () => {
                throw new Error('private Redis URL');
            },
        },
    );
    assert.deepEqual(
        records.map((record) => record.reason),
        [
            'due-signal',
            'hourly-recovery',
            'forced',
            'disabled',
            'redis-unavailable',
            'redis-unavailable',
        ],
    );
    assert.equal(records[0]?.signalLatenessMs, 60_000);
    assert.equal(records[3]?.signalLatenessMs, null);
    assert.equal(records[4]?.signalAvailable, false);
    assert.equal(records[4]?.acknowledgement, 'missing-signal');
    assert.deepEqual(f.calls, { read: 4, run: 6, next: 3, acknowledge: 4 });
    for (const record of records) {
        assert.equal(record.workerStarted, true);
        assert.equal(record.status, 200);
        assert.equal(record.success, true);
        assert.equal(typeof record.durationMs, 'number');
    }
    assert.equal(JSON.stringify(records).includes('private Redis URL'), false);
});

test('signal lateness includes signal-read delay and measures worker start', async (t) => {
    const records = attribution(t);
    const f = fixture();
    const dueAt = f.now.getTime() - 60_000;
    f.signal.dueAt = dueAt;
    await runDueWork(
        'automations',
        f.run,
        {},
        {
            ...f.deps,
            read: async () => {
                f.now.setTime(f.now.getTime() + 2_300);
                return f.signal;
            },
        },
    );
    assert.equal(records[0]?.signalLatenessMs, 62_300);
});

test('attribution distinguishes acknowledged, raced and failed hints while preserving success', async (t) => {
    const records = attribution(t);
    const f = fixture();
    f.signal.dueAt = f.now.getTime();
    for (const acknowledge of [
        async () => true,
        async () => false,
        async () => {
            throw new Error('private acknowledgement detail');
        },
    ]) {
        const response = await runDueWork(
            'automations',
            f.run,
            {},
            {
                ...f.deps,
                acknowledge,
            },
        );
        assert.deepEqual(await response.json(), { success: true });
    }
    await runDueWork(
        'automations',
        f.run,
        {},
        {
            ...f.deps,
            nextDueAt: async () => {
                throw new Error('private projection detail');
            },
        },
    );
    assert.deepEqual(
        records.map((record) => record.acknowledgement),
        ['acknowledged', 'raced', 'error', 'error'],
    );
    assert.equal(JSON.stringify(records).includes('private'), false);
    assert.ok(records.every((record) => record.success === true));
});

test('failed and malformed worker responses stay unacknowledged and do not leak payloads', async (t) => {
    const records = attribution(t);
    const f = fixture();
    f.signal.dueAt = f.now.getTime();
    const failedResponses = [
        Response.json({ success: false, email: 'private@example.test' }),
        Response.json({ error: 'private response' }, { status: 503 }),
    ];
    for (const response of failedResponses) {
        assert.equal(
            await runDueWork('automations', async () => response, {}, f.deps),
            response,
        );
    }
    const privateError = new Error('private worker error');
    await assert.rejects(
        runDueWork(
            'automations',
            async () => {
                throw privateError;
            },
            {},
            f.deps,
        ),
        (error) => error === privateError,
    );
    await assert.rejects(
        runDueWork(
            'automations',
            async () => new Response('private malformed JSON'),
            {},
            f.deps,
        ),
        SyntaxError,
    );
    assert.deepEqual(
        records.map((record) => ({
            status: record.status,
            success: record.success,
            thrownPhase: record.thrownPhase,
            acknowledgement: record.acknowledgement,
        })),
        [
            {
                status: 200,
                success: false,
                thrownPhase: null,
                acknowledgement: 'not-attempted',
            },
            {
                status: 503,
                success: false,
                thrownPhase: null,
                acknowledgement: 'not-attempted',
            },
            {
                status: null,
                success: null,
                thrownPhase: 'worker',
                acknowledgement: 'not-attempted',
            },
            {
                status: 200,
                success: null,
                thrownPhase: 'response',
                acknowledgement: 'not-attempted',
            },
        ],
    );
    assert.equal(f.calls.acknowledge, 0);
    assert.equal(f.calls.next, 0);
    assert.equal(JSON.stringify(records).includes('private'), false);
});

test('attribution logging failures preserve worker results, exceptions and acknowledgement', async (t) => {
    attribution(t);
    t.mock.method(console, 'info', () => {
        throw new Error('logging unavailable');
    });
    const f = fixture();
    f.signal.dueAt = f.now.getTime();
    const response = await runDueWork('automations', f.run, {}, f.deps);
    assert.deepEqual(await response.json(), { success: true });
    assert.equal(f.calls.acknowledge, 1);
    const workerError = new Error('worker unavailable');
    await assert.rejects(
        runDueWork(
            'automations',
            async () => {
                throw workerError;
            },
            {},
            f.deps,
        ),
        (error) => error === workerError,
    );
});
