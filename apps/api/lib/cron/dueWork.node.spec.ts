import assert from 'node:assert/strict';
import test from 'node:test';
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
