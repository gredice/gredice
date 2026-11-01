import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { assertSafeGameProfileOutputDirectory } from './game-profile-output.mjs';
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

async function settle(page) {
    await page.waitForFunction(isMatrixProfileReady, undefined, {
        timeout: 60000,
    });
    await page.evaluate(
        () =>
            new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
    );
}

async function command(page, { kind, count, profile }, sequence) {
    return page.evaluate(
        async ({ kind, count, profile, sequence }) => {
            const before =
                globalThis.__grediceGameProfile.rendererStatsReceiptCount;
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
                        ? p.matrixProfileCommittedSequence === sequence
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
                        new Event(
                            'gredice:game-profile-render-receipt-request',
                        ),
                    );
                    window.dispatchEvent(
                        new CustomEvent(
                            'gredice:game-profile-camera-restore-command',
                            { detail: camera },
                        ),
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
                                next.sceneRootAnimations?.pendingEvents !== 0
                            ) {
                                receipt = next.rendererStatsReceiptCount;
                                window.dispatchEvent(
                                    new Event(
                                        'gredice:game-profile-render-receipt-request',
                                    ),
                                );
                                await new Promise((resolve) =>
                                    setTimeout(resolve, 1),
                                );
                                continue;
                            }
                            return {
                                durationMs:
                                    next.rendererStatsPublishedAt - startedAt,
                                receipt: next.rendererStatsReceiptCount,
                                compiler: { ...next.chunkCompiler },
                                preparationMs:
                                    next.chunkCompiler.matrixPreparationMs -
                                    compilerBefore.matrixPreparationMs,
                                preparationInstances:
                                    next.chunkCompiler
                                        .matrixPreparationInstances -
                                    compilerBefore.matrixPreparationInstances,
                            };
                        }
                        await new Promise((resolve) => setTimeout(resolve, 1));
                    }
                }
                await new Promise((resolve) => setTimeout(resolve, 1));
            }
            throw new Error(
                'Matrix command did not reach a settled submitted frame',
            );
        },
        { kind, count, profile, sequence },
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
    const rows = [];
    const journal = resolve(outDir, 'runs.jsonl');
    try {
        await writeFile(
            journal,
            `${JSON.stringify({
                type: 'header',
                subjects,
                rounds: 4,
                samplesPerRound: 5,
                endpoint:
                    'query edit/switch to settled post-render receipt with unchanged-camera fence',
                browser: browser.version(),
                harnessSha256: hash(await readFile(new URL(import.meta.url))),
                smoke: options.smoke === true,
            })}\n`,
            { flag: 'wx' },
        );
        for (const profile of options.preflight || options.smoke
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
                            await settle(page);
                            const initial = await snapshot(page);
                            if (
                                initial.source !== subject.sourceCommit ||
                                initial.sourceDirty !== 'false' ||
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
                            const action = () =>
                                command(
                                    page,
                                    {
                                        kind:
                                            kind === 'switch'
                                                ? 'switch'
                                                : 'edit',
                                        count: size * size,
                                        profile:
                                            seq % 2
                                                ? 'high-target'
                                                : 'fauna-heavy',
                                    },
                                    ++seq,
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
                                if (errors.length)
                                    throw new Error(
                                        `Unexpected responses/page errors: ${errors}`,
                                    );
                                await writeFile(
                                    resolve(
                                        outDir,
                                        `preflight-${subject.label}.json`,
                                    ),
                                    JSON.stringify(
                                        {
                                            initial,
                                            capture,
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
                                        `preflight-${subject.label}.png`,
                                    ),
                                });
                                console.log(
                                    `Preflight ${subject.label}: verified loaded source, fixture, compiler, camera and sampling protocol`,
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
                                    await action();
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
                                for (let i = 0; i < 5; i++)
                                    samples.push(await action());
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
                                rows.push(row);
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
        await writeFile(
            resolve(outDir, 'latest.json'),
            JSON.stringify(
                {
                    subjects,
                    preflight: options.preflight,
                    smoke: options.smoke === true,
                    rows,
                },
                null,
                2,
            ),
        );
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
    }).catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
