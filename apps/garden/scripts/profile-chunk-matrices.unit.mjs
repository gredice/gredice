import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
    loadMatrixProfileEvidence,
    writeMatrixProfileReport,
} from './matrix-profile-report.mjs';
import {
    executeMatrixProfileCommand,
    executePassiveMatrixEdit,
    isMatrixProfileReady,
    matrixProfileUrl,
    percentiles,
    settleMatrixProfile,
    sourceMapContents,
} from './profile-chunk-matrices.mjs';
import { resolveScenarios } from './profile-game-scene.mjs';
import {
    summarizeMatrixRows,
    validateMatrixCohort,
} from './summarize-chunk-matrices.mjs';

test('large evidence is indexed without losing journal data, and checksum/partial captures fail closed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'matrix-evidence-'));
    try {
        const row = {
            subject: 'scratch',
            mode: 'allocation',
            samples: [1.25],
            allocation: { profile: { head: { selfSize: 32768 } } },
            trace: {
                traceEvents: [
                    { name: 'matrix-allocation-start', pid: 1, tid: 2 },
                ],
            },
        };
        const stage = {
            subject: 'scratch',
            mode: 'stages',
            captured: { stages: [{ durationMs: 0.1 }] },
        };
        const journal = `${[
            {
                type: 'header',
                subjects: [{ label: 'scratch' }],
                smoke: false,
            },
            { type: 'completed', row },
            { type: 'completed', row: stage },
        ]
            .map((r) => JSON.stringify(r))
            .join('\n')}\n`;
        const input = join(dir, 'runs.jsonl');
        await writeFile(input, journal);
        const result = await writeMatrixProfileReport(input, dir, {
            expectedRows: 2,
        });
        const indexBytes = await readFile(result.output, 'utf8');
        const report = JSON.parse(indexBytes);
        assert.equal(report.rows[0].allocation, undefined);
        assert.equal(report.rows[0].trace, undefined);
        assert.deepEqual(report.rows[0].samples, row.samples);
        assert.deepEqual(report.rows[1], stage);
        assert.deepEqual(
            await loadMatrixProfileEvidence(result.output, report.rows[0]),
            { allocation: row.allocation, trace: row.trace },
        );
        assert.equal(
            report.sourceJournalSha256,
            createHash('sha256').update(journal).digest('hex'),
        );
        assert.equal(await readFile(input, 'utf8'), journal);
        await assert.rejects(
            writeMatrixProfileReport(input, dir, { expectedRows: 2 }),
            { code: 'EEXIST' },
        );
        assert.equal(await readFile(result.output, 'utf8'), indexBytes);
        await writeFile(join(dir, report.rows[0].allocationEvidenceFile), '{}');
        await assert.rejects(
            loadMatrixProfileEvidence(result.output, report.rows[0]),
            /checksum mismatch/,
        );
        const partial = join(dir, 'partial');
        await mkdir(partial);
        await assert.rejects(
            writeMatrixProfileReport(input, partial, { expectedRows: 3 }),
            /Incomplete capture/,
        );
        await assert.rejects(readFile(join(partial, 'latest.json')), {
            code: 'ENOENT',
        });
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test('primary acceptance requires every declared profile, round, pass and subject exactly once', () => {
    const subjects = [{ label: 'allocating' }, { label: 'scratch' }];
    const rows = [];
    for (const subject of subjects)
        for (const profile of resolveScenarios('cross-tier').filter(
            (s) => !s.motion,
        ))
            for (const kind of ['edit8', 'edit64', 'switch'])
                for (let round = 0; round < 4; round++)
                    for (const mode of ['stages', 'latency', 'allocation'])
                        rows.push({
                            subject: subject.label,
                            profile: profile.name,
                            kind,
                            round,
                            mode,
                            samples: Array(5).fill(1),
                        });
    assert.doesNotThrow(() => validateMatrixCohort({ subjects, rows }));
    const confirmationRows = rows.map((row) => ({
        ...row,
        samples: Array(row.mode === 'latency' ? 20 : 5).fill(1),
    }));
    assert.doesNotThrow(() =>
        validateMatrixCohort({
            subjects,
            rows: confirmationRows,
            latencySamplesPerRound: 20,
        }),
    );
    assert.throws(
        () => validateMatrixCohort({ subjects, rows: confirmationRows }),
        /Incomplete/,
    );
    assert.throws(
        () => validateMatrixCohort({ subjects, rows: [] }),
        /Incomplete/,
    );
    assert.throws(
        () =>
            validateMatrixCohort({
                subjects,
                rows: [...rows.slice(1), rows[1]],
            }),
        /duplicate/,
    );
    rows[0].samples.pop();
    assert.throws(() => validateMatrixCohort({ subjects, rows }), /Incomplete/);
});

test('setup refreshes stale renderer statistics in an idle Low scene', async () => {
    const names = ['window', 'requestAnimationFrame', '__grediceGameProfile'];
    const previous = names.map((name) => globalThis[name]);
    try {
        globalThis.__grediceGameProfile = {
            gameCameraSnapshot: {},
            rendererStatsReceiptCount: 1,
            sceneGeometryPending: 2,
            shadowsEnabled: false,
            chunkCompiler: { pendingJobs: 0, matrixPreparationInstances: 128 },
            renderPackets: { packetFallbackMeshes: 0 },
        };
        const events = new EventTarget();
        globalThis.window = events;
        globalThis.requestAnimationFrame = (callback) =>
            setTimeout(callback, 0);
        events.addEventListener(
            'gredice:game-profile-render-receipt-request',
            () => {
                // Compilation has committed; the throttled statistics are older.
                globalThis.__grediceGameProfile.sceneGeometryPending = 0;
                globalThis.__grediceGameProfile.rendererStatsReceiptCount++;
            },
        );
        await settleMatrixProfile(
            {
                evaluate: (callback, argument) => callback(argument),
                waitForFunction: (callback, argument) =>
                    assert(callback(argument)),
            },
            128,
        );
        assert.equal(isMatrixProfileReady(), true);
    } finally {
        names.forEach((name, index) => {
            if (previous[index] === undefined) delete globalThis[name];
            else globalThis[name] = previous[index];
        });
    }
});

test('edits wait for the displayed revision and reject absent preparation work', async () => {
    const names = [
        'window',
        'document',
        'getComputedStyle',
        'requestAnimationFrame',
        '__grediceGameProfile',
    ];
    const previous = names.map((name) => globalThis[name]);
    try {
        let dispatchFrameAt;
        globalThis.requestAnimationFrame = (callback) => {
            dispatchFrameAt = performance.now();
            callback(dispatchFrameAt);
        };
        for (const prepared of [128, 0]) {
            const runtime = {
                chunkCompiler: {
                    pendingJobs: 0,
                    matrixPreparationMs: 0,
                    matrixPreparationInstances: 0,
                },
                renderPackets: { packetFallbackMeshes: 0 },
                rendererStatsReceiptCount: 1,
                sceneGeometryPending: 0,
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
                dispatchDelayMs: 5,
            });
            if (prepared === 128) {
                const result = await command;
                assert.equal(result.preparationInstances, 128);
                assert.equal(result.dispatchFrameAt, dispatchFrameAt);
                assert.equal(result.dispatchDelayMs, 5);
                assert.ok(result.startedAt >= result.dispatchFrameAt);
                assert.equal(
                    result.durationMs,
                    result.submittedAt - result.startedAt,
                );
            } else
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
            sceneGeometryPending: 0,
        };
        assert.equal(isMatrixProfileReady(), true);
        globalThis.__grediceGameProfile.chunkCompiler.pendingJobs = 1;
        assert.equal(isMatrixProfileReady(), false);
        globalThis.__grediceGameProfile.chunkCompiler.pendingJobs = 0;
        globalThis.__grediceGameProfile.renderPackets.packetFallbackMeshes = 1;
        assert.equal(isMatrixProfileReady(), false);
        globalThis.__grediceGameProfile.renderPackets.packetFallbackMeshes = 0;
        globalThis.__grediceGameProfile.sceneGeometryPending = 1;
        assert.equal(isMatrixProfileReady(), false);
        Object.assign(globalThis.__grediceGameProfile, {
            sceneGeometryPending: 0,
            shadowsEnabled: true,
            sceneGeometryRevision: 2,
            shadowGeometryRevision: 1,
            shadowMapNeedsUpdate: false,
        });
        assert.equal(isMatrixProfileReady(), false);
        globalThis.__grediceGameProfile.shadowGeometryRevision = 2;
        assert.equal(isMatrixProfileReady(), true);
        globalThis.__grediceGameProfile.shadowMapNeedsUpdate = true;
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

test('passive edits retain the first matching Canvas receipt without requesting camera or render work', async () => {
    const names = [
        'window',
        'document',
        'getComputedStyle',
        '__grediceGameProfile',
    ];
    const previous = names.map((name) => globalThis[name]);
    try {
        for (const prepared of [128, 0]) {
            let active = false;
            let firstTime;
            let received = 0;
            const events = new EventTarget();
            globalThis.window = events;
            globalThis.document = {
                querySelector: () => ({
                    getAttribute: (name) =>
                        name === 'data-scene-garden-id' ? '99996' : 'true',
                    getAnimations: () => [],
                }),
            };
            globalThis.getComputedStyle = () => ({ opacity: '1' });
            let runtime = {
                chunkCompiler: {
                    pendingJobs: 0,
                    matrixPreparationInstances: 0,
                    matrixPreparationMs: 0,
                },
                renderPackets: { packetFallbackMeshes: 0 },
                rendererStatsReceiptCount: 1,
                sceneGeometryPending: 0,
                sceneRootAnimations: { active: 0, pendingEvents: 0 },
                matrixProfileCommittedSequence: 0,
                matrixProfileDisplayedSequence: 0,
            };
            globalThis.__grediceGameProfile = runtime;
            for (const name of [
                'gredice:game-profile-render-receipt-request',
                'gredice:game-profile-camera-restore-command',
            ])
                events.addEventListener(name, () =>
                    assert.fail(
                        'Passive edit must not request a render/camera fence',
                    ),
                );
            events.addEventListener(
                'gredice:game-profile-frame-probe',
                (event) => {
                    active = event.detail;
                },
            );
            events.addEventListener('gredice:game-profile-matrix-edit', () => {
                assert.equal(active, true);
                runtime = {
                    ...runtime,
                    matrixProfileCommittedSequence: 1,
                    matrixProfileDisplayedSequence: 1,
                };
                setTimeout(() => {
                    const submit = (matrixSequence) => {
                        const frame = {
                            ...runtime,
                            rendererStatsReceiptCount: ++received + 1,
                            rendererStatsPublishedAt: performance.now(),
                            rendererStatsFrameEpoch: {
                                gardenId: 99996,
                                matrixSequence,
                            },
                            chunkCompiler: {
                                ...runtime.chunkCompiler,
                                matrixPreparationInstances: prepared,
                            },
                        };
                        globalThis.__grediceGameProfile = frame;
                        events.dispatchEvent(
                            new CustomEvent(
                                'gredice:game-profile-frame-receipt',
                                { detail: frame },
                            ),
                        );
                        return frame;
                    };
                    submit(0); // Incoming data alone cannot identify the displayed frame.
                    const first = submit(1);
                    firstTime = first.rendererStatsPublishedAt;
                    // A later publication must not inflate latency if the timer resumes late.
                    globalThis.__grediceGameProfile = {
                        ...submit(1),
                        rendererStatsPublishedAt: firstTime + 999,
                    };
                }, 5);
            });
            const result = executePassiveMatrixEdit({ count: 64, sequence: 1 });
            if (prepared === 128) {
                const receipt = await result;
                assert.equal(receipt.submittedAt, firstTime);
                assert.deepEqual(receipt.frameEpoch, {
                    gardenId: 99996,
                    matrixSequence: 1,
                });
            } else await assert.rejects(result, /preparation work mismatch/);
            assert.equal(active, false);
        }
    } finally {
        names.forEach((name, i) => {
            if (previous[i] === undefined) delete globalThis[name];
            else globalThis[name] = previous[i];
        });
    }
});
