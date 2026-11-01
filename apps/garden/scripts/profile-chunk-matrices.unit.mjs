import assert from 'node:assert/strict';
import test from 'node:test';
import {
    executeMatrixProfileCommand,
    isMatrixProfileReady,
    matrixProfileUrl,
    percentiles,
    sourceMapContents,
} from './profile-chunk-matrices.mjs';
import { summarizeMatrixRows } from './summarize-chunk-matrices.mjs';

test('edits wait for the displayed revision and reject absent preparation work', async () => {
    const names = [
        'window',
        'document',
        'getComputedStyle',
        '__grediceGameProfile',
    ];
    const previous = names.map((name) => globalThis[name]);
    try {
        for (const prepared of [128, 0]) {
            const runtime = {
                chunkCompiler: {
                    pendingJobs: 0,
                    matrixPreparationMs: 0,
                    matrixPreparationInstances: 0,
                },
                renderPackets: { packetFallbackMeshes: 0 },
                rendererStatsReceiptCount: 1,
                sceneRootAnimations: { active: 0, pendingEvents: 0 },
                matrixProfileDisplayedSequence: 0,
            };
            globalThis.__grediceGameProfile = runtime;
            const events = new EventTarget();
            globalThis.window = events;
            globalThis.document = {
                querySelector: () => ({
                    getAttribute: () => 'true',
                    getAnimations: () => [],
                }),
            };
            globalThis.getComputedStyle = () => ({ opacity: '1' });
            events.addEventListener('gredice:game-profile-matrix-edit', () => {
                runtime.matrixProfileCommittedSequence = 1;
                // Incoming QueryCache data precedes the displayed Canvas commit.
                setTimeout(() => {
                    runtime.matrixProfileDisplayedSequence = 1;
                    runtime.chunkCompiler.matrixPreparationInstances = prepared;
                }, 15);
            });
            events.addEventListener(
                'gredice:game-profile-render-receipt-request',
                () => {
                    assert.equal(runtime.matrixProfileDisplayedSequence, 1);
                    setTimeout(() => {
                        runtime.rendererStatsReceiptCount++;
                        runtime.rendererStatsPublishedAt = performance.now();
                    }, 0);
                },
            );
            const command = executeMatrixProfileCommand({
                kind: 'edit',
                count: 64,
                sequence: 1,
            });
            if (prepared === 128)
                assert.equal((await command).preparationInstances, 128);
            else
                await assert.rejects(command, /Edit preparation work mismatch/);
        }
    } finally {
        names.forEach((name, index) => {
            if (previous[index] === undefined) delete globalThis[name];
            else globalThis[name] = previous[index];
        });
    }
});

test('switch diagnostics enable the real route listener without replacing the garden fixture', () => {
    for (const kind of ['edit8', 'edit64', 'switch']) {
        const params = matrixProfileUrl(
            'http://localhost:3101',
            '/debug/profile/game?quality=auto',
            kind,
        ).searchParams;
        assert.equal(params.get('profile'), 'high-target');
        assert.equal(params.get('quality'), 'auto');
        assert.equal(params.get('date'), '2026-06-01');
        assert.equal(
            params.get('gardenSwitch'),
            kind === 'switch' ? '1' : null,
        );
        assert.equal(
            params.get('matrixProfile'),
            kind === 'switch' ? null : kind === 'edit64' ? '64' : '8',
        );
    }
});

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
