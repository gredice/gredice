import assert from 'node:assert/strict';
import test from 'node:test';
import { executeDeliveryLogout } from './deliveryLogout';

function lifecycle({
    clearFails = false,
    serverOk = true,
}: {
    clearFails?: boolean;
    serverOk?: boolean;
} = {}) {
    const events: string[] = [];
    return {
        events,
        lifecycle: {
            publishStarted() {
                events.push('started');
                return 'logout-test';
            },
            async clearLocalState() {
                events.push('cleared');
                if (clearFails) throw new Error('cleanup failed');
            },
            async requestServerLogout() {
                events.push('requested');
                return { ok: serverOk };
            },
            publishCompleted() {
                events.push('completed');
            },
            publishFailed() {
                events.push('failed');
            },
        },
    };
}

test('publishes logout completion only after durable local cleanup and server logout', async () => {
    const fixture = lifecycle();
    assert.equal(await executeDeliveryLogout(fixture.lifecycle), true);
    assert.deepEqual(fixture.events, [
        'started',
        'cleared',
        'requested',
        'cleared',
        'completed',
    ]);
});

test('cleanup failure prevents server logout and publishes a retryable failure', async () => {
    const fixture = lifecycle({ clearFails: true });
    assert.equal(await executeDeliveryLogout(fixture.lifecycle), false);
    assert.deepEqual(fixture.events, [
        'started',
        'cleared',
        'cleared',
        'failed',
    ]);
});

test('server failure is published only after local data was cleared', async () => {
    const fixture = lifecycle({ serverOk: false });
    assert.equal(await executeDeliveryLogout(fixture.lifecycle), false);
    assert.deepEqual(fixture.events, [
        'started',
        'cleared',
        'requested',
        'cleared',
        'failed',
    ]);
});
