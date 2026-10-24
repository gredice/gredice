import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GameAssetLoadScheduler } from './gameAssetLoadScheduler';
import type { GardenSceneAssetPriority } from './gardenSceneManifest';

function deferred() {
    let resolve: () => void = () => {};
    let reject: (error: Error) => void = () => {};
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

async function flush() {
    for (let index = 0; index < 5; index++) await Promise.resolve();
}

function createHarness(concurrency = 2) {
    const loaded = new Set<string>();
    const started: string[] = [];
    const pending = new Map<string, ReturnType<typeof deferred>>();
    const idleCallbacks: (() => void)[] = [];
    const scheduler = new GameAssetLoadScheduler<string>({
        concurrency,
        isLoaded: (key) => loaded.has(key),
        load: (key) => {
            started.push(key);
            const task = deferred();
            pending.set(key, task);
            return task.promise.then(() => {
                loaded.add(key);
            });
        },
        requestIdle: (callback) => {
            idleCallbacks.push(callback);
            return idleCallbacks.length;
        },
        cancelIdle: (handle) => {
            if (typeof handle === 'number') {
                idleCallbacks[handle - 1] = () => {};
            }
        },
    });
    return {
        scheduler,
        started,
        loaded,
        async finish(key: string) {
            pending.get(key)?.resolve();
            await flush();
        },
        async fail(key: string) {
            pending.get(key)?.reject(new Error(key));
            await flush();
        },
        runIdle() {
            const callbacks = idleCallbacks.splice(0);
            for (const callback of callbacks) callback();
        },
    };
}

function plan(entries: [string, GardenSceneAssetPriority][]) {
    return entries.map(([name, priority]) => ({ name, priority }));
}

describe('game asset load scheduler', () => {
    it('loads current work first within the concurrency bound', async () => {
        const harness = createHarness(2);
        harness.scheduler.setPlan(
            plan([
                ['next', 'transition-next'],
                ['b', 'current'],
                ['a', 'current'],
                ['c', 'current'],
            ]),
        );

        assert.deepEqual(harness.started, ['a', 'b']);
        await harness.finish('a');
        assert.deepEqual(harness.started, ['a', 'b', 'c']);
        assert.equal(harness.scheduler.getSnapshot().currentReady, false);
        await harness.finish('b');
        // The incoming scene waits until every current request is resident.
        assert.deepEqual(harness.started, ['a', 'b', 'c']);
        await harness.finish('c');
        assert.deepEqual(harness.started, ['a', 'b', 'c', 'next']);
        assert.equal(harness.scheduler.getSnapshot().currentReady, true);
        assert.equal(harness.scheduler.getSnapshot().transitionReady, false);
        await harness.finish('next');
        assert.equal(harness.scheduler.getSnapshot().transitionReady, true);
        assert.equal(harness.scheduler.getSnapshot().peakInFlight, 2);
    });

    it('runs idle work one at a time from idle callbacks', async () => {
        const harness = createHarness(4);
        harness.scheduler.setPlan(
            plan([
                ['a', 'current'],
                ['fauna-1', 'idle'],
                ['fauna-2', 'idle'],
            ]),
        );

        harness.runIdle();
        assert.deepEqual(harness.started, ['a']);
        await harness.finish('a');
        assert.deepEqual(harness.started, ['a']);
        harness.runIdle();
        assert.deepEqual(harness.started, ['a', 'fauna-1']);
        harness.runIdle();
        assert.deepEqual(harness.started, ['a', 'fauna-1']);
        await harness.finish('fauna-1');
        harness.runIdle();
        assert.deepEqual(harness.started, ['a', 'fauna-1', 'fauna-2']);
    });

    it('skips resident assets and cancels queued work on plan changes', async () => {
        const harness = createHarness(1);
        harness.loaded.add('resident');
        harness.scheduler.setPlan(
            plan([
                ['resident', 'current'],
                ['a', 'current'],
                ['b', 'current'],
            ]),
        );
        assert.deepEqual(harness.started, ['a']);

        harness.scheduler.setPlan(plan([['c', 'current']]));
        await harness.finish('a');

        assert.deepEqual(harness.started, ['a', 'c']);
        const snapshot = harness.scheduler.getSnapshot();
        assert.equal(snapshot.cancelled, 1);
        assert.equal(snapshot.staleCompletions, 1);
    });

    it('pauses while hidden or context-lost and resumes in order', async () => {
        const harness = createHarness(2);
        harness.scheduler.setPaused('pagehide', true);
        harness.scheduler.setPlan(plan([['a', 'current']]));
        assert.deepEqual(harness.started, []);

        harness.scheduler.setPaused('context-lost', true);
        harness.scheduler.setPaused('pagehide', false);
        assert.deepEqual(harness.started, []);
        assert.deepEqual(harness.scheduler.getSnapshot().paused, [
            'context-lost',
        ]);

        harness.scheduler.setPaused('context-lost', false);
        assert.deepEqual(harness.started, ['a']);
    });

    it('reports failures without retrying or marking them ready', async () => {
        const harness = createHarness(1);
        harness.scheduler.setPlan(plan([['broken', 'current']]));
        await harness.fail('broken');

        harness.scheduler.setPlan(plan([['broken', 'current']]));
        assert.deepEqual(harness.started, ['broken']);
        const snapshot = harness.scheduler.getSnapshot();
        assert.equal(snapshot.failed, 1);
        assert.equal(snapshot.failedRequests.current, 1);
        assert.equal(snapshot.currentReady, false);
        assert.equal(snapshot.transitionReady, false);

        harness.scheduler.resetFailures();
        harness.scheduler.setPlan(plan([['broken', 'current']]));
        assert.deepEqual(harness.started, ['broken', 'broken']);
    });

    it('cancels everything on dispose', async () => {
        const harness = createHarness(1);
        harness.scheduler.setPlan(
            plan([
                ['a', 'current'],
                ['b', 'current'],
            ]),
        );
        harness.scheduler.dispose();
        await harness.finish('a');

        assert.deepEqual(harness.started, ['a']);
        assert.equal(harness.scheduler.getSnapshot().cancelled, 1);
    });
});
