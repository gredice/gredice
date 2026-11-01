import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { assertSafeGameProfileOutputDirectory } from './game-profile-output.mjs';
import { writeMatrixProfileReport } from './matrix-profile-report.mjs';
import {
    resolveChromiumGraphicsArgs,
    resolveScenarios,
} from './profile-game-scene.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
export function percentiles(values) {
    if (!values.every(Number.isFinite))
        throw new Error('Non-finite timing sample');
    const sorted = values.toSorted((a, b) => a - b);
    const at = (p) =>
        sorted.length
            ? sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]
            : null;
    return {
        count: sorted.length,
        p50: at(0.5),
        p95: at(0.95),
        min: at(0),
        max: at(1),
    };
}

export function isMatrixProfileReady() {
    const p = globalThis.__grediceGameProfile;
    return (
        p?.chunkCompiler?.pendingJobs === 0 &&
        p?.sceneGeometryPending === 0 &&
        (!p.shadowsEnabled ||
            (p.shadowGeometryRevision === p.sceneGeometryRevision &&
                p.shadowMapNeedsUpdate === false)) &&
        p?.renderPackets?.packetFallbackMeshes === 0 &&
        Boolean(p?.gameCameraSnapshot) &&
        p?.rendererStatsReceiptCount > 0
    );
}

export function sourceMapContents(map) {
    return [
        ...(map.sources ?? []).map((source, index) => ({
            source,
            content: map.sourcesContent?.[index],
        })),
        ...(map.sections ?? []).flatMap((section) =>
            sourceMapContents(section.map),
        ),
    ];
}

export function matrixProfileUrl(baseUrl, profilePath, kind) {
    const url = new URL('/debug/profile/game', baseUrl);
    url.search = new URLSearchParams({
        mode: 'details',
        profile: 'high-target',
        quality: new URL(profilePath, baseUrl).searchParams.get('quality'),
        controls: '0',
        details: '1',
        hud: '0',
        debugHud: '0',
        staticSceneCache: 'legacy',
        date: '2026-06-01',
        fixedTimeSeconds: '43200',
        ...(kind === 'switch'
            ? { gardenSwitch: '1' }
            : { matrixProfile: kind === 'edit64' ? '64' : '8' }),
    }).toString();
    return url;
}

function installCapture() {
    const original = {};
    globalThis.__matrixCapture = { stages: [], uploads: [], overflow: false };
    globalThis.__matrixCaptureStart = (mode) => {
        const capture = {
            stages: [],
            uploads: [],
            overflow: false,
        };
        globalThis.__matrixCapture = capture;
        const push = (array, item) => {
            if (array.length < 32768) array.push(item);
            else capture.overflow = true;
        };
        globalThis.__grediceChunkCompilerObserver =
            mode === 'stages'
                ? (sample) => push(capture.stages, sample)
                : undefined;
        for (const name of ['bufferData', 'bufferSubData']) {
            original[name] ??= WebGL2RenderingContext.prototype[name];
            WebGL2RenderingContext.prototype[name] =
                mode === 'stages'
                    ? function (...args) {
                          const start = performance.now();
                          try {
                              return original[name].apply(this, args);
                          } finally {
                              push(capture.uploads, {
                                  method: name,
                                  durationMs: performance.now() - start,
                              });
                          }
                      }
                    : original[name];
        }
    };
    globalThis.__matrixCaptureStart('stages');
}

async function sourceWitness(page, subject, outDir, loadedScripts) {
    const scripts = [
        ...new Set([
            ...loadedScripts,
            ...(await page.evaluate(() =>
                Array.from(document.scripts)
                    .map((s) => s.src)
                    .filter(Boolean),
            )),
        ]),
    ];
    const manifest = [];
    let sourceMatched = false;
    for (const url of scripts) {
        const response = await page.request.get(url);
        const text = await response.text();
        const suffix = text.match(/sourceMappingURL=([^\s]+)/)?.[1];
        if (!suffix) continue;
        const mapUrl = new URL(suffix, url).href;
        const mapResponse = await page.request.get(mapUrl);
        if (!mapResponse.ok()) continue;
        const body = await mapResponse.text();
        const map = JSON.parse(body);
        for (const { source, content } of sourceMapContents(map))
            if (source.includes('/entities/chunkedMeshGeometry.ts')) {
                if (hash(content ?? '') !== subject.writerSourceSha)
                    throw new Error(
                        'Loaded writer source does not match declared subject',
                    );
                sourceMatched = true;
            }
        const file = hash(url);
        await writeFile(resolve(outDir, `${file}.js`), text);
        await writeFile(resolve(outDir, `${file}.map`), body);
        manifest.push({
            url,
            sha256: hash(text),
            map: mapUrl,
            mapSha256: hash(body),
            file,
        });
    }
    if (!sourceMatched)
        throw new Error('No actual loaded writer source map was verified');
    return manifest;
}

async function snapshot(page) {
    return page.evaluate(() => {
        const p = globalThis.__grediceGameProfile;
        const scene = document.querySelector('[data-scene-garden-id]');
        const canvas = document.querySelector('canvas');
        const gl = canvas?.getContext('webgl2');
        const info = gl?.getExtension('WEBGL_debug_renderer_info');
        return {
            renderer: info
                ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
                : null,
            browserDpr: devicePixelRatio,
            navigatorMetrics: {
                deviceMemory: navigator.deviceMemory ?? null,
                hardwareConcurrency: navigator.hardwareConcurrency,
            },
            sceneSeconds: p?.runtimeFrameLoop?.sceneTimeSeconds,
            quality: p?.qualityTier,
            dpr: p?.dprCap,
            shadows: p?.shadowsEnabled,
            shadowMapSize: p?.shadowMapSize,
            stacks: p?.profileGardenStackCount,
            blocks: p?.profileGardenBlockCount,
            garden: p?.profileGardenId,
            displayedGarden: scene?.getAttribute('data-scene-garden-id'),
            sceneVisible: scene?.getAttribute('data-scene-visible'),
            sceneOpacity: scene ? getComputedStyle(scene).opacity : null,
            sceneTransitions: scene?.getAnimations().length,
            sceneRootAnimations: p?.sceneRootAnimations,
            sceneGeometryPending: p?.sceneGeometryPending,
            sceneGeometryRevision: p?.sceneGeometryRevision,
            shadowGeometryRevision: p?.shadowGeometryRevision,
            shadowMapNeedsUpdate: p?.shadowMapNeedsUpdate,
            matrixProfileCommittedSequence: p?.matrixProfileCommittedSequence,
            matrixProfileDisplayedSequence: p?.matrixProfileDisplayedSequence,
            pending: p?.chunkCompiler?.pendingJobs,
            fallback: p?.renderPackets?.packetFallbackMeshes,
            receipt: p?.rendererStatsReceiptCount,
            publishedAt: p?.rendererStatsPublishedAt,
            compiler: p?.chunkCompiler,
            canvas: {
                width: document.querySelector('canvas')?.width,
                height: document.querySelector('canvas')?.height,
            },
            camera: p?.gameCameraSnapshot,
            source: document
                .querySelector('[data-game-profile-source-commit]')
                ?.getAttribute('data-game-profile-source-commit'),
            sourceDirty: document
                .querySelector('[data-game-profile-source-dirty]')
                ?.getAttribute('data-game-profile-source-dirty'),
            freezeTime: document
                .querySelector('[data-game-profile-date]')
                ?.getAttribute('data-game-profile-date'),
        };
    });
}

export async function settleMatrixProfile(page, minimumPreparedInstances = 0) {
    await page.waitForFunction(
        () => Boolean(globalThis.__grediceGameProfile?.gameCameraSnapshot),
        undefined,
        {
            timeout: 60000,
        },
    );
    const deadline = Date.now() + 60000;
    while (true) {
        const before = await page.evaluate(() => {
            const receipt =
                globalThis.__grediceGameProfile?.rendererStatsReceiptCount ?? 0;
            window.dispatchEvent(
                new Event('gredice:game-profile-render-receipt-request'),
            );
            return receipt;
        });
        await page.waitForFunction(
            (receipt) =>
                globalThis.__grediceGameProfile?.rendererStatsReceiptCount >
                receipt,
            before,
            { timeout: Math.max(1, deadline - Date.now()) },
        );
        if (
            (await page.evaluate(isMatrixProfileReady)) &&
            (await page.evaluate(
                (minimum) =>
                    globalThis.__grediceGameProfile.chunkCompiler
                        .matrixPreparationInstances >= minimum,
                minimumPreparedInstances,
            ))
        )
            break;
        if (Date.now() >= deadline)
            throw new Error('Matrix profile did not settle');
    }
    await page.evaluate(
        () =>
            new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
    );
}

export async function executeMatrixProfileCommand({
    kind,
    count,
    profile,
    sequence,
    dispatchDelayMs,
}) {
    // Phase variation happens outside the measured command-to-submission window.
    let dispatchFrameAt;
    if (dispatchDelayMs !== undefined) {
        dispatchFrameAt = await new Promise(requestAnimationFrame);
        await new Promise((resolve) => setTimeout(resolve, dispatchDelayMs));
    }
    const before = globalThis.__grediceGameProfile.rendererStatsReceiptCount;
    const compilerBefore = {
        ...globalThis.__grediceGameProfile.chunkCompiler,
    };
    const startedAt = performance.now();
    if (kind === 'edit')
        window.dispatchEvent(
            new CustomEvent('gredice:game-profile-matrix-edit', {
                detail: { count, sequence },
            }),
        );
    else
        window.dispatchEvent(
            new CustomEvent('gredice:game-profile-garden-switch', {
                detail: { profile },
            }),
        );
    const deadline = startedAt + 60000;
    const expectedGarden = profile === 'fauna-heavy' ? 99995 : 99996;
    while (performance.now() < deadline) {
        const p = globalThis.__grediceGameProfile;
        const scene = document.querySelector('[data-scene-garden-id]');
        const accepted =
            kind === 'edit'
                ? p.matrixProfileCommittedSequence === sequence &&
                  p.matrixProfileDisplayedSequence === sequence
                : p.profileGardenId === expectedGarden &&
                  scene?.getAttribute('data-scene-garden-id') ===
                      String(expectedGarden);
        if (
            accepted &&
            scene?.getAttribute('data-scene-visible') === 'true' &&
            getComputedStyle(scene).opacity === '1' &&
            scene.getAnimations().length === 0 &&
            p.chunkCompiler.pendingJobs === 0 &&
            p.renderPackets.packetFallbackMeshes === 0
        ) {
            let receipt = p.rendererStatsReceiptCount;
            const camera = {
                position: [-100, 100, -100],
                target: [0, 0, 0],
                zoom: 100,
            };
            window.dispatchEvent(
                new Event('gredice:game-profile-render-receipt-request'),
            );
            window.dispatchEvent(
                new CustomEvent('gredice:game-profile-camera-restore-command', {
                    detail: camera,
                }),
            );
            while (performance.now() < deadline) {
                const next = globalThis.__grediceGameProfile;
                if (
                    next.rendererStatsReceiptCount >
                        Math.max(before, receipt) &&
                    next.chunkCompiler.pendingJobs === 0 &&
                    next.renderPackets.packetFallbackMeshes === 0
                ) {
                    if (
                        next.sceneRootAnimations?.active !== 0 ||
                        next.sceneRootAnimations?.pendingEvents !== 0 ||
                        next.sceneGeometryPending !== 0 ||
                        (next.shadowsEnabled &&
                            (next.shadowGeometryRevision !==
                                next.sceneGeometryRevision ||
                                next.shadowMapNeedsUpdate !== false))
                    ) {
                        receipt = next.rendererStatsReceiptCount;
                        window.dispatchEvent(
                            new Event(
                                'gredice:game-profile-render-receipt-request',
                            ),
                        );
                        await new Promise((resolve) => setTimeout(resolve, 1));
                        continue;
                    }
                    const preparationInstances =
                        next.chunkCompiler.matrixPreparationInstances -
                        compilerBefore.matrixPreparationInstances;
                    const expectedPreparations = count * 2;
                    if (
                        kind === 'edit' &&
                        preparationInstances !== expectedPreparations
                    )
                        throw new Error(
                            `Edit preparation work mismatch: expected ${expectedPreparations}, observed ${preparationInstances}`,
                        );
                    return {
                        durationMs: next.rendererStatsPublishedAt - startedAt,
                        startedAt,
                        submittedAt: next.rendererStatsPublishedAt,
                        dispatchFrameAt,
                        dispatchDelayMs,
                        receipt: next.rendererStatsReceiptCount,
                        compiler: { ...next.chunkCompiler },
                        preparationMs:
                            next.chunkCompiler.matrixPreparationMs -
                            compilerBefore.matrixPreparationMs,
                        preparationInstances,
                    };
                }
                await new Promise((resolve) => setTimeout(resolve, 1));
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 1));
    }
    throw new Error('Matrix command did not reach a settled submitted frame');
}

/** Passive edit endpoint: retain the first matching naturally submitted frame. */
export async function executePassiveMatrixEdit({
    count,
    sequence,
    dispatchDelayMs,
}) {
    let dispatchFrameAt;
    if (dispatchDelayMs !== undefined) {
        dispatchFrameAt = await new Promise(requestAnimationFrame);
        await new Promise((resolve) => setTimeout(resolve, dispatchDelayMs));
    }
    const before = globalThis.__grediceGameProfile.rendererStatsReceiptCount;
    const compilerBefore = { ...globalThis.__grediceGameProfile.chunkCompiler };
    let first;
    let startedAt = 0;
    const receive = (event) => {
        if (first || !(event instanceof CustomEvent)) return;
        const next = event.detail;
        const scene = document.querySelector('[data-scene-garden-id]');
        if (
            !next ||
            next.rendererStatsReceiptCount <= before ||
            next.rendererStatsPublishedAt < startedAt ||
            next.rendererStatsFrameState?.epoch?.matrixSequence !== sequence ||
            next.rendererStatsFrameState?.epoch?.gardenId !==
                Number(scene?.getAttribute('data-scene-garden-id')) ||
            next.matrixProfileCommittedSequence !== sequence ||
            next.matrixProfileDisplayedSequence !== sequence ||
            scene?.getAttribute('data-scene-visible') !== 'true' ||
            getComputedStyle(scene).opacity !== '1' ||
            scene.getAnimations().length !== 0 ||
            next.chunkCompiler.pendingJobs !== 0 ||
            next.renderPackets.packetFallbackMeshes !== 0 ||
            next.rendererStatsFrameState?.geometry?.pending !== 0 ||
            next.rendererStatsFrameState?.geometry?.revision !==
                next.sceneGeometryRevision ||
            next.rendererStatsFrameState?.animations?.active !== 0 ||
            next.rendererStatsFrameState?.animations?.pendingEvents !== 0 ||
            next.sceneGeometryPending !== 0 ||
            next.sceneRootAnimations?.active !== 0 ||
            next.sceneRootAnimations?.pendingEvents !== 0 ||
            (next.shadowsEnabled &&
                (next.shadowGeometryRevision !== next.sceneGeometryRevision ||
                    next.shadowMapNeedsUpdate !== false))
        )
            return;
        first = next;
    };
    window.addEventListener('gredice:game-profile-frame-receipt', receive);
    try {
        window.dispatchEvent(
            new CustomEvent('gredice:game-profile-frame-probe', {
                detail: true,
            }),
        );
        startedAt = performance.now();
        window.dispatchEvent(
            new CustomEvent('gredice:game-profile-matrix-edit', {
                detail: { count, sequence },
            }),
        );
        while (!first && performance.now() < startedAt + 60000)
            await new Promise((resolve) => setTimeout(resolve, 1));
        if (!first)
            throw new Error(
                'Matrix edit did not reach a matching natural frame',
            );
        const preparationInstances =
            first.chunkCompiler.matrixPreparationInstances -
            compilerBefore.matrixPreparationInstances;
        if (preparationInstances !== count * 2)
            throw new Error(
                `Edit preparation work mismatch: expected ${count * 2}, observed ${preparationInstances}`,
            );
        return {
            durationMs: first.rendererStatsPublishedAt - startedAt,
            startedAt,
            submittedAt: first.rendererStatsPublishedAt,
            dispatchFrameAt,
            dispatchDelayMs,
            receipt: first.rendererStatsReceiptCount,
            compiler: { ...first.chunkCompiler },
            preparationMs:
                first.chunkCompiler.matrixPreparationMs -
                compilerBefore.matrixPreparationMs,
            preparationInstances,
            frameEpoch: first.rendererStatsFrameState.epoch,
        };
    } finally {
        window.removeEventListener(
            'gredice:game-profile-frame-receipt',
            receive,
        );
        window.dispatchEvent(
            new CustomEvent('gredice:game-profile-frame-probe', {
                detail: false,
            }),
        );
    }
}

async function command(page, parameters, sequence, editEndpoint) {
    return page.evaluate(
        parameters.kind === 'edit' && editEndpoint === 'natural'
            ? executePassiveMatrixEdit
            : executeMatrixProfileCommand,
        {
            ...parameters,
            sequence,
        },
    );
}

async function traceStop(cdp) {
    const complete = new Promise((resolve) =>
        cdp.once('Tracing.tracingComplete', resolve),
    );
    await cdp.send('Tracing.end');
    const { stream } = await complete;
    let data = '';
    while (true) {
        const part = await cdp.send('IO.read', { handle: stream });
        data += part.data;
        if (part.eof) break;
    }
    await cdp.send('IO.close', { handle: stream });
    return JSON.parse(data);
}

export async function run(options) {
    const editEndpoint = options.editEndpoint ?? 'natural';
    if (!['natural', 'fenced'].includes(editEndpoint))
        throw new Error('Edit endpoint must be natural or fenced');
    const latencySamplesPerRound = options.latencySamplesPerRound ?? 5;
    if (
        !Number.isInteger(latencySamplesPerRound) ||
        latencySamplesPerRound < 5 ||
        latencySamplesPerRound > 100
    )
        throw new Error(
            'Latency samples per round must be an integer from 5 to 100',
        );
    const outDir = assertSafeGameProfileOutputDirectory(
        resolve(options.outDir),
    );
    await mkdir(outDir, { recursive: true });
    const subjects = JSON.parse(await readFile(options.subjects, 'utf8'));
    if (
        subjects.length !== 2 ||
        new Set(subjects.map((s) => s.label)).size !== 2 ||
        subjects.some(
            (s) =>
                !/^[a-z0-9_-]+$/i.test(s.label) ||
                !/^[a-f0-9]{40}$/i.test(s.sourceCommit) ||
                !/^[a-f0-9]{64}$/i.test(s.writerSourceSha) ||
                !['localhost', '127.0.0.1'].includes(new URL(s.url).hostname),
        ) ||
        (!options.preflight &&
            (new Set(subjects.map((s) => s.url)).size !== 2 ||
                new Set(subjects.map((s) => s.writerSourceSha)).size !== 2))
    )
        throw new Error('Two declared production subjects are required');
    const profiles = resolveScenarios('cross-tier').filter((s) => !s.motion);
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            ...resolveChromiumGraphicsArgs(process.platform, 'angle-metal'),
        ],
    });
    const journal = resolve(outDir, 'runs.jsonl');
    try {
        await writeFile(
            journal,
            `${JSON.stringify({
                type: 'header',
                subjects,
                rounds: 4,
                samplesPerRound: 5,
                latencySamplesPerRound,
                varyLatencyDispatch: options.varyLatencyDispatch === true,
                editEndpoint,
                endpoint:
                    editEndpoint === 'natural'
                        ? 'edits: first natural submitted frame bound to the displayed Canvas epoch at the previously fixed camera; switches: displayed revision and settled animation/compilation plus camera fence'
                        : 'displayed revision and settled animation/compilation to post-render receipt at fixed comparison camera',
                browser: browser.version(),
                harnessSha256: hash(await readFile(new URL(import.meta.url))),
                smoke: options.smoke === true,
            })}\n`,
            { flag: 'wx' },
        );
        for (const profile of options.smoke
            ? profiles.filter((p) => p.expectedQualityTier === 'high')
            : profiles)
            for (const kind of options.preflight
                ? ['edit8']
                : ['edit8', 'edit64', 'switch'])
                for (
                    let round = 0;
                    round < (options.preflight || options.smoke ? 1 : 4);
                    round++
                ) {
                    const order =
                        round % 2 ? [...subjects].reverse() : subjects;
                    for (const subject of order) {
                        const context = await browser.newContext({
                            viewport: { width: 1280, height: 720 },
                            deviceScaleFactor: 2,
                        });
                        const page = await context.newPage();
                        const errors = [];
                        const loadedScripts = new Set();
                        try {
                            page.on('pageerror', (error) =>
                                errors.push(String(error)),
                            );
                            page.on('response', (response) => {
                                if (
                                    response.request().resourceType() ===
                                    'script'
                                )
                                    loadedScripts.add(response.url());
                                if (response.status() >= 400)
                                    errors.push(
                                        `${response.status()} ${response.url()}`,
                                    );
                            });
                            if (profile.navigatorMetrics)
                                await page.addInitScript((metrics) => {
                                    for (const [name, value] of Object.entries(
                                        metrics,
                                    ))
                                        Object.defineProperty(navigator, name, {
                                            configurable: true,
                                            get: () => value,
                                        });
                                }, profile.navigatorMetrics);
                            await page.addInitScript(installCapture);
                            const cdp = await context.newCDPSession(page);
                            const size = kind === 'edit64' ? 64 : 8;
                            const url = matrixProfileUrl(
                                subject.url,
                                profile.path,
                                kind,
                            );
                            await page.goto(url.href, {
                                waitUntil: 'domcontentloaded',
                            });
                            await settleMatrixProfile(
                                page,
                                kind === 'switch' ? 0 : size * size * 2,
                            );
                            // Fix the camera outside all measured edit windows.
                            await page.evaluate(() =>
                                window.dispatchEvent(
                                    new CustomEvent(
                                        'gredice:game-profile-camera-restore-command',
                                        {
                                            detail: {
                                                position: [-100, 100, -100],
                                                target: [0, 0, 0],
                                                zoom: 100,
                                            },
                                        },
                                    ),
                                ),
                            );
                            await settleMatrixProfile(
                                page,
                                kind === 'switch' ? 0 : size * size * 2,
                            );
                            const initial = await snapshot(page);
                            if (
                                initial.source !== subject.sourceCommit ||
                                initial.sourceDirty !== 'false' ||
                                Object.entries(
                                    profile.navigatorMetrics ?? {},
                                ).some(
                                    ([name, value]) =>
                                        initial.navigatorMetrics[name] !==
                                        value,
                                ) ||
                                initial.browserDpr !== 2 ||
                                initial.sceneSeconds !== 43200 ||
                                !/ANGLE.*Metal/.test(initial.renderer ?? '') ||
                                /SwiftShader|llvmpipe|software/i.test(
                                    initial.renderer ?? '',
                                ) ||
                                initial.canvas.width !==
                                    Math.round(1280 * profile.expectedDprCap) ||
                                initial.canvas.height !==
                                    Math.round(720 * profile.expectedDprCap) ||
                                initial.quality !==
                                    profile.expectedQualityTier ||
                                initial.dpr !== profile.expectedDprCap ||
                                initial.shadows !== profile.expectedShadows ||
                                initial.shadowMapSize !==
                                    profile.expectedShadowMapSize ||
                                !initial.freezeTime
                            )
                                throw new Error(
                                    `Source/quality/date mismatch ${JSON.stringify(initial)}`,
                                );
                            if (
                                kind !== 'switch' &&
                                (initial.stacks !== size * size ||
                                    initial.blocks !== 2 * size * size)
                            )
                                throw new Error('Fixture cardinality mismatch');
                            const capture = await page.evaluate(
                                () => globalThis.__matrixCapture,
                            );
                            if (
                                kind !== 'switch' &&
                                !capture.stages.some(
                                    (s) =>
                                        s.stage === 'prepare' &&
                                        s.instances >= 32,
                                )
                            )
                                throw new Error(
                                    'Fixture did not exercise actual Float64 compiler preparation',
                                );
                            const assets = resolve(
                                outDir,
                                'sources',
                                subject.label,
                            );
                            await mkdir(assets, { recursive: true });
                            const sourceManifest = await sourceWitness(
                                page,
                                subject,
                                assets,
                                loadedScripts,
                            );
                            let seq = 0;
                            const action = (varyDispatch = false) =>
                                command(
                                    page,
                                    {
                                        kind:
                                            kind === 'switch'
                                                ? 'switch'
                                                : 'edit',
                                        count: size * size,
                                        ...(varyDispatch
                                            ? {
                                                  dispatchDelayMs:
                                                      (seq * 17) % 37,
                                              }
                                            : {}),
                                        profile:
                                            seq % 2
                                                ? 'high-target'
                                                : 'fauna-heavy',
                                    },
                                    ++seq,
                                    editEndpoint,
                                );
                            await page.evaluate(() =>
                                globalThis.__matrixCaptureStart('off'),
                            );
                            // A zero-command protocol preflight precedes all timed data.
                            await cdp.send('HeapProfiler.startSampling', {
                                samplingInterval: 32768,
                                includeObjectsCollectedByMajorGC: true,
                                includeObjectsCollectedByMinorGC: true,
                            });
                            await cdp.send('HeapProfiler.stopSampling');
                            if (options.preflight) {
                                let idleProbe;
                                if (
                                    editEndpoint === 'natural' &&
                                    profile.expectedQualityTier === 'low'
                                ) {
                                    idleProbe = await page.evaluate(
                                        async () => {
                                            const before = {
                                                ...globalThis.__grediceGameProfile,
                                            };
                                            window.dispatchEvent(
                                                new CustomEvent(
                                                    'gredice:game-profile-frame-probe',
                                                    { detail: true },
                                                ),
                                            );
                                            try {
                                                await new Promise((resolve) =>
                                                    setTimeout(resolve, 200),
                                                );
                                                const after =
                                                    globalThis.__grediceGameProfile;
                                                return {
                                                    receiptDelta:
                                                        after.rendererStatsReceiptCount -
                                                        before.rendererStatsReceiptCount,
                                                    frameDelta:
                                                        after.rendererStatsRenderFrame -
                                                        before.rendererStatsRenderFrame,
                                                };
                                            } finally {
                                                window.dispatchEvent(
                                                    new CustomEvent(
                                                        'gredice:game-profile-frame-probe',
                                                        { detail: false },
                                                    ),
                                                );
                                            }
                                        },
                                    );
                                    if (
                                        idleProbe.receiptDelta !== 0 ||
                                        idleProbe.frameDelta !== 0
                                    )
                                        throw new Error(
                                            `Passive probe woke an idle Low scene: ${JSON.stringify(idleProbe)}`,
                                        );
                                }
                                if (errors.length)
                                    throw new Error(
                                        `Unexpected responses/page errors: ${errors}`,
                                    );
                                await writeFile(
                                    resolve(
                                        outDir,
                                        `preflight-${subject.label}-${profile.name}.json`,
                                    ),
                                    JSON.stringify(
                                        {
                                            initial,
                                            capture,
                                            idleProbe,
                                            sourceManifest,
                                            errors,
                                        },
                                        null,
                                        2,
                                    ),
                                );
                                await page.screenshot({
                                    path: resolve(
                                        outDir,
                                        `preflight-${subject.label}-${profile.name}.png`,
                                    ),
                                });
                                console.log(
                                    `Preflight ${subject.label} ${profile.name}: verified loaded source, fixture, compiler, camera and sampling protocol`,
                                );
                                continue;
                            }
                            for (let i = 0; i < 4; i++) await action();
                            for (const mode of [
                                'stages',
                                'latency',
                                'allocation',
                            ]) {
                                // Keep source-map/observer garbage outside each independent measurement pass.
                                await page.evaluate(() =>
                                    globalThis.__matrixCaptureStart('off'),
                                );
                                await cdp.send('HeapProfiler.collectGarbage');
                                await page.evaluate(
                                    (mode) =>
                                        globalThis.__matrixCaptureStart(mode),
                                    mode,
                                );
                                for (let warmup = 0; warmup < 4; warmup++)
                                    await action(
                                        mode === 'latency' &&
                                            options.varyLatencyDispatch,
                                    );
                                await page.evaluate(() =>
                                    globalThis.__matrixCaptureStart('off'),
                                );
                                await cdp.send('HeapProfiler.collectGarbage');
                                await page.evaluate(
                                    (mode) =>
                                        globalThis.__matrixCaptureStart(mode),
                                    mode,
                                );
                                if (mode === 'allocation') {
                                    await cdp.send(
                                        'HeapProfiler.startSampling',
                                        {
                                            samplingInterval: 32768,
                                            includeObjectsCollectedByMajorGC: true,
                                            includeObjectsCollectedByMinorGC: true,
                                        },
                                    );
                                    await cdp.send('Tracing.start', {
                                        categories:
                                            'v8,disabled-by-default-v8.gc,blink.user_timing',
                                        transferMode: 'ReturnAsStream',
                                    });
                                    await page.evaluate(() =>
                                        performance.mark(
                                            'matrix-allocation-start',
                                        ),
                                    );
                                }
                                const samples = [];
                                for (
                                    let i = 0;
                                    i <
                                    (mode === 'latency'
                                        ? latencySamplesPerRound
                                        : 5);
                                    i++
                                )
                                    samples.push(
                                        await action(
                                            mode === 'latency' &&
                                                options.varyLatencyDispatch,
                                        ),
                                    );
                                let allocation, trace;
                                if (mode === 'allocation') {
                                    allocation = await cdp.send(
                                        'HeapProfiler.stopSampling',
                                    );
                                    trace = await traceStop(cdp);
                                }
                                const captured = await page.evaluate(() => {
                                    const result = globalThis.__matrixCapture;
                                    globalThis.__matrixCaptureStart('off');
                                    return result;
                                });
                                if (captured.overflow || errors.length)
                                    throw new Error(
                                        `Capture overflow/page errors: ${errors}`,
                                    );
                                const final = await snapshot(page);
                                if (
                                    final.quality !== initial.quality ||
                                    final.dpr !== initial.dpr ||
                                    final.shadows !== initial.shadows ||
                                    final.shadowMapSize !==
                                        initial.shadowMapSize ||
                                    final.sceneSeconds !==
                                        initial.sceneSeconds ||
                                    final.canvas.width !==
                                        initial.canvas.width ||
                                    final.canvas.height !==
                                        initial.canvas.height ||
                                    final.compiler.workerFailures !==
                                        initial.compiler.workerFailures ||
                                    !samples.every(
                                        (s) =>
                                            Number.isFinite(s.durationMs) &&
                                            s.durationMs >= 0 &&
                                            Number.isFinite(s.preparationMs),
                                    )
                                )
                                    throw new Error(
                                        'Runtime/input/worker/timing contract changed',
                                    );
                                const row = {
                                    subject: subject.label,
                                    profile: profile.name,
                                    kind,
                                    round,
                                    mode,
                                    initial,
                                    final,
                                    samples,
                                    captured,
                                    allocation,
                                    trace,
                                    sourceManifest,
                                };
                                await appendFile(
                                    journal,
                                    JSON.stringify({ type: 'completed', row }) +
                                        '\n',
                                );
                                console.log(
                                    `${subject.label} ${profile.name} ${kind} round ${round + 1} ${mode}: ${JSON.stringify(percentiles(samples.map((s) => s.durationMs)))}`,
                                );
                            }
                            await page.screenshot({
                                path: resolve(
                                    outDir,
                                    `${subject.label}-${profile.name}-${kind}-${round}.png`,
                                ),
                            });
                        } catch (error) {
                            const failureDir = resolve(
                                outDir,
                                'failures',
                                subject.label,
                                profile.name,
                                kind,
                                String(round),
                            );
                            await mkdir(failureDir, { recursive: true });
                            await writeFile(
                                resolve(failureDir, 'failure.json'),
                                JSON.stringify(
                                    {
                                        message: String(error),
                                        errors,
                                        snapshot: await snapshot(page).catch(
                                            () => null,
                                        ),
                                        capture: await page
                                            .evaluate(
                                                () =>
                                                    globalThis.__matrixCapture,
                                            )
                                            .catch(() => null),
                                    },
                                    null,
                                    2,
                                ),
                            );
                            await sourceWitness(
                                page,
                                subject,
                                failureDir,
                                loadedScripts,
                            ).catch(async (sourceError) =>
                                writeFile(
                                    resolve(failureDir, 'source-error.txt'),
                                    String(sourceError),
                                ),
                            );
                            throw error;
                        } finally {
                            await context.close();
                        }
                    }
                }
        await writeMatrixProfileReport(journal, outDir, {
            preflight: options.preflight === true,
            expectedRows: options.preflight
                ? 0
                : (options.smoke ? 1 : profiles.length) *
                  3 *
                  (options.smoke ? 1 : 4) *
                  subjects.length *
                  3,
        });
    } finally {
        await browser.close();
    }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
    const args = process.argv.slice(2);
    const value = (name) => args[args.indexOf(name) + 1];
    run({
        subjects: value('--subjects'),
        outDir: value('--out-dir'),
        preflight: args.includes('--preflight-only'),
        smoke: args.includes('--smoke-only'),
        latencySamplesPerRound: args.includes('--latency-samples-per-round')
            ? Number(value('--latency-samples-per-round'))
            : 5,
        varyLatencyDispatch: args.includes('--vary-latency-dispatch'),
        editEndpoint: args.includes('--edit-endpoint')
            ? value('--edit-endpoint')
            : 'natural',
    }).catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
