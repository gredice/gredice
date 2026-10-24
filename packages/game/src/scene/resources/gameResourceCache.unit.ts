import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GameResourceCache } from './gameResourceCache';

function createClock() {
    let now = 0;
    let nextId = 0;
    const timers = new Map<number, { at: number; callback: () => void }>();
    return {
        now: () => now,
        setTimeout: (callback: () => void, delayMs: number) => {
            const id = ++nextId;
            timers.set(id, { at: now + delayMs, callback });
            return id;
        },
        clearTimeout: (handle: unknown) => {
            if (typeof handle === 'number') timers.delete(handle);
        },
        advance(ms: number) {
            const target = now + ms;
            for (;;) {
                const due = [...timers]
                    .filter(([, timer]) => timer.at <= target)
                    .sort(([, left], [, right]) => left.at - right.at)[0];
                if (!due) break;
                timers.delete(due[0]);
                now = Math.max(now, due[1].at);
                due[1].callback();
            }
            now = target;
        },
        pending: () => timers.size,
    };
}

function createCache(budgetBytes = 100, graceMs = 1_000) {
    const clock = createClock();
    const disposed: string[] = [];
    const cache = new GameResourceCache({
        budgetBytes,
        graceMs,
        now: clock.now,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
    });
    const track = (key: string, bytes: number, value: unknown = {}) =>
        cache.track(key, 'gltf', value, () => ({
            bytes,
            dispose: () => disposed.push(key),
        }));
    return { cache, clock, disposed, track };
}

describe('game resource cache', () => {
    it('never evicts referenced resources', () => {
        const { cache, clock, disposed, track } = createCache(0);
        track('a', 50);
        const release = cache.acquire('a');

        clock.advance(10_000);
        cache.sweep();

        assert.deepEqual(disposed, []);
        assert.equal(cache.getSnapshot().referenced, 1);
        release();
        release();
        assert.equal(cache.getSnapshot().referenced, 0);
    });

    it('keeps released resources through the grace period', () => {
        const { cache, clock, disposed, track } = createCache(0);
        track('a', 50);
        cache.acquire('a')();

        clock.advance(999);
        assert.deepEqual(disposed, []);
        clock.advance(1);
        assert.deepEqual(disposed, ['a']);
        assert.equal(cache.has('a'), false);
        assert.equal(cache.getSnapshot().evictedBytes, 50);
    });

    it('keeps idle resources while they fit the byte budget', () => {
        const { cache, clock, disposed, track } = createCache(100);
        track('a', 60);
        cache.acquire('a')();
        clock.advance(5_000);

        assert.deepEqual(disposed, []);
        assert.equal(cache.getSnapshot().idleBytes, 60);
    });

    it('evicts least recently used idle resources until under budget', () => {
        const { cache, clock, disposed, track } = createCache(100);
        track('old', 60);
        track('mid', 60);
        track('new', 60);
        cache.acquire('old')();
        clock.advance(10);
        cache.acquire('mid')();
        clock.advance(10);
        cache.acquire('new')();

        clock.advance(2_000);

        assert.deepEqual(disposed, ['old', 'mid']);
        assert.equal(cache.getSnapshot().idleBytes, 60);
    });

    it('never evicts pinned resources and frees them once unpinned', () => {
        const { cache, clock, disposed, track } = createCache(0);
        track('current', 40);
        track('next', 40);
        cache.setPins('scene', ['current', 'next']);

        clock.advance(10_000);
        assert.deepEqual(disposed, []);
        assert.equal(cache.getSnapshot().pinned, 2);

        cache.setPins('scene', ['next']);
        clock.advance(1_000);
        assert.deepEqual(disposed, ['current']);

        cache.setPins('scene', []);
        clock.advance(1_000);
        assert.deepEqual(disposed, ['current', 'next']);
    });

    it('unions pins across owners', () => {
        const { cache, clock, disposed, track } = createCache(0);
        track('shared', 10);
        cache.setPins('left', ['shared']);
        cache.setPins('right', ['shared']);
        cache.setPins('left', []);

        clock.advance(10_000);
        assert.deepEqual(disposed, []);
        assert.equal(cache.isPinned('shared'), true);
    });

    it('defers eviction while suspended', () => {
        const { cache, clock, disposed, track } = createCache(0);
        track('a', 10);
        cache.setSuspended('context-lost', true);

        clock.advance(10_000);
        cache.sweep();
        assert.deepEqual(disposed, []);
        assert.deepEqual(cache.getSnapshot().suspended, ['context-lost']);

        cache.setSuspended('context-lost', false);
        clock.advance(0);
        assert.deepEqual(disposed, ['a']);
    });

    it('keeps refcounts when a reloaded value replaces an evicted one', () => {
        const { cache, clock, disposed, track } = createCache(0);
        const release = cache.acquire('a');
        track('a', 10, { generation: 1 });
        track('a', 20, { generation: 2 });

        assert.equal(cache.getSnapshot().referencedBytes, 20);
        release();
        clock.advance(1_000);
        assert.deepEqual(disposed, ['a']);
    });

    it('drops placeholders that never loaded', () => {
        const { cache } = createCache();
        cache.acquire('missing')();

        assert.equal(cache.getSnapshot().entries, 0);
    });

    it('plateaus during repeated heterogeneous switching', () => {
        const { cache, clock, track } = createCache(100, 500);
        const gardens = [
            ['ground', 'tree', 'dog'],
            ['ground', 'sand', 'cat'],
            ['stone', 'fence', 'bee'],
        ];
        const peaks: number[] = [];

        for (let round = 0; round < 20; round++) {
            const garden = gardens[round % gardens.length] ?? [];
            cache.setPins('scene', garden);
            const releases = garden.map((key) => {
                track(key, 40, { key, round });
                return cache.acquire(key);
            });
            clock.advance(2_000);
            peaks.push(cache.getSnapshot().bytes);
            for (const release of releases) release();
        }

        const settled = peaks.slice(gardens.length);
        assert.ok(Math.max(...settled) <= 3 * 40 + 100);
        assert.equal(Math.max(...settled), Math.max(...settled.slice(-3)));
    });

    it('evicts all idle resources on dispose', () => {
        const { cache, clock, disposed, track } = createCache(1_000);
        track('idle', 10);
        track('held', 10);
        cache.acquire('held');
        cache.dispose();

        assert.deepEqual(disposed, ['idle']);
        assert.equal(clock.pending(), 0);
    });
});
