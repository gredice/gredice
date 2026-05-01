import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');
const defaultBaseUrl = 'http://localhost:3001';
const defaultOutDir = resolve(appRoot, 'test-results/game-profile');

const defaultScenarios = [
    {
        name: 'game-baseline-desktop',
        path: '/debug/profile/game?mode=baseline&controls=0&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'game',
    },
    {
        name: 'game-baseline-mobile',
        path: '/debug/profile/game?mode=baseline&controls=0&quality=low',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameMobile',
    },
    {
        name: 'game-details-desktop',
        path: '/debug/profile/game?mode=details&controls=0&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDetails',
    },
    {
        name: 'game-rain-mobile',
        path: '/debug/profile/game?mode=rain&controls=0&quality=low',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'weatherMobile',
    },
    {
        name: 'game-snow-mobile',
        path: '/debug/profile/game?mode=snow&controls=0&quality=low',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'weatherMobile',
    },
    {
        name: 'plants-desktop',
        path: '/debug/plants',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'plants',
    },
];

const budgets = {
    game: {
        p95FrameMs: 16.7,
        maxFrameMs: 100,
        longTaskCount: 0,
        drawCallsPerFrame: 250,
        trianglesPerFrame: 800000,
        jsHeapMb: 180,
    },
    gameMobile: {
        p95FrameMs: 33.3,
        maxFrameMs: 150,
        longTaskCount: 1,
        drawCallsPerFrame: 250,
        trianglesPerFrame: 800000,
        jsHeapMb: 180,
    },
    gameDetails: {
        p95FrameMs: 33.3,
        maxFrameMs: 150,
        longTaskCount: 1,
        drawCallsPerFrame: 350,
        trianglesPerFrame: 1200000,
        jsHeapMb: 220,
    },
    weatherMobile: {
        p95FrameMs: 33.3,
        maxFrameMs: 180,
        longTaskCount: 2,
        drawCallsPerFrame: 320,
        trianglesPerFrame: 1000000,
        jsHeapMb: 220,
    },
    plants: {
        p95FrameMs: 33.3,
        maxFrameMs: 180,
        longTaskCount: 2,
        drawCallsPerFrame: 450,
        trianglesPerFrame: 1600000,
        jsHeapMb: 260,
    },
};

function parseArgs(argv) {
    const options = {
        baseUrl: process.env.GAME_PROFILE_BASE_URL ?? defaultBaseUrl,
        build: process.env.GAME_PROFILE_BUILD === '1',
        failOnBudget: process.env.GAME_PROFILE_FAIL_ON_BUDGET === '1',
        outDir: process.env.GAME_PROFILE_OUT_DIR
            ? resolve(appRoot, process.env.GAME_PROFILE_OUT_DIR)
            : defaultOutDir,
        sampleMs: Number(process.env.GAME_PROFILE_SAMPLE_MS ?? 5000),
        startServer: process.env.GAME_PROFILE_START_SERVER === '1',
        warmupMs: Number(process.env.GAME_PROFILE_WARMUP_MS ?? 5000),
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const next = argv[index + 1];

        switch (arg) {
            case '--':
                break;
            case '--base-url':
                options.baseUrl = next;
                index += 1;
                break;
            case '--build':
                options.build = true;
                break;
            case '--fail-on-budget':
                options.failOnBudget = true;
                break;
            case '--help':
                options.help = true;
                break;
            case '--out-dir':
                options.outDir = resolve(appRoot, next);
                index += 1;
                break;
            case '--sample-ms':
                options.sampleMs = Number(next);
                index += 1;
                break;
            case '--start-server':
                options.startServer = true;
                break;
            case '--warmup-ms':
                options.warmupMs = Number(next);
                index += 1;
                break;
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    if (!Number.isFinite(options.sampleMs) || options.sampleMs <= 0) {
        throw new Error('Sample duration must be a positive number.');
    }

    if (!Number.isFinite(options.warmupMs) || options.warmupMs < 0) {
        throw new Error('Warmup duration must be zero or a positive number.');
    }

    return options;
}

function printHelp(options) {
    console.log(
        [
            'Usage: pnpm run profile:game -- [options]',
            '',
            'Options:',
            `  --base-url <url>       Garden server URL. Current: ${options.baseUrl}`,
            '  --build                Run pnpm run build before profiling.',
            '  --start-server         Start pnpm start before profiling. Requires a built app.',
            '                         Uses the port from --base-url or GAME_PROFILE_BASE_URL.',
            '  --out-dir <path>       Report directory. Default: test-results/game-profile',
            '  --warmup-ms <ms>       Warmup wait after canvas appears. Default: 5000',
            '  --sample-ms <ms>       requestAnimationFrame sample window. Default: 5000',
            '  --fail-on-budget       Exit non-zero when a budget check fails.',
            '  --help                 Show this help.',
            '',
            'Environment aliases:',
            '  GAME_PROFILE_BASE_URL, GAME_PROFILE_BUILD=1,',
            '  GAME_PROFILE_START_SERVER=1,',
            '  GAME_PROFILE_WARMUP_MS, GAME_PROFILE_SAMPLE_MS,',
            '  GAME_PROFILE_OUT_DIR, GAME_PROFILE_FAIL_ON_BUDGET=1',
            '',
        ].join('\n'),
    );
}

function installBrowserMetrics() {
    if (globalThis.__gameProfileMetrics) {
        return;
    }

    globalThis.__gameProfileMetrics = {
        drawCalls: 0,
        instancedDrawCalls: 0,
        submittedTriangles: 0,
    };
    globalThis.__gameProfileLongTasks = [];

    try {
        globalThis.__gameProfileLongTaskObserver = new PerformanceObserver(
            (list) => {
                for (const entry of list.getEntries()) {
                    globalThis.__gameProfileLongTasks.push(entry.duration);
                }
            },
        );
        globalThis.__gameProfileLongTaskObserver.observe({
            type: 'longtask',
            buffered: true,
        });
    } catch (error) {
        globalThis.__gameProfileLongTaskObserverError = String(error);
    }

    const addTriangles = (gl, mode, count, instances = 1) => {
        let triangles = 0;
        if (mode === gl.TRIANGLES) {
            triangles = count / 3;
        } else if (mode === gl.TRIANGLE_STRIP || mode === gl.TRIANGLE_FAN) {
            triangles = Math.max(0, count - 2);
        }

        globalThis.__gameProfileMetrics.submittedTriangles +=
            triangles * Math.max(1, instances || 1);
    };

    const patch = (prototype, name, measure) => {
        if (!prototype?.[name] || prototype[name].__gameProfilePatched) {
            return;
        }

        const original = prototype[name];
        prototype[name] = function patchedDrawCall(...args) {
            measure(this, args);
            return original.apply(this, args);
        };
        prototype[name].__gameProfilePatched = true;
    };

    const patchContext = (Context) => {
        if (!Context) {
            return;
        }

        patch(Context.prototype, 'drawArrays', (gl, args) => {
            globalThis.__gameProfileMetrics.drawCalls += 1;
            addTriangles(gl, args[0], args[2]);
        });
        patch(Context.prototype, 'drawElements', (gl, args) => {
            globalThis.__gameProfileMetrics.drawCalls += 1;
            addTriangles(gl, args[0], args[1]);
        });
        patch(Context.prototype, 'drawArraysInstanced', (gl, args) => {
            globalThis.__gameProfileMetrics.drawCalls += 1;
            globalThis.__gameProfileMetrics.instancedDrawCalls += 1;
            addTriangles(gl, args[0], args[2], args[3]);
        });
        patch(Context.prototype, 'drawElementsInstanced', (gl, args) => {
            globalThis.__gameProfileMetrics.drawCalls += 1;
            globalThis.__gameProfileMetrics.instancedDrawCalls += 1;
            addTriangles(gl, args[0], args[1], args[4]);
        });
    };

    patchContext(globalThis.WebGLRenderingContext);
    patchContext(globalThis.WebGL2RenderingContext);
}

async function wait(milliseconds) {
    await new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function isReachable(baseUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    try {
        const response = await fetch(baseUrl, {
            cache: 'no-store',
            signal: controller.signal,
        });
        return response.status < 500;
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

async function waitForServer(baseUrl, timeoutMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        if (await isReachable(baseUrl)) {
            return;
        }
        await wait(500);
    }

    throw new Error(`Timed out waiting for ${baseUrl}`);
}

function resolveServerPort(baseUrl) {
    const url = new URL(baseUrl);
    if (url.port) {
        return url.port;
    }

    return url.protocol === 'https:' ? '443' : '80';
}

function runPackageScript(script) {
    return new Promise((resolveRun, rejectRun) => {
        const child = spawn('pnpm', ['run', script], {
            cwd: appRoot,
            env: process.env,
            stdio: 'inherit',
        });

        child.on('error', rejectRun);
        child.on('exit', (code, signal) => {
            if (code === 0) {
                resolveRun();
                return;
            }

            rejectRun(
                new Error(
                    `pnpm run ${script} exited with ${signal ? `signal ${signal}` : `code ${code}`}.`,
                ),
            );
        });
    });
}

function startServer(baseUrl) {
    const port = resolveServerPort(baseUrl);
    let stopping = false;
    const child = spawn('pnpm', ['start'], {
        cwd: appRoot,
        env: {
            ...process.env,
            PORT: port,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    const logs = [];
    const collect = (chunk) => {
        logs.push(chunk.toString());
        if (logs.length > 80) {
            logs.shift();
        }
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);

    const exited = new Promise((resolveExit) => {
        child.on('exit', (code) => {
            if (!stopping && code && code !== 0) {
                console.error(`Profile server exited with code ${code}.`);
                console.error(logs.join(''));
            }

            resolveExit();
        });
    });

    return {
        async stop() {
            stopping = true;
            if (!child.killed) {
                child.kill('SIGTERM');
            }
            await exited;
        },
    };
}

async function measureScenario(browser, baseUrl, scenario, options) {
    const context = await browser.newContext({
        deviceScaleFactor: scenario.dpr,
        hasTouch: scenario.isMobile,
        isMobile: scenario.isMobile,
        viewport: scenario.viewport,
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const consoleMessages = [];
    const pageErrors = [];

    await cdp.send('Performance.enable');
    await page.addInitScript(installBrowserMetrics);

    page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
            consoleMessages.push({
                type: message.type(),
                text: message.text().slice(0, 300),
            });
        }
    });
    page.on('pageerror', (error) => {
        pageErrors.push(error.message.slice(0, 300));
    });

    const url = new URL(scenario.path, baseUrl).toString();
    const navigationStart = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const domContentLoadedMs = Date.now() - navigationStart;
    await page.waitForSelector('canvas', {
        state: 'attached',
        timeout: 60000,
    });
    await page.waitForFunction(
        () => {
            const canvas = document.querySelector('canvas');
            return Boolean(canvas && canvas.width > 0 && canvas.height > 0);
        },
        { timeout: 60000 },
    );
    await page.evaluate(
        () =>
            new Promise((resolveFrame) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(resolveFrame),
                ),
            ),
    );
    const canvasReadyMs = Date.now() - navigationStart;

    await page.evaluate(
        (warmupMs) =>
            new Promise((resolveWarmup) => setTimeout(resolveWarmup, warmupMs)),
        options.warmupMs,
    );

    const beforeMetrics = await cdp.send('Performance.getMetrics');
    const before = Object.fromEntries(
        beforeMetrics.metrics.map((metric) => [metric.name, metric.value]),
    );

    const sample = await page.evaluate(async (sampleMs) => {
        const canvas = document.querySelector('canvas');
        const metrics = globalThis.__gameProfileMetrics;
        if (metrics) {
            metrics.drawCalls = 0;
            metrics.instancedDrawCalls = 0;
            metrics.submittedTriangles = 0;
        }
        globalThis.__gameProfileLongTasks = [];

        const intervals = [];
        const start = performance.now();
        let last = start;

        await new Promise((resolveSample) => {
            const step = (now) => {
                intervals.push(now - last);
                last = now;
                if (now - start >= sampleMs) {
                    resolveSample();
                    return;
                }
                requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        });

        const frameIntervals = intervals.slice(1);
        const sortedIntervals = [...frameIntervals].sort((a, b) => a - b);
        const percentile = (value) =>
            sortedIntervals[
                Math.min(
                    sortedIntervals.length - 1,
                    Math.floor(sortedIntervals.length * value),
                )
            ] ?? 0;
        const averageFrameMs =
            frameIntervals.reduce((sum, value) => sum + value, 0) /
            Math.max(1, frameIntervals.length);
        const longTasks = globalThis.__gameProfileLongTasks ?? [];
        const drawCalls = metrics?.drawCalls ?? 0;
        const submittedTriangles = Math.round(metrics?.submittedTriangles ?? 0);
        const frames = frameIntervals.length;

        return {
            averageFrameMs,
            canvas: canvas
                ? {
                      clientHeight: canvas.clientHeight,
                      clientWidth: canvas.clientWidth,
                      height: canvas.height,
                      width: canvas.width,
                  }
                : null,
            drawCalls,
            drawCallsPerFrame: drawCalls / Math.max(1, frames),
            fps: frames / ((performance.now() - start) / 1000),
            frames,
            instancedDrawCalls: metrics?.instancedDrawCalls ?? 0,
            jsHeapMb: performance.memory
                ? performance.memory.usedJSHeapSize / 1024 / 1024
                : null,
            longTaskCount: longTasks.length,
            longTaskMaxMs: Math.max(0, ...longTasks),
            longTaskTotalMs: longTasks.reduce((sum, value) => sum + value, 0),
            maxFrameMs: sortedIntervals.at(-1) ?? 0,
            p50FrameMs: percentile(0.5),
            p95FrameMs: percentile(0.95),
            p99FrameMs: percentile(0.99),
            reportedDpr: globalThis.devicePixelRatio,
            submittedTriangles,
            trianglesPerFrame: submittedTriangles / Math.max(1, frames),
        };
    }, options.sampleMs);

    const runtime = await page.evaluate(() => {
        const metadata = globalThis.__grediceGameProfile;
        if (!metadata || typeof metadata !== 'object') {
            return null;
        }

        return {
            dprCap:
                typeof metadata.dprCap === 'number' ? metadata.dprCap : null,
            groundDecorationCount:
                typeof metadata.groundDecorationCount === 'number'
                    ? metadata.groundDecorationCount
                    : null,
            groundDecorationDensity:
                typeof metadata.groundDecorationDensity === 'number'
                    ? metadata.groundDecorationDensity
                    : null,
            instancedSnowOverlayCount:
                typeof metadata.instancedSnowOverlayCount === 'number'
                    ? metadata.instancedSnowOverlayCount
                    : null,
            qualityTier:
                typeof metadata.qualityTier === 'string'
                    ? metadata.qualityTier
                    : null,
            rainParticleCount:
                typeof metadata.rainParticleCount === 'number'
                    ? metadata.rainParticleCount
                    : null,
            raisedBedMulchOverlayCount:
                typeof metadata.raisedBedMulchOverlayCount === 'number'
                    ? metadata.raisedBedMulchOverlayCount
                    : null,
            shadowMapSize:
                typeof metadata.shadowMapSize === 'number'
                    ? metadata.shadowMapSize
                    : null,
            shadowsEnabled:
                typeof metadata.shadowsEnabled === 'boolean'
                    ? metadata.shadowsEnabled
                    : null,
            snowOverlayMinCoverage:
                typeof metadata.snowOverlayMinCoverage === 'number'
                    ? metadata.snowOverlayMinCoverage
                    : null,
            snowParticleCount:
                typeof metadata.snowParticleCount === 'number'
                    ? metadata.snowParticleCount
                    : null,
            weatherDisabled:
                typeof metadata.weatherDisabled === 'boolean'
                    ? metadata.weatherDisabled
                    : null,
        };
    });

    const afterMetrics = await cdp.send('Performance.getMetrics');
    const after = Object.fromEntries(
        afterMetrics.metrics.map((metric) => [metric.name, metric.value]),
    );

    await context.close();

    const roundedSample = roundSample(sample);
    return {
        budget: evaluateBudget(roundedSample, budgets[scenario.budget]),
        consoleMessages: consoleMessages.slice(0, 8),
        cdp: {
            jsHeapMb: round((after.JSHeapUsedSize ?? 0) / 1024 / 1024, 1),
            layoutDuration: round(
                (after.LayoutDuration ?? 0) - (before.LayoutDuration ?? 0),
                4,
            ),
            scriptDuration: round(
                (after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0),
                4,
            ),
            taskDuration: round(
                (after.TaskDuration ?? 0) - (before.TaskDuration ?? 0),
                4,
            ),
        },
        domContentLoadedMs,
        canvasReadyMs,
        pageErrors,
        path: scenario.path,
        requested: {
            dpr: scenario.dpr,
            isMobile: scenario.isMobile,
            viewport: scenario.viewport,
        },
        runtime,
        sample: roundedSample,
        url,
        name: scenario.name,
    };
}

function round(value, digits = 2) {
    if (value === null || value === undefined) {
        return value;
    }

    const multiplier = 10 ** digits;
    return Math.round(value * multiplier) / multiplier;
}

function roundSample(sample) {
    return {
        ...sample,
        averageFrameMs: round(sample.averageFrameMs),
        drawCallsPerFrame: round(sample.drawCallsPerFrame, 1),
        fps: round(sample.fps, 1),
        jsHeapMb: round(sample.jsHeapMb, 1),
        longTaskMaxMs: round(sample.longTaskMaxMs, 1),
        longTaskTotalMs: round(sample.longTaskTotalMs, 1),
        maxFrameMs: round(sample.maxFrameMs),
        p50FrameMs: round(sample.p50FrameMs),
        p95FrameMs: round(sample.p95FrameMs),
        p99FrameMs: round(sample.p99FrameMs),
        trianglesPerFrame: Math.round(sample.trianglesPerFrame),
    };
}

function evaluateBudget(sample, budget) {
    const checks = [
        ['p95FrameMs', sample.p95FrameMs, budget.p95FrameMs],
        ['maxFrameMs', sample.maxFrameMs, budget.maxFrameMs],
        ['longTaskCount', sample.longTaskCount, budget.longTaskCount],
        [
            'drawCallsPerFrame',
            sample.drawCallsPerFrame,
            budget.drawCallsPerFrame,
        ],
        [
            'trianglesPerFrame',
            sample.trianglesPerFrame,
            budget.trianglesPerFrame,
        ],
        ['jsHeapMb', sample.jsHeapMb ?? 0, budget.jsHeapMb],
    ].map(([name, actual, limit]) => ({
        actual,
        limit,
        name,
        pass: actual <= limit,
    }));

    return {
        checks,
        pass: checks.every((check) => check.pass),
    };
}

function buildMarkdown(report) {
    const lines = [
        '# Game Scene Profile Report',
        '',
        `Generated: ${report.generatedAt}`,
        '',
        `Base URL: ${report.baseUrl}`,
        '',
        `Build: ${report.options.build ? 'yes' : 'no'}`,
        `Server: ${report.options.managedServer ? 'managed pnpm start' : 'external'}`,
        `Warmup: ${report.options.warmupMs} ms`,
        `Sample: ${report.options.sampleMs} ms`,
        '',
        `Budget status: ${report.summary.failedScenarios === 0 ? 'pass' : 'fail'}`,
        '',
        '| Scenario | Quality | Canvas | Shadow | Rain/Snow | Overlays/Decor | FPS | p95 | Max | Draw/frame | Triangles/frame | Long tasks | Heap | Budget |',
        '| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ];

    for (const scenario of report.scenarios) {
        const canvas = scenario.sample.canvas
            ? `${scenario.sample.canvas.width}x${scenario.sample.canvas.height}`
            : 'n/a';
        const quality = scenario.runtime?.qualityTier ?? 'n/a';
        const shadow = scenario.runtime
            ? scenario.runtime.shadowsEnabled
                ? `${scenario.runtime.shadowMapSize}px`
                : 'off'
            : 'n/a';
        const weather = scenario.runtime
            ? `${scenario.runtime.rainParticleCount ?? 0}/${scenario.runtime.snowParticleCount ?? 0}`
            : 'n/a';
        const detailCounts = scenario.runtime
            ? `${scenario.runtime.instancedSnowOverlayCount ?? 0}+${scenario.runtime.raisedBedMulchOverlayCount ?? 0}/${scenario.runtime.groundDecorationCount ?? 0}`
            : 'n/a';
        lines.push(
            `| ${scenario.name} | ${quality} | ${canvas} | ${shadow} | ${weather} | ${detailCounts} | ${scenario.sample.fps} | ${scenario.sample.p95FrameMs} ms | ${scenario.sample.maxFrameMs} ms | ${scenario.sample.drawCallsPerFrame} | ${scenario.sample.trianglesPerFrame} | ${scenario.sample.longTaskCount} | ${scenario.sample.jsHeapMb ?? 'n/a'} MB | ${scenario.budget.pass ? 'pass' : 'fail'} |`,
        );
    }

    lines.push('', '## Failed Budget Checks', '');
    const failures = report.scenarios.flatMap((scenario) =>
        scenario.budget.checks
            .filter((check) => !check.pass)
            .map(
                (check) =>
                    `- ${scenario.name}: ${check.name} ${check.actual} > ${check.limit}`,
            ),
    );
    lines.push(...(failures.length ? failures : ['- None']));

    lines.push('', '## Console Warnings And Errors', '');
    for (const scenario of report.scenarios) {
        if (!scenario.consoleMessages.length && !scenario.pageErrors.length) {
            continue;
        }
        lines.push(`### ${scenario.name}`, '');
        for (const error of scenario.pageErrors) {
            lines.push(`- page error: ${error}`);
        }
        for (const message of scenario.consoleMessages) {
            lines.push(`- ${message.type}: ${message.text}`);
        }
        lines.push('');
    }

    return `${lines.join('\n')}\n`;
}

async function writeReports(report, outDir) {
    const stamp = report.generatedAt.replaceAll(/[:.]/g, '-');
    const json = `${JSON.stringify(report, null, 2)}\n`;
    const markdown = buildMarkdown(report);

    await mkdir(outDir, { recursive: true });
    await Promise.all([
        writeFile(resolve(outDir, `${stamp}.json`), json),
        writeFile(resolve(outDir, `${stamp}.md`), markdown),
        writeFile(resolve(outDir, 'latest.json'), json),
        writeFile(resolve(outDir, 'latest.md'), markdown),
    ]);
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp(options);
        return;
    }

    if (options.startServer && (await isReachable(options.baseUrl))) {
        throw new Error(
            `${options.baseUrl} is already reachable. Stop the existing server or pass --base-url with an unused port so production profiling does not accidentally use a dev server.`,
        );
    }

    if (options.build) {
        await runPackageScript('build');
    }

    let server;
    const serverReachable = await isReachable(options.baseUrl);

    if (options.startServer) {
        if (serverReachable) {
            throw new Error(
                `${options.baseUrl} is already reachable. Stop the existing server or pass --base-url with an unused port so production profiling does not accidentally use a dev server.`,
            );
        }

        server = startServer(options.baseUrl);
        try {
            await waitForServer(options.baseUrl, 60000);
        } catch (error) {
            await server.stop();
            throw error;
        }
    } else if (!serverReachable) {
        throw new Error(
            `${options.baseUrl} is not reachable. Start garden first or pass --start-server after building the app.`,
        );
    }

    const startedAt = Date.now();
    let browser;
    try {
        browser = await chromium.launch({
            args: [
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
            ],
            headless: true,
        });
    } catch (error) {
        if (server) {
            await server.stop();
        }

        if (String(error).includes("Executable doesn't exist")) {
            throw new Error(
                'Playwright Chromium is missing. Run `pnpm exec playwright install chromium` from apps/garden.',
            );
        }
        throw error;
    }

    try {
        const scenarios = [];
        for (const scenario of defaultScenarios) {
            console.log(`Profiling ${scenario.name}...`);
            scenarios.push(
                await measureScenario(
                    browser,
                    options.baseUrl,
                    scenario,
                    options,
                ),
            );
        }

        const failedScenarios = scenarios.filter(
            (scenario) => !scenario.budget.pass,
        );
        const report = {
            baseUrl: options.baseUrl,
            generatedAt: new Date().toISOString(),
            options: {
                build: options.build,
                managedServer: options.startServer,
                sampleMs: options.sampleMs,
                warmupMs: options.warmupMs,
            },
            scenarios,
            summary: {
                durationMs: Date.now() - startedAt,
                failedScenarios: failedScenarios.length,
                passedScenarios: scenarios.length - failedScenarios.length,
                totalScenarios: scenarios.length,
            },
        };

        await writeReports(report, options.outDir);

        console.log(`Wrote ${resolve(options.outDir, 'latest.md')}`);
        console.log(
            `Budget status: ${failedScenarios.length === 0 ? 'pass' : 'fail'}`,
        );

        if (failedScenarios.length > 0 && options.failOnBudget) {
            process.exitCode = 1;
        }
    } finally {
        await browser?.close();
        if (server) {
            await server.stop();
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
