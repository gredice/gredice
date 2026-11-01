import { readFile, writeFile } from 'node:fs/promises';
import { SourceMap } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { loadMatrixProfileEvidence } from './matrix-profile-report.mjs';
import { percentiles } from './profile-chunk-matrices.mjs';
import {
    measureStaticSceneCacheImageParity,
    resolveScenarios,
} from './profile-game-scene.mjs';

export function validateMatrixCohort(report) {
    const latencySamplesPerRound = report.latencySamplesPerRound ?? 5;
    if (
        !Number.isInteger(latencySamplesPerRound) ||
        latencySamplesPerRound < 5 ||
        latencySamplesPerRound > 100
    )
        throw new Error('Invalid latency sampling declaration');
    if (
        report.subjects?.length !== 2 ||
        new Set(report.subjects.map((s) => s.label)).size !== 2
    )
        throw new Error('Two distinct subjects are required');
    const expected = new Set();
    const key = (r) =>
        JSON.stringify([r.subject, r.profile, r.kind, r.round, r.mode]);
    for (const subject of report.subjects)
        for (const profile of resolveScenarios('cross-tier').filter(
            (s) => !s.motion,
        ))
            for (const kind of ['edit8', 'edit64', 'switch'])
                for (let round = 0; round < 4; round++)
                    for (const mode of ['stages', 'latency', 'allocation'])
                        expected.add(
                            key({
                                subject: subject.label,
                                profile: profile.name,
                                kind,
                                round,
                                mode,
                            }),
                        );
    const actual = new Set(report.rows.map(key));
    if (
        report.rows.length !== expected.size ||
        actual.size !== expected.size ||
        [...expected].some((k) => !actual.has(k)) ||
        report.rows.some(
            (r) =>
                r.samples.length !==
                (r.mode === 'latency' ? latencySamplesPerRound : 5),
        )
    )
        throw new Error('Incomplete or duplicate matrix cohort');
}

export function summarizeMatrixRows(rows, labels, expectedLatencySamples = 20) {
    const groups = Map.groupBy(rows, (row) => `${row.profile}:${row.kind}`);
    return Object.fromEntries(
        [...groups].map(([key, group]) => {
            const subjects = Object.fromEntries(
                labels.map((label) => {
                    const runs = group.filter((row) => row.subject === label);
                    const latency = runs
                        .filter((row) => row.mode === 'latency')
                        .flatMap((row) => row.samples);
                    const stages = runs.filter((row) => row.mode === 'stages');
                    return [
                        label,
                        {
                            latencyMs: percentiles(
                                latency.map((s) => s.durationMs),
                            ),
                            preparationMs: percentiles(
                                latency.map((s) => s.preparationMs),
                            ),
                            stageMs: Object.fromEntries(
                                [
                                    'write',
                                    'prepare',
                                    'pack',
                                    'transfer',
                                    'worker',
                                    'sync',
                                    'unpack',
                                ].map((stage) => [
                                    stage,
                                    percentiles(
                                        stages.flatMap((row) =>
                                            row.captured.stages
                                                .filter(
                                                    (s) => s.stage === stage,
                                                )
                                                .map((s) => s.durationMs),
                                        ),
                                    ),
                                ]),
                            ),
                            uploadSubmissionMs: percentiles(
                                stages.flatMap((row) =>
                                    row.captured.uploads.map(
                                        (s) => s.durationMs,
                                    ),
                                ),
                            ),
                            sampledTransformBytes: runs
                                .filter((row) => row.mode === 'allocation')
                                .reduce(
                                    (sum, row) =>
                                        sum +
                                        (row.transformAllocatedBytes ?? 0),
                                    0,
                                ),
                            naturalGcEvents: runs
                                .filter((row) => row.mode === 'allocation')
                                .map((row) => row.gcEvents),
                        },
                    ];
                }),
            );
            const [reference, candidate] = labels.map(
                (label) => subjects[label],
            );
            const complete = labels.every(
                (label) =>
                    subjects[label].latencyMs.count === expectedLatencySamples,
            );
            const noLatencyRegression =
                complete &&
                ['p50', 'p95'].every(
                    (p) =>
                        candidate.latencyMs[p] <=
                        reference.latencyMs[p] * 1.05 + 1,
                );
            return [key, { subjects, complete, noLatencyRegression }];
        }),
    );
}

export async function summarizeFile(input, output) {
    const report = JSON.parse(await readFile(input, 'utf8'));
    if (report.preflight || report.smoke)
        throw new Error('Setup/smoke data cannot become primary acceptance');
    validateMatrixCohort(report);
    for (const row of report.rows.filter((row) => row.mode === 'allocation')) {
        const evidence = await loadMatrixProfileEvidence(input, row);
        const mappings = new Map();
        for (const source of row.sourceManifest) {
            const path = resolve(
                dirname(input),
                'sources',
                row.subject,
                `${source.file}.map`,
            );
            mappings.set(
                source.url,
                new SourceMap(JSON.parse(await readFile(path, 'utf8'))),
            );
        }
        let mappedNodes = 0;
        const visit = (node, inTransform = false) => {
            const frame = node.callFrame;
            const mapped = mappings
                .get(frame.url)
                ?.findEntry(frame.lineNumber, frame.columnNumber);
            if (mapped?.originalSource) mappedNodes++;
            const included =
                inTransform ||
                mapped?.originalSource?.includes(
                    '/entities/chunkedMeshGeometry.ts',
                );
            return (
                (included ? node.selfSize : 0) +
                (node.children ?? []).reduce(
                    (sum, child) => sum + visit(child, included),
                    0,
                )
            );
        };
        row.transformAllocatedBytes = visit(evidence.allocation.profile.head);
        if (mappedNodes === 0)
            throw new Error(
                'No allocation frames mapped to loaded production sources',
            );
        const marker = evidence.trace.traceEvents.find(
            (event) => event.name === 'matrix-allocation-start',
        );
        if (!Number.isInteger(marker?.pid) || !Number.isInteger(marker?.tid))
            throw new Error('Missing renderer-main allocation trace marker');
        row.gcEvents = Object.fromEntries(
            [
                ...Map.groupBy(
                    evidence.trace.traceEvents.filter(
                        (event) =>
                            event.pid === marker?.pid &&
                            event.tid === marker?.tid &&
                            /^(MinorGC|MajorGC|V8\.GC_SCAVENGER|V8\.GC_MARK_COMPACTOR)$/.test(
                                event.name,
                            ),
                    ),
                    (event) => event.name,
                ),
            ].map(([name, events]) => [
                name,
                {
                    count: events.length,
                    completeDurationsUs: events
                        .filter((event) => event.ph === 'X')
                        .map((event) => event.dur),
                },
            ]),
        );
    }
    const summary = summarizeMatrixRows(
        report.rows,
        report.subjects.map((s) => s.label),
        4 * (report.latencySamplesPerRound ?? 5),
    );
    for (const [name, value] of Object.entries(summary)) {
        const [profile, kind] = name.split(':');
        const pairs = [];
        for (let round = 0; round < 4; round++) {
            const images = await Promise.all(
                report.subjects.map((subject) =>
                    sharp(
                        resolve(
                            dirname(input),
                            `${subject.label}-${profile}-${kind}-${round}.png`,
                        ),
                    )
                        .ensureAlpha()
                        .raw()
                        .toBuffer({ resolveWithObject: true }),
                ),
            );
            pairs.push(measureStaticSceneCacheImageParity(...images));
        }
        value.visualParity = {
            pairs,
            pass: pairs.every(
                (pair) =>
                    pair.valid &&
                    pair.mismatchRatio <= 0.01 &&
                    pair.p99ByteError <= 8,
            ),
        };
        const [reference, candidate] = report.subjects.map(
            (subject) => value.subjects[subject.label],
        );
        value.preparationAndAllocationImproved =
            kind !== 'edit64' ||
            (reference.sampledTransformBytes > 0 &&
                candidate.sampledTransformBytes <
                    reference.sampledTransformBytes &&
                candidate.preparationMs.p50 < reference.preparationMs.p50);
        value.pass =
            value.complete &&
            value.noLatencyRegression &&
            value.visualParity.pass &&
            value.preparationAndAllocationImproved;
    }
    const result = {
        pass: Object.values(summary).every((value) => value.pass),
        subjects: report.subjects,
        method: {
            samplesPerSubjectCase: 4 * (report.latencySamplesPerRound ?? 5),
            stageAndAllocationSamplesPerSubjectCase: 20,
            latencyDispatch: report.varyLatencyDispatch
                ? 'deterministic 0–36 ms delay after animation frame, before measured dispatch'
                : 'immediate sequential dispatch',
            latencyTolerance: 'p50 and p95 <= reference * 1.05 + 1 ms',
            allocation:
                'V8 sampled JS heap bytes with a mapped transform ancestor, including collected objects; not exact allocation or external buffer bytes',
            gc: 'observed renderer-main GC events; nested categories are not summed or assigned a cause',
            endpoint: report.endpoint,
            editEndpoint: report.editEndpoint ?? 'fenced',
            scope: 'renderer submission latency; not display photon latency or FPS',
        },
        summary,
    };
    await writeFile(output, JSON.stringify(result, null, 2));
    for (const [name, value] of Object.entries(summary))
        console.log(
            name,
            JSON.stringify({
                complete: value.complete,
                noLatencyRegression: value.noLatencyRegression,
                subjects: Object.fromEntries(
                    Object.entries(value.subjects).map(([label, s]) => [
                        label,
                        {
                            latency: s.latencyMs,
                            preparation: s.preparationMs,
                            transformSampledBytes: s.sampledTransformBytes,
                        },
                    ]),
                ),
            }),
        );
    return result;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href)
    summarizeFile(process.argv[2], process.argv[3])
        .then((result) => {
            if (!result.pass) process.exitCode = 1;
        })
        .catch((error) => {
            console.error(error);
            process.exitCode = 1;
        });
