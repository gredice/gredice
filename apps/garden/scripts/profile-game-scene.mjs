import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');
const defaultBaseUrl = 'http://localhost:3001';
const defaultOutDir = resolve(appRoot, 'test-results/game-profile');
const gameProfileWeatherTransitionEventName =
    'gredice:game-profile-weather-transition';
const gameProfileCloseupCommandEventName =
    'gredice:game-profile-closeup-command';

const coreScenarios = [
    {
        name: 'game-baseline-desktop',
        path: '/debug/profile/game?mode=baseline&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'game',
    },
    {
        name: 'game-baseline-mobile',
        path: '/debug/profile/game?mode=baseline&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameMobile',
    },
    {
        name: 'game-details-desktop',
        path: '/debug/profile/game?mode=details&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDetails',
    },
    {
        name: 'game-rain-mobile',
        path: '/debug/profile/game?mode=rain&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'weatherMobile',
    },
    {
        name: 'game-snow-mobile',
        path: '/debug/profile/game?mode=snow&quality=medium',
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

const denseScenarios = [
    {
        name: 'game-dense-25x25-desktop',
        path: '/debug/profile/game?mode=details&profile=dense&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDense',
    },
    {
        name: 'game-dense-25x25-high-desktop',
        path: '/debug/profile/game?mode=details&profile=dense&quality=high',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDenseHigh',
    },
    {
        name: 'game-dense-25x25-controls-desktop',
        path: '/debug/profile/game?mode=details&profile=dense&controls=1&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDense',
    },
    {
        name: 'game-dense-25x25-camera-motion',
        path: '/debug/profile/game?mode=details&profile=dense&controls=1&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDenseMotion',
        motion: 'pan-zoom-rotate',
    },
    {
        name: 'game-dense-25x25-rain-desktop',
        path: '/debug/profile/game?mode=rain&profile=dense&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDenseWeather',
    },
    {
        name: 'game-dense-25x25-snow-desktop',
        path: '/debug/profile/game?mode=snow&profile=dense&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDenseWeather',
    },
    {
        name: 'game-dense-25x25-cloudy-desktop',
        path: '/debug/profile/game?mode=cloudy&profile=dense&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDenseWeather',
    },
    {
        name: 'game-dense-25x25-windy-desktop',
        path: '/debug/profile/game?mode=windy&profile=dense&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDenseWeather',
    },
    {
        name: 'game-plant-heavy-25x25-desktop',
        path: '/debug/profile/game?mode=details&profile=plant-heavy&quality=medium',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDensePlants',
    },
];

const denseMobileScenarios = [
    {
        name: 'game-dense-25x25-baseline-mobile',
        path: '/debug/profile/game?mode=baseline&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseMobile',
    },
    {
        name: 'game-dense-25x25-details-mobile',
        path: '/debug/profile/game?mode=details&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseMobile',
    },
    {
        name: 'game-dense-25x25-camera-motion-mobile',
        path: '/debug/profile/game?mode=details&profile=dense&controls=1&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseMotionMobile',
        motion: 'pan-zoom-rotate',
    },
    {
        name: 'game-dense-25x25-rain-mobile',
        path: '/debug/profile/game?mode=rain&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
    },
    {
        name: 'game-dense-25x25-snow-mobile',
        path: '/debug/profile/game?mode=snow&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
    },
    {
        name: 'game-dense-25x25-cloudy-mobile',
        path: '/debug/profile/game?mode=cloudy&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
    },
    {
        name: 'game-dense-25x25-windy-mobile',
        path: '/debug/profile/game?mode=windy&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
    },
    {
        name: 'game-plant-heavy-25x25-mobile',
        path: '/debug/profile/game?mode=details&profile=plant-heavy&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDensePlantsMobile',
    },
];

const constrainedAutoQualityDevice = {
    autoQualityDeviceClass: 'constrained',
    navigatorMetrics: {
        deviceMemory: 4,
        hardwareConcurrency: 4,
    },
};

const standardAutoQualityDevice = {
    autoQualityDeviceClass: 'standard',
    navigatorMetrics: {
        deviceMemory: 8,
        hardwareConcurrency: 8,
    },
};

const plantCloseupScenarios = [
    {
        name: 'game-plant-heavy-closeup-desktop',
        path: '/debug/profile/game?mode=details&profile=plant-heavy&quality=medium&controls=0&details=1&hud=0&debugHud=0&closeupRaisedBedId=29',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'gameDensePlants',
        plantCloseup: {
            repeat: 3,
            raisedBedId: 29,
        },
    },
    {
        name: 'game-plant-heavy-closeup-mobile',
        path: '/debug/profile/game?mode=details&profile=plant-heavy&quality=auto&controls=0&details=1&hud=0&debugHud=0&closeupRaisedBedId=29',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDensePlantsMobile',
        plantCloseup: {
            repeat: 3,
            raisedBedId: 29,
        },
        ...constrainedAutoQualityDevice,
    },
];

const autoQualityScenarios = [
    {
        name: 'game-auto-quality-standard-desktop',
        path: '/debug/profile/game?mode=baseline&quality=auto',
        viewport: { width: 1280, height: 720 },
        dpr: 1,
        isMobile: false,
        budget: 'game',
        ...standardAutoQualityDevice,
    },
    {
        name: 'game-auto-quality-medium-dense-mobile',
        path: '/debug/profile/game?mode=baseline&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseMobile',
        ...constrainedAutoQualityDevice,
    },
    {
        name: 'game-auto-quality-auto-dense-mobile',
        path: '/debug/profile/game?mode=baseline&profile=dense&quality=auto',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseMobile',
        ...constrainedAutoQualityDevice,
    },
    {
        name: 'game-auto-quality-medium-dense-rain-mobile',
        path: '/debug/profile/game?mode=rain&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
        ...constrainedAutoQualityDevice,
    },
    {
        name: 'game-auto-quality-auto-dense-rain-mobile',
        path: '/debug/profile/game?mode=rain&profile=dense&quality=auto',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
        ...constrainedAutoQualityDevice,
    },
    {
        name: 'game-auto-quality-medium-dense-snow-mobile',
        path: '/debug/profile/game?mode=snow&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
        ...constrainedAutoQualityDevice,
    },
    {
        name: 'game-auto-quality-auto-dense-snow-mobile',
        path: '/debug/profile/game?mode=snow&profile=dense&quality=auto',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
        ...constrainedAutoQualityDevice,
    },
    {
        name: 'game-auto-quality-medium-dense-cloudy-mobile',
        path: '/debug/profile/game?mode=cloudy&profile=dense&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
        ...constrainedAutoQualityDevice,
    },
    {
        name: 'game-auto-quality-auto-dense-cloudy-mobile',
        path: '/debug/profile/game?mode=cloudy&profile=dense&quality=auto',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'gameDenseWeatherMobile',
        ...constrainedAutoQualityDevice,
    },
];

const rewardScenarios = [
    {
        name: 'game-operation-rewards-matrix-desktop',
        path: '/debug/profile/game?mode=details&profile=operation-rewards&controls=1&quality=medium&legend=0',
        viewport: { width: 1440, height: 1200 },
        dpr: 1,
        isMobile: false,
        budget: 'gameRewards',
    },
];

const weatherTransitionScenarios = [
    {
        name: 'game-weather-clear-to-cloudy-mobile',
        path: '/debug/profile/game?mode=baseline&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'weatherMobile',
        weatherTransition: 'clear-to-cloudy',
    },
    {
        name: 'game-weather-cloudy-to-clear-mobile',
        path: '/debug/profile/game?mode=cloudy&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'weatherMobile',
        weatherTransition: 'cloudy-to-clear',
    },
    {
        name: 'game-weather-rain-to-clear-mobile',
        path: '/debug/profile/game?mode=rain&quality=medium',
        viewport: { width: 390, height: 844 },
        dpr: 3,
        isMobile: true,
        budget: 'weatherMobile',
        weatherTransition: 'rain-to-clear',
    },
];

const scenarioSets = {
    'auto-quality': autoQualityScenarios,
    core: coreScenarios,
    dense: denseScenarios,
    'dense-mobile': denseMobileScenarios,
    'plant-closeup': plantCloseupScenarios,
    rewards: rewardScenarios,
    'weather-transitions': weatherTransitionScenarios,
};

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
    gameDense: {
        p95FrameMs: 50,
        maxFrameMs: 220,
        longTaskCount: 4,
        drawCallsPerFrame: 1200,
        trianglesPerFrame: 4000000,
        jsHeapMb: 360,
    },
    gameDenseHigh: {
        p95FrameMs: 66.7,
        maxFrameMs: 260,
        longTaskCount: 6,
        drawCallsPerFrame: 1400,
        trianglesPerFrame: 5000000,
        jsHeapMb: 420,
    },
    gameDenseMotion: {
        p95FrameMs: 66.7,
        maxFrameMs: 260,
        longTaskCount: 6,
        drawCallsPerFrame: 1400,
        trianglesPerFrame: 5000000,
        jsHeapMb: 420,
    },
    gameDenseWeather: {
        p95FrameMs: 66.7,
        maxFrameMs: 280,
        longTaskCount: 8,
        drawCallsPerFrame: 1500,
        trianglesPerFrame: 5500000,
        jsHeapMb: 440,
    },
    gameDensePlants: {
        p95FrameMs: 83.3,
        maxFrameMs: 320,
        longTaskCount: 10,
        drawCallsPerFrame: 1800,
        trianglesPerFrame: 7000000,
        jsHeapMb: 520,
    },
    gameDenseMobile: {
        p95FrameMs: 33.3,
        maxFrameMs: 220,
        longTaskCount: 4,
        drawCallsPerFrame: 1200,
        trianglesPerFrame: 4000000,
        jsHeapMb: 360,
    },
    gameDenseMotionMobile: {
        p95FrameMs: 33.3,
        maxFrameMs: 260,
        longTaskCount: 6,
        drawCallsPerFrame: 1400,
        trianglesPerFrame: 5000000,
        jsHeapMb: 420,
    },
    gameDenseWeatherMobile: {
        p95FrameMs: 33.3,
        maxFrameMs: 280,
        longTaskCount: 8,
        drawCallsPerFrame: 1500,
        trianglesPerFrame: 5500000,
        jsHeapMb: 440,
    },
    gameDensePlantsMobile: {
        p95FrameMs: 33.3,
        maxFrameMs: 320,
        longTaskCount: 10,
        drawCallsPerFrame: 1800,
        trianglesPerFrame: 7000000,
        jsHeapMb: 520,
    },
    gameRewards: {
        p95FrameMs: 1000,
        maxFrameMs: 1200,
        longTaskCount: 12,
        drawCallsPerFrame: 2400,
        trianglesPerFrame: 6500000,
        jsHeapMb: 500,
    },
};

function parseArgs(argv) {
    const options = {
        baseUrl: process.env.GAME_PROFILE_BASE_URL ?? defaultBaseUrl,
        build: process.env.GAME_PROFILE_BUILD === '1',
        closeupTimeoutMs: Number(
            process.env.GAME_PROFILE_CLOSEUP_TIMEOUT_MS ?? 30000,
        ),
        failOnBudget: process.env.GAME_PROFILE_FAIL_ON_BUDGET === '1',
        outDir: process.env.GAME_PROFILE_OUT_DIR
            ? resolve(appRoot, process.env.GAME_PROFILE_OUT_DIR)
            : defaultOutDir,
        sampleMs: Number(process.env.GAME_PROFILE_SAMPLE_MS ?? 5000),
        scenarios: (process.env.GAME_PROFILE_SCENARIOS ?? '')
            .split(',')
            .map((scenario) => scenario.trim())
            .filter(Boolean),
        scenarioSet: process.env.GAME_PROFILE_SCENARIO_SET ?? 'core',
        screenshots: process.env.GAME_PROFILE_SCREENSHOTS === '1',
        soakMs: Number(process.env.GAME_PROFILE_SOAK_MS ?? 0),
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
            case '--closeup-timeout-ms':
                options.closeupTimeoutMs = Number(next);
                index += 1;
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
            case '--scenario':
                options.scenarios.push(
                    ...next
                        .split(',')
                        .map((scenario) => scenario.trim())
                        .filter(Boolean),
                );
                index += 1;
                break;
            case '--scenario-set':
                options.scenarioSet = next;
                index += 1;
                break;
            case '--screenshots':
                options.screenshots = true;
                break;
            case '--start-server':
                options.startServer = true;
                break;
            case '--soak-ms':
                options.soakMs = Number(next);
                index += 1;
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
    if (
        !Number.isFinite(options.closeupTimeoutMs) ||
        options.closeupTimeoutMs <= 0
    ) {
        throw new Error('Close-up timeout must be a positive number.');
    }

    if (!Number.isFinite(options.soakMs) || options.soakMs < 0) {
        throw new Error('Soak duration must be zero or a positive number.');
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
            `  --closeup-timeout-ms <ms> Maximum wait for close-up detail. Current: ${options.closeupTimeoutMs}`,
            '  --start-server         Start pnpm start before profiling. Requires a built app.',
            '                         Uses the port from --base-url or GAME_PROFILE_BASE_URL.',
            '  --out-dir <path>       Report directory. Default: test-results/game-profile',
            '  --warmup-ms <ms>       Warmup wait after canvas appears. Default: 5000',
            '  --soak-ms <ms>         Run the scene before sampling. Default: 0',
            '  --sample-ms <ms>       requestAnimationFrame sample window. Default: 5000',
            `  --scenario-set <set>    core, dense, dense-mobile, plant-closeup, auto-quality, rewards, weather-transitions, all, or comma-separated names. Current: ${options.scenarioSet}`,
            '  --scenario <name>       Profile exact scenario name(s). Repeat or use commas.',
            '  --screenshots           Save a PNG screenshot for each scenario.',
            '  --fail-on-budget       Exit non-zero when a budget check fails.',
            '  --help                 Show this help.',
            '',
            'Environment aliases:',
            '  GAME_PROFILE_BASE_URL, GAME_PROFILE_BUILD=1,',
            '  GAME_PROFILE_CLOSEUP_TIMEOUT_MS,',
            '  GAME_PROFILE_START_SERVER=1,',
            '  GAME_PROFILE_WARMUP_MS, GAME_PROFILE_SOAK_MS,',
            '  GAME_PROFILE_SAMPLE_MS, GAME_PROFILE_OUT_DIR,',
            '  GAME_PROFILE_SCENARIO_SET, GAME_PROFILE_SCENARIOS,',
            '  GAME_PROFILE_SCREENSHOTS=1,',
            '  GAME_PROFILE_FAIL_ON_BUDGET=1',
            '',
        ].join('\n'),
    );
}

function allScenarios() {
    return [
        ...coreScenarios,
        ...denseScenarios,
        ...denseMobileScenarios,
        ...plantCloseupScenarios,
        ...autoQualityScenarios,
        ...rewardScenarios,
        ...weatherTransitionScenarios,
    ];
}

function resolveScenarios(scenarioSet, scenarioNames = []) {
    const tokens = scenarioNames.length
        ? scenarioNames
        : scenarioSet
              .split(',')
              .map((token) => token.trim())
              .filter(Boolean);
    const selected =
        tokens.length > 0
            ? tokens
            : [process.env.GAME_PROFILE_SCENARIO_SET ?? 'core'];
    const scenarios = [];
    const seen = new Set();
    const knownScenarios = allScenarios();

    for (const token of selected) {
        const candidates =
            token === 'all'
                ? knownScenarios
                : (scenarioSets[token] ??
                  knownScenarios.filter((scenario) => scenario.name === token));

        if (!candidates.length) {
            throw new Error(
                `Unknown scenario set or scenario: ${token}. Use core, dense, dense-mobile, plant-closeup, auto-quality, rewards, weather-transitions, all, or one of: ${knownScenarios.map((scenario) => scenario.name).join(', ')}.`,
            );
        }

        for (const scenario of candidates) {
            if (!seen.has(scenario.name)) {
                scenarios.push(scenario);
                seen.add(scenario.name);
            }
        }
    }

    return scenarios;
}

function getScenarioRequest(path) {
    const url = new URL(path, 'http://profile.local');
    return {
        controls: url.searchParams.get('controls') ?? '0',
        closeupRaisedBedId:
            Number.parseInt(
                url.searchParams.get('closeupRaisedBedId') ?? '',
                10,
            ) || null,
        details: url.searchParams.get('details') ?? '1',
        debugHud: url.searchParams.get('debugHud') ?? '0',
        gardenProfile: url.searchParams.get('profile') ?? 'default',
        hud: url.searchParams.get('hud') ?? '0',
        mode: url.searchParams.get('mode') ?? 'baseline',
        quality: url.searchParams.get('quality') ?? 'auto',
    };
}

function installNavigatorMetrics({ deviceMemory, hardwareConcurrency }) {
    Object.defineProperties(globalThis.navigator, {
        deviceMemory: {
            configurable: true,
            get: () => deviceMemory,
        },
        hardwareConcurrency: {
            configurable: true,
            get: () => hardwareConcurrency,
        },
    });
}

function installBrowserMetrics() {
    if (globalThis.__gameProfileMetrics) {
        return;
    }

    globalThis.__gameProfileMetrics = {
        drawCalls: 0,
        instancedDrawCalls: 0,
        lastRenderedRafTick: -1,
        renderedFrames: 0,
        submittedTriangles: 0,
    };
    globalThis.__gameProfileLongTasks = [];

    let rafTick = 0;
    const gpuTimer = {
        active: null,
        context: null,
        disjoint: false,
        extension: null,
        generation: 0,
        pending: [],
        reason: 'no WebGL2 draw observed',
        samples: [],
        supported: null,
    };
    const pollGpuQueries = () => {
        const gl = gpuTimer.context;
        const extension = gpuTimer.extension;
        if (!gl || !extension) {
            return;
        }

        if (gl.getParameter(extension.GPU_DISJOINT_EXT)) {
            gpuTimer.disjoint = true;
        }
        gpuTimer.pending = gpuTimer.pending.filter((entry) => {
            if (!gl.getQueryParameter(entry.query, gl.QUERY_RESULT_AVAILABLE)) {
                return true;
            }
            const elapsedNanoseconds = gl.getQueryParameter(
                entry.query,
                gl.QUERY_RESULT,
            );
            if (
                entry.generation === gpuTimer.generation &&
                !gpuTimer.disjoint &&
                Number.isFinite(elapsedNanoseconds)
            ) {
                gpuTimer.samples.push(elapsedNanoseconds / 1_000_000);
            }
            gl.deleteQuery(entry.query);
            return false;
        });
    };
    const endGpuQuery = () => {
        const gl = gpuTimer.context;
        const extension = gpuTimer.extension;
        if (!gl || !extension || !gpuTimer.active) {
            return;
        }
        gl.endQuery(extension.TIME_ELAPSED_EXT);
        gpuTimer.pending.push(gpuTimer.active);
        gpuTimer.active = null;
    };
    const beginGpuFrame = (gl) => {
        if (
            typeof WebGL2RenderingContext === 'undefined' ||
            !(gl instanceof WebGL2RenderingContext)
        ) {
            if (gpuTimer.supported === null) {
                gpuTimer.supported = false;
                gpuTimer.reason = 'WebGL2 is unavailable';
            }
            return;
        }
        if (!gpuTimer.context) {
            gpuTimer.context = gl;
            gpuTimer.extension = gl.getExtension(
                'EXT_disjoint_timer_query_webgl2',
            );
            gpuTimer.supported = Boolean(gpuTimer.extension);
            gpuTimer.reason = gpuTimer.extension
                ? null
                : 'EXT_disjoint_timer_query_webgl2 is unavailable';
        }
        if (!gpuTimer.extension || gpuTimer.context !== gl) {
            return;
        }
        if (gpuTimer.active?.rafTick === rafTick) {
            return;
        }

        endGpuQuery();
        pollGpuQueries();
        const query = gl.createQuery();
        if (!query) {
            gpuTimer.supported = false;
            gpuTimer.reason = 'Unable to allocate a WebGL timer query';
            return;
        }
        gl.beginQuery(gpuTimer.extension.TIME_ELAPSED_EXT, query);
        gpuTimer.active = {
            generation: gpuTimer.generation,
            query,
            rafTick,
        };
    };
    globalThis.__gameProfileGpuTimer = {
        async finish() {
            endGpuQuery();
            await new Promise((resolveFrame) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(resolveFrame),
                ),
            );
            pollGpuQueries();
        },
        reset() {
            gpuTimer.generation += 1;
            gpuTimer.disjoint = false;
            gpuTimer.samples = [];
        },
        snapshot() {
            pollGpuQueries();
            const sorted = [...gpuTimer.samples].sort((a, b) => a - b);
            const totalMs = sorted.reduce((total, value) => total + value, 0);
            return {
                disjoint: gpuTimer.disjoint,
                elapsedMaxMs: sorted.at(-1) ?? null,
                elapsedP95Ms:
                    sorted[
                        Math.min(
                            sorted.length - 1,
                            Math.floor(sorted.length * 0.95),
                        )
                    ] ?? null,
                elapsedTotalMs: sorted.length > 0 ? totalMs : null,
                reason: gpuTimer.reason,
                sampleCount: sorted.length,
                supported: gpuTimer.supported === true,
            };
        },
    };
    const trackRafTick = () => {
        rafTick += 1;
        pollGpuQueries();
        requestAnimationFrame(trackRafTick);
    };
    requestAnimationFrame(trackRafTick);

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
            const metrics = globalThis.__gameProfileMetrics;
            beginGpuFrame(this);
            if (metrics.lastRenderedRafTick !== rafTick) {
                metrics.lastRenderedRafTick = rafTick;
                metrics.renderedFrames += 1;
            }
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

function beginInteractiveProfileSample() {
    const metrics = globalThis.__gameProfileMetrics;
    if (metrics) {
        metrics.drawCalls = 0;
        metrics.instancedDrawCalls = 0;
        metrics.lastRenderedRafTick = -1;
        metrics.renderedFrames = 0;
        metrics.submittedTriangles = 0;
    }
    globalThis.__gameProfileLongTasks = [];
    globalThis.__gameProfileGpuTimer?.reset();

    const startedAt = performance.now();
    const sample = {
        intervals: [],
        lastFrameAt: startedAt,
        running: true,
        startedAt,
    };
    globalThis.__gameProfileInteractiveSample = sample;
    const step = (timestamp) => {
        if (!sample.running) {
            return;
        }
        sample.intervals.push(timestamp - sample.lastFrameAt);
        sample.lastFrameAt = timestamp;
        requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

async function finishInteractiveProfileSample() {
    const sample = globalThis.__gameProfileInteractiveSample;
    if (!sample) {
        throw new Error('No interactive game profile sample is active.');
    }
    sample.running = false;
    await globalThis.__gameProfileGpuTimer?.finish();

    const canvas = document.querySelector('canvas');
    const metrics = globalThis.__gameProfileMetrics;
    const frameIntervals = sample.intervals.slice(1);
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
    const renderedFrames = metrics?.renderedFrames ?? 0;
    const submittedTriangles = Math.round(metrics?.submittedTriangles ?? 0);
    const frames = frameIntervals.length;
    const elapsedSeconds = (performance.now() - sample.startedAt) / 1000;
    const safeElapsedSeconds = Math.max(Number.EPSILON, elapsedSeconds);

    globalThis.__gameProfileInteractiveSample = null;
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
        drawCallsPerRenderedFrame:
            renderedFrames > 0 ? drawCalls / renderedFrames : 0,
        drawCallsPerSecond: drawCalls / safeElapsedSeconds,
        elapsedMs: elapsedSeconds * 1000,
        fps: frames / safeElapsedSeconds,
        frames,
        gpu: globalThis.__gameProfileGpuTimer?.snapshot() ?? {
            disjoint: false,
            elapsedMaxMs: null,
            elapsedP95Ms: null,
            elapsedTotalMs: null,
            reason: 'GPU timer instrumentation was not installed',
            sampleCount: 0,
            supported: false,
        },
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
        renderedFps: renderedFrames / safeElapsedSeconds,
        renderedFrames,
        submittedTriangles,
        trianglesPerFrame: submittedTriangles / Math.max(1, frames),
        trianglesPerRenderedFrame:
            renderedFrames > 0 ? submittedTriangles / renderedFrames : 0,
        trianglesPerSecond: submittedTriangles / safeElapsedSeconds,
    };
}

async function wait(milliseconds) {
    await new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function runScenarioMotion(page, scenario, sampleMs) {
    if (scenario.motion !== 'pan-zoom-rotate') {
        await wait(sampleMs);
        return;
    }

    const canvasBox = await page.locator('canvas').first().boundingBox();
    if (!canvasBox) {
        await wait(sampleMs);
        return;
    }

    const centerX = canvasBox.x + canvasBox.width * 0.52;
    const centerY = canvasBox.y + canvasBox.height * 0.52;
    const startedAt = Date.now();
    let direction = 1;

    while (Date.now() - startedAt < sampleMs - 120) {
        await page.mouse.move(centerX, centerY);
        await page.mouse.down();
        await page.mouse.move(
            centerX + 180 * direction,
            centerY + 80 * direction,
            { steps: 14 },
        );
        await page.mouse.up();
        await page.mouse.wheel(0, direction > 0 ? -420 : 360);
        await page.keyboard.press(direction > 0 ? 'KeyQ' : 'KeyW');
        direction *= -1;
        await wait(120);
    }

    const remainingMs = sampleMs - (Date.now() - startedAt);
    if (remainingMs > 0) {
        await wait(remainingMs);
    }
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
            GREDICE_GARDEN_START_PORT: port,
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

function metricsByName(payload) {
    return Object.fromEntries(
        payload.metrics.map((metric) => [metric.name, metric.value]),
    );
}

function diffCdpMetrics(before, after) {
    return {
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
    };
}

async function readGameProfileRuntime(page) {
    return page.evaluate(() => {
        const metadata = globalThis.__grediceGameProfile;
        return metadata && typeof metadata === 'object' ? metadata : null;
    });
}

async function dispatchCloseupCommand(page, detail) {
    await page.evaluate(
        ({ command, eventName }) => {
            globalThis.dispatchEvent(
                new CustomEvent(eventName, { detail: command }),
            );
        },
        {
            command: detail,
            eventName: gameProfileCloseupCommandEventName,
        },
    );
}

async function captureProfileScreenshot(page, outputPath) {
    await mkdir(dirname(outputPath), { recursive: true });
    await page.screenshot({
        path: outputPath,
        animations: 'disabled',
        fullPage: false,
    });
    return outputPath;
}

async function waitForProfileSession(page, raisedBedId, timeoutMs) {
    await page.waitForFunction(
        (expectedRaisedBedId) => {
            const profile =
                globalThis.__grediceGameProfile?.generatedPlantProfile;
            return Boolean(
                profile?.active &&
                    profile.selectedRaisedBedId === expectedRaisedBedId,
            );
        },
        raisedBedId,
        { timeout: timeoutMs },
    );
}

async function waitForPendingOrDetailed(page, timeoutMs) {
    await page.waitForFunction(
        () => {
            const profile =
                globalThis.__grediceGameProfile?.generatedPlantProfile;
            return Boolean(
                profile?.error ||
                    (profile?.selected.pendingNearFields ?? 0) > 0 ||
                    typeof profile?.milestonesMs.fullyDetailed === 'number',
            );
        },
        undefined,
        { timeout: timeoutMs },
    );
}

async function waitForDetailedAndSettled(page, timeoutMs) {
    await page.waitForFunction(
        () => {
            const profile =
                globalThis.__grediceGameProfile?.generatedPlantProfile;
            return Boolean(
                profile?.error ||
                    (profile?.camera.settled &&
                        profile.milestonesMs.fullyDetailed !== null),
            );
        },
        undefined,
        { timeout: timeoutMs },
    );
}

async function waitForNormalCamera(page, timeoutMs) {
    await page.waitForFunction(
        () => {
            const profile =
                globalThis.__grediceGameProfile?.generatedPlantProfile;
            return Boolean(
                profile &&
                    profile.camera.view === 'normal' &&
                    !profile.camera.active,
            );
        },
        undefined,
        { timeout: timeoutMs },
    );
}

async function runPlantCloseupPass({
    cdp,
    options,
    page,
    phase,
    raisedBedId,
    screenshotDirectory,
    scenarioName,
}) {
    const transitionCdpBefore = metricsByName(
        await cdp.send('Performance.getMetrics'),
    );
    await page.evaluate(beginInteractiveProfileSample);
    await dispatchCloseupCommand(page, {
        action: 'open',
        raisedBedId,
    });
    await waitForProfileSession(page, raisedBedId, options.closeupTimeoutMs);

    let pendingScreenshotPath = null;
    let timedOut = false;
    try {
        await waitForPendingOrDetailed(page, options.closeupTimeoutMs);
        const pending = await page.evaluate(
            () =>
                (globalThis.__grediceGameProfile?.generatedPlantProfile
                    ?.selected.pendingNearFields ?? 0) > 0,
        );
        if (pending && phase === 'cold') {
            pendingScreenshotPath = await captureProfileScreenshot(
                page,
                resolve(
                    screenshotDirectory,
                    `${scenarioName}-${phase}-pending-near.png`,
                ),
            );
        }
        await waitForDetailedAndSettled(page, options.closeupTimeoutMs);
    } catch {
        timedOut = true;
    }

    const transition = roundSample(
        await page.evaluate(finishInteractiveProfileSample),
    );
    const transitionCdpAfter = metricsByName(
        await cdp.send('Performance.getMetrics'),
    );
    const transitionProfile = (await readGameProfileRuntime(page))
        ?.generatedPlantProfile;
    const ready =
        !transitionProfile?.error &&
        transitionProfile?.camera.settled === true &&
        transitionProfile?.milestonesMs.fullyDetailed !== null;
    let detailedScreenshotPath = null;
    if (ready) {
        detailedScreenshotPath = await captureProfileScreenshot(
            page,
            resolve(
                screenshotDirectory,
                `${scenarioName}-${phase}-detailed.png`,
            ),
        );
    }

    if (options.soakMs > 0) {
        await wait(options.soakMs);
    }
    const steadyCdpBefore = metricsByName(
        await cdp.send('Performance.getMetrics'),
    );
    await page.evaluate(beginInteractiveProfileSample);
    await wait(options.sampleMs);
    const steady = roundSample(
        await page.evaluate(finishInteractiveProfileSample),
    );
    const steadyCdpAfter = metricsByName(
        await cdp.send('Performance.getMetrics'),
    );

    return {
        detailOutcome: transitionProfile?.error
            ? 'error'
            : ready
              ? 'ready'
              : timedOut
                ? 'timed-out'
                : 'incomplete',
        profile: transitionProfile ?? null,
        screenshots: {
            detailed: detailedScreenshotPath,
            pendingNear: pendingScreenshotPath,
        },
        steady: {
            cdp: diffCdpMetrics(steadyCdpBefore, steadyCdpAfter),
            sample: steady,
        },
        transition: {
            cdp: diffCdpMetrics(transitionCdpBefore, transitionCdpAfter),
            sample: transition,
        },
    };
}

async function measurePlantCloseup({ cdp, options, page, scenario }) {
    const screenshotDirectory = resolve(
        options.outDir,
        'screenshots',
        scenario.name,
    );
    const normalScreenshotPath = await captureProfileScreenshot(
        page,
        resolve(screenshotDirectory, `${scenario.name}-normal.png`),
    );
    const common = {
        cdp,
        options,
        page,
        raisedBedId: scenario.plantCloseup.raisedBedId,
        screenshotDirectory,
        scenarioName: scenario.name,
    };
    const cold = await runPlantCloseupPass({
        ...common,
        phase: 'cold',
    });

    await dispatchCloseupCommand(page, { action: 'close' });
    await waitForNormalCamera(page, options.closeupTimeoutMs);
    await wait(250);

    const warm = await runPlantCloseupPass({
        ...common,
        phase: 'warm',
    });
    const runtime = await readGameProfileRuntime(page);
    await dispatchCloseupCommand(page, { action: 'close' });

    return {
        cold,
        normalScreenshotPath,
        runtime,
        warm,
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
    if (scenario.navigatorMetrics) {
        await page.addInitScript(
            installNavigatorMetrics,
            scenario.navigatorMetrics,
        );
    }
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
    if (options.soakMs > 0) {
        await wait(options.soakMs);
    }
    const request = getScenarioRequest(scenario.path);
    const profileMetadata = await page.evaluate(() => {
        const element = document.querySelector('[data-game-profile-mode]');
        if (!(element instanceof HTMLElement)) {
            return null;
        }
        const deviceMemory = Reflect.get(window.navigator, 'deviceMemory');

        return {
            autoQualityMetrics: {
                coarsePointer:
                    typeof window.matchMedia === 'function' &&
                    window.matchMedia('(pointer: coarse)').matches,
                coreCount: window.navigator.hardwareConcurrency,
                dpr: window.devicePixelRatio,
                memoryGb:
                    typeof deviceMemory === 'number' ? deviceMemory : null,
                narrowViewport: window.innerWidth <= 640,
            },
            controls: element.dataset.gameProfileControls ?? null,
            closeupRaisedBedId:
                Number.parseInt(
                    element.dataset.gameProfileCloseupRaisedBedId ?? '',
                    10,
                ) || null,
            details: element.dataset.gameProfileDetails ?? null,
            debugHud: element.dataset.gameProfileDebugHud ?? null,
            gardenProfile: element.dataset.gameProfileGardenProfile ?? null,
            hud: element.dataset.gameProfileHud ?? null,
            mode: element.dataset.gameProfileMode ?? null,
            quality: element.dataset.gameProfileQuality ?? null,
        };
    });
    if (scenario.plantCloseup) {
        const closeup = await measurePlantCloseup({
            cdp,
            options,
            page,
            scenario,
        });
        const sample = closeup.cold.steady.sample;
        const request = getScenarioRequest(scenario.path);
        await context.close();

        return {
            budget: evaluateBudget(sample, budgets[scenario.budget]),
            closeup: {
                cold: closeup.cold,
                normalScreenshotPath: closeup.normalScreenshotPath,
                raisedBedId: scenario.plantCloseup.raisedBedId,
                warm: closeup.warm,
            },
            consoleMessages: consoleMessages.slice(0, 8),
            cdp: closeup.cold.transition.cdp,
            domContentLoadedMs,
            canvasReadyMs,
            pageErrors,
            path: scenario.path,
            requested: {
                autoQualityDeviceClass:
                    scenario.autoQualityDeviceClass ?? 'unspecified',
                autoQualityMetrics: profileMetadata?.autoQualityMetrics ?? null,
                closeupRaisedBedId:
                    profileMetadata?.closeupRaisedBedId ??
                    request.closeupRaisedBedId,
                controls: profileMetadata?.controls ?? request.controls,
                details: profileMetadata?.details ?? request.details,
                debugHud: profileMetadata?.debugHud ?? request.debugHud,
                dpr: scenario.dpr,
                gardenProfile:
                    profileMetadata?.gardenProfile ?? request.gardenProfile,
                hud: profileMetadata?.hud ?? request.hud,
                isMobile: scenario.isMobile,
                mode: profileMetadata?.mode ?? request.mode,
                motion: 'raised-bed-closeup',
                quality: profileMetadata?.quality ?? request.quality,
                viewport: scenario.viewport,
                weatherTransition: 'none',
            },
            runtime: closeup.runtime,
            sample,
            screenshotPath:
                closeup.cold.screenshots.detailed ??
                closeup.normalScreenshotPath,
            url,
            name: scenario.name,
        };
    }

    const beforeMetrics = await cdp.send('Performance.getMetrics');
    const before = Object.fromEntries(
        beforeMetrics.metrics.map((metric) => [metric.name, metric.value]),
    );

    const weatherTransitionRequest = scenario.weatherTransition ?? null;
    const samplePromise = page.evaluate(
        async (sampleOptions) => {
            const {
                sampleMs,
                weatherTransitionEventName,
                weatherTransitionRequest,
            } = sampleOptions;
            const canvas = document.querySelector('canvas');
            const metrics = globalThis.__gameProfileMetrics;
            if (metrics) {
                metrics.drawCalls = 0;
                metrics.instancedDrawCalls = 0;
                metrics.lastRenderedRafTick = -1;
                metrics.renderedFrames = 0;
                metrics.submittedTriangles = 0;
            }
            globalThis.__gameProfileLongTasks = [];

            const intervals = [];
            const start = performance.now();
            let last = start;
            const rainParticleCountAtStart =
                typeof globalThis.__grediceGameProfile?.rainParticleCount ===
                'number'
                    ? globalThis.__grediceGameProfile.rainParticleCount
                    : null;
            const rainMountedAtStart = (rainParticleCountAtStart ?? 0) > 0;
            let rainUnmountMs = null;
            const weatherTransitionDispatched = weatherTransitionRequest
                ? globalThis.dispatchEvent(
                      new CustomEvent(weatherTransitionEventName, {
                          detail: { request: weatherTransitionRequest },
                      }),
                  )
                : false;

            await new Promise((resolveSample) => {
                const step = (now) => {
                    intervals.push(now - last);
                    last = now;
                    const rainParticleCount =
                        globalThis.__grediceGameProfile?.rainParticleCount;
                    if (
                        rainMountedAtStart &&
                        rainUnmountMs === null &&
                        rainParticleCount === 0
                    ) {
                        rainUnmountMs = now - start;
                    }
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
            const renderedFrames = metrics?.renderedFrames ?? 0;
            const submittedTriangles = Math.round(
                metrics?.submittedTriangles ?? 0,
            );
            const frames = frameIntervals.length;
            const elapsedSeconds = (performance.now() - start) / 1000;
            const safeElapsedSeconds = Math.max(Number.EPSILON, elapsedSeconds);

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
                drawCallsPerRenderedFrame:
                    renderedFrames > 0 ? drawCalls / renderedFrames : 0,
                drawCallsPerSecond: drawCalls / safeElapsedSeconds,
                fps: frames / elapsedSeconds,
                frames,
                instancedDrawCalls: metrics?.instancedDrawCalls ?? 0,
                jsHeapMb: performance.memory
                    ? performance.memory.usedJSHeapSize / 1024 / 1024
                    : null,
                longTaskCount: longTasks.length,
                longTaskMaxMs: Math.max(0, ...longTasks),
                longTaskTotalMs: longTasks.reduce(
                    (sum, value) => sum + value,
                    0,
                ),
                maxFrameMs: sortedIntervals.at(-1) ?? 0,
                p50FrameMs: percentile(0.5),
                p95FrameMs: percentile(0.95),
                p99FrameMs: percentile(0.99),
                rainMountedAtStart,
                rainParticleCountAtEnd:
                    typeof globalThis.__grediceGameProfile
                        ?.rainParticleCount === 'number'
                        ? globalThis.__grediceGameProfile.rainParticleCount
                        : null,
                rainParticleCountAtStart,
                rainUnmountMs,
                reportedDpr: globalThis.devicePixelRatio,
                renderedFps: renderedFrames / elapsedSeconds,
                renderedFrames,
                submittedTriangles,
                trianglesPerFrame: submittedTriangles / Math.max(1, frames),
                trianglesPerRenderedFrame:
                    renderedFrames > 0
                        ? submittedTriangles / renderedFrames
                        : 0,
                trianglesPerSecond: submittedTriangles / safeElapsedSeconds,
                weatherTransitionDispatched,
                weatherTransitionRequest,
            };
        },
        {
            sampleMs: options.sampleMs,
            weatherTransitionEventName: gameProfileWeatherTransitionEventName,
            weatherTransitionRequest,
        },
    );
    if (scenario.motion) {
        await runScenarioMotion(page, scenario, options.sampleMs);
    }
    const sample = await samplePromise;

    const runtime = await page.evaluate(() => {
        const metadata = globalThis.__grediceGameProfile;
        if (!metadata || typeof metadata !== 'object') {
            return null;
        }

        return {
            cloudProjectedShadowCount:
                typeof metadata.cloudProjectedShadowCount === 'number'
                    ? metadata.cloudProjectedShadowCount
                    : null,
            cloudRealShadowCasterCount:
                typeof metadata.cloudRealShadowCasterCount === 'number'
                    ? metadata.cloudRealShadowCasterCount
                    : null,
            cloudVisualCount:
                typeof metadata.cloudVisualCount === 'number'
                    ? metadata.cloudVisualCount
                    : null,
            dprCap:
                typeof metadata.dprCap === 'number' ? metadata.dprCap : null,
            groundDecorationAtlasEstimatedGpuBytes:
                typeof metadata.groundDecorationAtlasEstimatedGpuBytes ===
                'number'
                    ? metadata.groundDecorationAtlasEstimatedGpuBytes
                    : null,
            groundDecorationAtlasPageCount:
                typeof metadata.groundDecorationAtlasPageCount === 'number'
                    ? metadata.groundDecorationAtlasPageCount
                    : null,
            groundDecorationChunkCount:
                typeof metadata.groundDecorationChunkCount === 'number'
                    ? metadata.groundDecorationChunkCount
                    : null,
            groundDecorationCount:
                typeof metadata.groundDecorationCount === 'number'
                    ? metadata.groundDecorationCount
                    : null,
            groundDecorationDensity:
                typeof metadata.groundDecorationDensity === 'number'
                    ? metadata.groundDecorationDensity
                    : null,
            groundDecorationVisibleCount:
                typeof metadata.groundDecorationVisibleCount === 'number'
                    ? metadata.groundDecorationVisibleCount
                    : null,
            generatedLSystemCacheEntryCount:
                typeof metadata.generatedLSystemCacheEntryCount === 'number'
                    ? metadata.generatedLSystemCacheEntryCount
                    : null,
            generatedLSystemCacheEstimatedBytes:
                typeof metadata.generatedLSystemCacheEstimatedBytes === 'number'
                    ? metadata.generatedLSystemCacheEstimatedBytes
                    : null,
            generatedLSystemCacheEvictionCount:
                typeof metadata.generatedLSystemCacheEvictionCount === 'number'
                    ? metadata.generatedLSystemCacheEvictionCount
                    : null,
            generatedLSystemCacheHitCount:
                typeof metadata.generatedLSystemCacheHitCount === 'number'
                    ? metadata.generatedLSystemCacheHitCount
                    : null,
            generatedLSystemCacheMaxEntryCount:
                typeof metadata.generatedLSystemCacheMaxEntryCount === 'number'
                    ? metadata.generatedLSystemCacheMaxEntryCount
                    : null,
            generatedLSystemCacheMaxEstimatedBytes:
                typeof metadata.generatedLSystemCacheMaxEstimatedBytes ===
                'number'
                    ? metadata.generatedLSystemCacheMaxEstimatedBytes
                    : null,
            generatedLSystemCacheMissCount:
                typeof metadata.generatedLSystemCacheMissCount === 'number'
                    ? metadata.generatedLSystemCacheMissCount
                    : null,
            generatedLSystemCacheOversizeSkipCount:
                typeof metadata.generatedLSystemCacheOversizeSkipCount ===
                'number'
                    ? metadata.generatedLSystemCacheOversizeSkipCount
                    : null,
            generatedLSystemCachePeakEstimatedBytes:
                typeof metadata.generatedLSystemCachePeakEstimatedBytes ===
                'number'
                    ? metadata.generatedLSystemCachePeakEstimatedBytes
                    : null,
            generatedLSystemCacheWriteCount:
                typeof metadata.generatedLSystemCacheWriteCount === 'number'
                    ? metadata.generatedLSystemCacheWriteCount
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
            rainWetOverlayDistinctUniformCount:
                typeof metadata.rainWetOverlayDistinctUniformCount === 'number'
                    ? metadata.rainWetOverlayDistinctUniformCount
                    : null,
            rainWetOverlayMaterialConsumerCount:
                typeof metadata.rainWetOverlayMaterialConsumerCount === 'number'
                    ? metadata.rainWetOverlayMaterialConsumerCount
                    : null,
            raisedBedMulchOverlayCount:
                typeof metadata.raisedBedMulchOverlayCount === 'number'
                    ? metadata.raisedBedMulchOverlayCount
                    : null,
            shadowMapAutoUpdate:
                typeof metadata.shadowMapAutoUpdate === 'boolean'
                    ? metadata.shadowMapAutoUpdate
                    : null,
            shadowMapInvalidationCount:
                typeof metadata.shadowMapInvalidationCount === 'number'
                    ? metadata.shadowMapInvalidationCount
                    : null,
            shadowMapSize:
                typeof metadata.shadowMapSize === 'number'
                    ? metadata.shadowMapSize
                    : null,
            shadowsEnabled:
                typeof metadata.shadowsEnabled === 'boolean'
                    ? metadata.shadowsEnabled
                    : null,
            snowOverlayDistinctUniformCount:
                typeof metadata.snowOverlayDistinctUniformCount === 'number'
                    ? metadata.snowOverlayDistinctUniformCount
                    : null,
            snowOverlayMaterialConsumerCount:
                typeof metadata.snowOverlayMaterialConsumerCount === 'number'
                    ? metadata.snowOverlayMaterialConsumerCount
                    : null,
            snowOverlayMinCoverage:
                typeof metadata.snowOverlayMinCoverage === 'number'
                    ? metadata.snowOverlayMinCoverage
                    : null,
            snowParticleCapacity:
                typeof metadata.snowParticleCapacity === 'number'
                    ? metadata.snowParticleCapacity
                    : null,
            snowParticleCount:
                typeof metadata.snowParticleCount === 'number'
                    ? metadata.snowParticleCount
                    : null,
            snowParticleGeometryBuildCount:
                typeof metadata.snowParticleGeometryBuildCount === 'number'
                    ? metadata.snowParticleGeometryBuildCount
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
    const screenshotPath = options.screenshots
        ? resolve(options.outDir, 'screenshots', `${scenario.name}.png`)
        : null;
    if (screenshotPath) {
        await mkdir(dirname(screenshotPath), { recursive: true });
        await page.screenshot({
            path: screenshotPath,
            animations: 'disabled',
            fullPage: false,
        });
    }

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
            autoQualityDeviceClass:
                scenario.autoQualityDeviceClass ?? 'unspecified',
            autoQualityMetrics: profileMetadata?.autoQualityMetrics ?? null,
            controls: profileMetadata?.controls ?? request.controls,
            details: profileMetadata?.details ?? request.details,
            debugHud: profileMetadata?.debugHud ?? request.debugHud,
            dpr: scenario.dpr,
            gardenProfile:
                profileMetadata?.gardenProfile ?? request.gardenProfile,
            hud: profileMetadata?.hud ?? request.hud,
            isMobile: scenario.isMobile,
            mode: profileMetadata?.mode ?? request.mode,
            motion: scenario.motion ?? 'none',
            quality: profileMetadata?.quality ?? request.quality,
            viewport: scenario.viewport,
            weatherTransition: weatherTransitionRequest ?? 'none',
        },
        runtime,
        sample: roundedSample,
        screenshotPath,
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
        drawCallsPerRenderedFrame: round(sample.drawCallsPerRenderedFrame, 1),
        drawCallsPerSecond: round(sample.drawCallsPerSecond, 1),
        elapsedMs: round(sample.elapsedMs),
        fps: round(sample.fps, 1),
        gpu: sample.gpu
            ? {
                  ...sample.gpu,
                  elapsedMaxMs: round(sample.gpu.elapsedMaxMs),
                  elapsedP95Ms: round(sample.gpu.elapsedP95Ms),
                  elapsedTotalMs: round(sample.gpu.elapsedTotalMs),
              }
            : undefined,
        jsHeapMb: round(sample.jsHeapMb, 1),
        longTaskMaxMs: round(sample.longTaskMaxMs, 1),
        longTaskTotalMs: round(sample.longTaskTotalMs, 1),
        maxFrameMs: round(sample.maxFrameMs),
        p50FrameMs: round(sample.p50FrameMs),
        p95FrameMs: round(sample.p95FrameMs),
        p99FrameMs: round(sample.p99FrameMs),
        rainUnmountMs: round(sample.rainUnmountMs),
        renderedFps: round(sample.renderedFps, 1),
        trianglesPerFrame: Math.round(sample.trianglesPerFrame),
        trianglesPerRenderedFrame: Math.round(sample.trianglesPerRenderedFrame),
        trianglesPerSecond: Math.round(sample.trianglesPerSecond),
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

function median(values) {
    const finiteValues = values
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);
    if (finiteValues.length === 0) {
        return null;
    }
    const middle = Math.floor(finiteValues.length / 2);
    return finiteValues.length % 2 === 0
        ? (finiteValues[middle - 1] + finiteValues[middle]) / 2
        : finiteValues[middle];
}

function buildPlantCloseupMedians(scenarios) {
    const groups = Map.groupBy(
        scenarios.filter((scenario) => scenario.closeup),
        (scenario) => scenario.baseName ?? scenario.name,
    );

    return Object.fromEntries(
        Array.from(groups, ([name, runs]) => [
            name,
            {
                runCount: runs.length,
                cold: {
                    detailReadyMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.cold.profile?.milestonesMs
                                        .fullyDetailed,
                            ),
                        ),
                    ),
                    longTaskTotalMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.cold.transition.sample
                                        .longTaskTotalMs,
                            ),
                        ),
                    ),
                    maxFrameMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.cold.transition.sample
                                        .maxFrameMs,
                            ),
                        ),
                    ),
                    p95FrameMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.cold.transition.sample
                                        .p95FrameMs,
                            ),
                        ),
                    ),
                },
                warm: {
                    detailReadyMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.warm.profile?.milestonesMs
                                        .fullyDetailed,
                            ),
                        ),
                    ),
                    longTaskTotalMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.warm.transition.sample
                                        .longTaskTotalMs,
                            ),
                        ),
                    ),
                    maxFrameMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.warm.transition.sample
                                        .maxFrameMs,
                            ),
                        ),
                    ),
                    p95FrameMs: round(
                        median(
                            runs.map(
                                (run) =>
                                    run.closeup.warm.transition.sample
                                        .p95FrameMs,
                            ),
                        ),
                    ),
                },
            },
        ]),
    );
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
        `Scenario set: ${report.options.scenarioSet}`,
        `Scenario filter: ${report.options.scenarios.length ? report.options.scenarios.join(', ') : 'none'}`,
        `Warmup: ${report.options.warmupMs} ms`,
        `Soak: ${report.options.soakMs} ms`,
        `Sample: ${report.options.sampleMs} ms`,
        '',
        `Budget status: ${report.summary.failedScenarios === 0 ? 'pass' : 'fail'}`,
        '',
        '| Scenario | Mode | Profile | Details | Controls | HUD | Debug HUD | Motion | Quality | Canvas | Shadow | Rain/Snow | Rain off | Overlays/Decor | Browser FPS | Rendered FPS | p95 | Max | Draw/frame | Triangles/frame | Long tasks | Heap | Budget | Screenshot |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
    ];

    for (const scenario of report.scenarios) {
        const canvas = scenario.sample.canvas
            ? `${scenario.sample.canvas.width}x${scenario.sample.canvas.height}`
            : 'n/a';
        const quality = scenario.runtime?.qualityTier ?? 'n/a';
        const shadow = scenario.runtime
            ? scenario.runtime.shadowsEnabled
                ? `${scenario.runtime.shadowMapSize}px, ${scenario.runtime.shadowMapAutoUpdate === false ? 'cached' : 'auto'}, invalidations ${scenario.runtime.shadowMapInvalidationCount ?? 'n/a'}, cloud ${scenario.runtime.cloudProjectedShadowCount ?? 'n/a'} projected/${scenario.runtime.cloudRealShadowCasterCount ?? 'n/a'} real`
                : 'off'
            : 'n/a';
        const weather = scenario.runtime
            ? `${scenario.runtime.rainParticleCount ?? 0}/${scenario.runtime.snowParticleCount ?? 0}`
            : 'n/a';
        const rainUnmount =
            scenario.sample.rainUnmountMs === null
                ? 'n/a'
                : `${scenario.sample.rainUnmountMs} ms`;
        const detailCounts = scenario.runtime
            ? `${scenario.runtime.instancedSnowOverlayCount ?? 0}+${scenario.runtime.raisedBedMulchOverlayCount ?? 0}/${scenario.runtime.groundDecorationCount ?? 0} decor, visible ${scenario.runtime.groundDecorationVisibleCount ?? 'n/a'}, pages ${scenario.runtime.groundDecorationAtlasPageCount ?? 'n/a'}, chunks ${scenario.runtime.groundDecorationChunkCount ?? 'n/a'}, surface materials/uniforms snow ${scenario.runtime.snowOverlayMaterialConsumerCount ?? 'n/a'}/${scenario.runtime.snowOverlayDistinctUniformCount ?? 'n/a'}, rain ${scenario.runtime.rainWetOverlayMaterialConsumerCount ?? 'n/a'}/${scenario.runtime.rainWetOverlayDistinctUniformCount ?? 'n/a'}`
            : 'n/a';
        const screenshot = scenario.screenshotPath ?? 'n/a';
        lines.push(
            `| ${scenario.name} | ${scenario.requested.mode} | ${scenario.requested.gardenProfile} | ${scenario.requested.details} | ${scenario.requested.controls} | ${scenario.requested.hud} | ${scenario.requested.debugHud} | ${scenario.requested.motion} | ${quality} | ${canvas} | ${shadow} | ${weather} | ${rainUnmount} | ${detailCounts} | ${scenario.sample.fps} | ${scenario.sample.renderedFps} | ${scenario.sample.p95FrameMs} ms | ${scenario.sample.maxFrameMs} ms | ${scenario.sample.drawCallsPerFrame} | ${scenario.sample.trianglesPerFrame} | ${scenario.sample.longTaskCount} | ${scenario.sample.jsHeapMb ?? 'n/a'} MB | ${scenario.budget.pass ? 'pass' : 'fail'} | ${screenshot} |`,
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

    if (Object.keys(report.plantCloseupMedians).length > 0) {
        lines.push('', '## Raised-bed Close-up Medians', '');
        lines.push(
            '| Scenario | Runs | Phase | Detail ready | p95 | Max | Long-task total |',
            '| --- | ---: | --- | ---: | ---: | ---: | ---: |',
        );
        for (const [name, summary] of Object.entries(
            report.plantCloseupMedians,
        )) {
            for (const phase of ['cold', 'warm']) {
                const metrics = summary[phase];
                lines.push(
                    `| ${name} | ${summary.runCount} | ${phase} | ${metrics.detailReadyMs ?? 'n/a'} ms | ${metrics.p95FrameMs ?? 'n/a'} ms | ${metrics.maxFrameMs ?? 'n/a'} ms | ${metrics.longTaskTotalMs ?? 'n/a'} ms |`,
                );
            }
        }
    }

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

    const profileScenarios = resolveScenarios(
        options.scenarioSet,
        options.scenarios,
    );

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
        for (const scenario of profileScenarios) {
            const repeat = scenario.plantCloseup?.repeat ?? 1;
            for (let runIndex = 1; runIndex <= repeat; runIndex += 1) {
                const runScenario =
                    repeat === 1
                        ? scenario
                        : {
                              ...scenario,
                              name: `${scenario.name}-run-${runIndex}`,
                          };
                console.log(
                    `Profiling ${scenario.name}${repeat > 1 ? ` (${runIndex}/${repeat})` : ''}...`,
                );
                const result = await measureScenario(
                    browser,
                    options.baseUrl,
                    runScenario,
                    options,
                );
                result.baseName = scenario.name;
                result.profileRun = runIndex;
                scenarios.push(result);
            }
        }

        const failedScenarios = scenarios.filter(
            (scenario) => !scenario.budget.pass,
        );
        const report = {
            baseUrl: options.baseUrl,
            generatedAt: new Date().toISOString(),
            options: {
                build: options.build,
                closeupTimeoutMs: options.closeupTimeoutMs,
                managedServer: options.startServer,
                sampleMs: options.sampleMs,
                scenarios: options.scenarios,
                scenarioSet: options.scenarioSet,
                soakMs: options.soakMs,
                warmupMs: options.warmupMs,
            },
            scenarios,
            plantCloseupMedians: buildPlantCloseupMedians(scenarios),
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

export { getScenarioRequest, resolveScenarios };

const invokedModuleUrl = process.argv[1]
    ? pathToFileURL(resolve(process.argv[1])).href
    : null;
if (import.meta.url === invokedModuleUrl) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
