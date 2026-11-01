import assert from 'node:assert/strict';
import test from 'node:test';
import {
    isMatrixProfileReady,
    percentiles,
    sourceMapContents,
} from './profile-chunk-matrices.mjs';
import { summarizeMatrixRows } from './summarize-chunk-matrices.mjs';

test('matrix reports retain nearest-rank tails and indexed source contents', () => {
    assert.throws(() => percentiles([NaN]), /Non-finite/);
    assert.deepEqual(percentiles([3, 1, 2, 0]), {
        count: 4,
        p50: 1,
        p95: 3,
        min: 0,
        max: 3,
    });
    assert.equal(percentiles([]).p95, null);
    assert.deepEqual(
        sourceMapContents({
            sections: [
                { map: { sources: ['a.ts'], sourcesContent: ['a'] } },
                { map: { sources: ['b.ts'], sourcesContent: ['b'] } },
            ],
        }),
        [
            { source: 'a.ts', content: 'a' },
            { source: 'b.ts', content: 'b' },
        ],
    );
});

test('readiness uses the actual packet telemetry and rejects pending or fallback geometry', () => {
    const before = globalThis.__grediceGameProfile;
    try {
        globalThis.__grediceGameProfile = {
            chunkCompiler: { pendingJobs: 0 },
            renderPackets: { packetFallbackMeshes: 0 },
            gameCameraSnapshot: {},
            rendererStatsReceiptCount: 1,
        };
        assert.equal(isMatrixProfileReady(), true);
        globalThis.__grediceGameProfile.chunkCompiler.pendingJobs = 1;
        assert.equal(isMatrixProfileReady(), false);
        globalThis.__grediceGameProfile.chunkCompiler.pendingJobs = 0;
        globalThis.__grediceGameProfile.renderPackets.packetFallbackMeshes = 1;
        assert.equal(isMatrixProfileReady(), false);
    } finally {
        globalThis.__grediceGameProfile = before;
    }
});

test('a fast preparation kernel cannot hide an end-to-end latency regression or missing repetitions', () => {
    const rows = ['allocating', 'scratch'].map((subject) => ({
        subject,
        profile: 'high',
        kind: 'edit64',
        mode: 'latency',
        samples: Array.from({ length: 20 }, () => ({
            durationMs: subject === 'allocating' ? 100 : 120,
            preparationMs: subject === 'allocating' ? 2 : 1,
        })),
    }));
    const first = summarizeMatrixRows(rows, ['allocating', 'scratch'])[
        'high:edit64'
    ];
    assert.equal(first.complete, true);
    assert.equal(first.noLatencyRegression, false);
    rows[1].samples.pop();
    assert.equal(
        summarizeMatrixRows(rows, ['allocating', 'scratch'])['high:edit64']
            .complete,
        false,
    );
});
