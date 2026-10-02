import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { StaticOpaqueSceneCacheGpuTimer } from './staticOpaqueSceneCacheGpuTimer';

const TIME_ELAPSED_EXT = 0x88bf;
const GPU_DISJOINT_EXT = 0x8fbb;
const CURRENT_QUERY = 0x8865;
const QUERY_RESULT = 0x8866;
const QUERY_RESULT_AVAILABLE = 0x8867;

type FakeQuery = { available: boolean; id: number; nanoseconds: number };

function createFakeContext({ extension = true } = {}) {
    let nextId = 1;
    const state = {
        current: null as FakeQuery | null,
        deleted: [] as number[],
        disjoint: false,
        queries: [] as FakeQuery[],
    };
    const context = {
        beginQuery: (_target: number, query: FakeQuery) => {
            state.current = query;
        },
        createQuery: () => {
            const query = { available: false, id: nextId++, nanoseconds: 0 };
            state.queries.push(query);
            return query;
        },
        CURRENT_QUERY,
        deleteQuery: (query: FakeQuery) => {
            state.deleted.push(query.id);
        },
        endQuery: () => {
            state.current = null;
        },
        getExtension: (name: string) =>
            extension && name === 'EXT_disjoint_timer_query_webgl2'
                ? { GPU_DISJOINT_EXT, TIME_ELAPSED_EXT }
                : null,
        getParameter: (parameter: number) =>
            parameter === GPU_DISJOINT_EXT ? state.disjoint : null,
        getQuery: () => state.current,
        getQueryParameter: (query: FakeQuery, parameter: number) =>
            parameter === QUERY_RESULT_AVAILABLE
                ? query.available
                : parameter === QUERY_RESULT
                  ? query.nanoseconds
                  : null,
        QUERY_RESULT,
        QUERY_RESULT_AVAILABLE,
    };
    return { context, state };
}

function createTimer(options?: { extension?: boolean }) {
    const fake = createFakeContext(options);
    const timer = new StaticOpaqueSceneCacheGpuTimer();
    timer.attach(fake.context);
    return { ...fake, timer };
}

describe('static opaque scene cache GPU timer', () => {
    it('reports unsupported without the timer extension', () => {
        const { timer } = createTimer({ extension: false });
        assert.equal(timer.supported, false);
        assert.equal(timer.isAvailable(0), false);
        assert.equal(timer.begin('hit', 0), false);
    });

    it('returns tagged samples once results are available', () => {
        const { state, timer } = createTimer();
        assert.equal(timer.begin('capture', 0), true);
        timer.end();
        assert.equal(timer.begin('hit', 1), true);
        timer.end();
        assert.deepEqual(timer.poll(2), []);

        const [captureQuery, hitQuery] = state.queries;
        assert.ok(captureQuery && hitQuery);
        captureQuery.available = true;
        captureQuery.nanoseconds = 6_000_000;
        hitQuery.available = true;
        hitQuery.nanoseconds = 1_500_000;
        assert.deepEqual(timer.poll(3), [
            { elapsedMs: 6, kind: 'capture' },
            { elapsedMs: 1.5, kind: 'hit' },
        ]);
        assert.deepEqual(state.deleted, [captureQuery.id, hitQuery.id]);
    });

    it('yields to a query another owner already opened', () => {
        const { context, state, timer } = createTimer();
        context.beginQuery(TIME_ELAPSED_EXT, context.createQuery());
        assert.equal(timer.isAvailable(0), false);
        assert.equal(timer.begin('hit', 0), false);
        assert.equal(state.queries.length, 1);

        context.endQuery();
        assert.equal(timer.isAvailable(0), true);
    });

    it('is unavailable while a query is open or results are backed up', () => {
        const { timer } = createTimer();
        timer.begin('hit', 0);
        assert.equal(timer.isAvailable(0), false);
        timer.end();
        for (let index = 1; index < 4; index += 1) {
            assert.equal(timer.isAvailable(index), true);
            timer.begin('hit', index);
            timer.end();
        }
        assert.equal(timer.isAvailable(4), false);
        assert.equal(timer.begin('live', 4), false);
    });

    it('drops pending samples and quarantines after a disjoint event', () => {
        const { state, timer } = createTimer();
        timer.begin('live', 0);
        timer.end();
        state.disjoint = true;
        assert.deepEqual(timer.poll(10), []);
        assert.equal(timer.isAvailable(10), false);
        assert.equal(timer.isAvailable(2_010), true);
    });

    it('marks timing unsupported when a result never arrives', () => {
        const { timer } = createTimer();
        timer.begin('hit', 0);
        timer.end();
        assert.deepEqual(timer.poll(2_000), []);
        assert.equal(timer.supported, false);
    });

    it('stops after context loss and closes active queries on dispose', () => {
        const { state, timer } = createTimer();
        timer.begin('hit', 0);
        timer.dispose();
        assert.equal(state.current, null);
        assert.equal(timer.supported, null);

        const lost = createTimer();
        lost.timer.begin('hit', 0);
        lost.timer.end();
        lost.timer.markContextLost();
        assert.equal(lost.timer.isAvailable(0), false);
        assert.deepEqual(lost.timer.poll(0), []);
    });
});
