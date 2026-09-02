import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    defineConfig,
    devices,
    type PlaywrightTestConfig,
} from '@playwright/experimental-ct-react';
import {
    getAppByName,
    getComponentTestPort,
    getPlaywrightBaseUrl,
    shouldReusePlaywrightServer,
} from '../../scripts/app-registry.ts';
import { gardenTestFlagsSecret } from './playwright/gardenFlagTestSupport';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = getAppByName('garden');
const reporter: PlaywrightTestConfig['reporter'] = [
    ['list'],
    ['html', { open: 'never' }],
];
const webglComponentTestPattern =
    /(actor-speech-bubble|cursor-anchored-zoom|detailed-inspection-farmer|garden-building-avatar-interiors|garden-building-pointer-profile|garden-building-vertical-slice|garden-preview-capture|garden-structure-kit-renderer|hover-outline|instanced-mesh-material-swap|precipitation-camera-follow|public-garden-switch|r3f-root-isolation|raised-bed-notification-bubble|solar-eclipse)\.spec\.tsx/;
const outletGardenRouteTestPattern = /outlet-garden-route\.spec\.ts/;

// Plugin to intercept next/font/google before Vite's resolver
function nextFontMockPlugin() {
    const mockPath = path.resolve(
        __dirname,
        'playwright/__mocks__/next-font-google.ts',
    );
    return {
        name: 'next-font-mock',
        enforce: 'pre' as const,
        async resolveId(source: string) {
            if (source === 'next/font/google') {
                return { id: mockPath, external: false };
            }
            return null;
        },
    };
}

export const config: PlaywrightTestConfig = {
    testDir: './',
    snapshotDir: './__snapshots__',
    timeout: 10 * 1000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter,
    use: {
        baseURL: getPlaywrightBaseUrl(app),
        trace: 'on-first-retry',
        ctPort: getComponentTestPort(app),
        ctViteConfig: {
            plugins: [nextFontMockPlugin()],
            optimizeDeps: {
                exclude: ['next/font/google'],
            },
            resolve: {
                dedupe: ['nuqs', 'react', 'react-dom'],
            },
        },
    },
    projects: [
        {
            name: 'chromium',
            testIgnore: [
                webglComponentTestPattern,
                outletGardenRouteTestPattern,
            ],
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'chromium-webgl',
            testMatch: webglComponentTestPattern,
            snapshotPathTemplate:
                '{snapshotDir}/{testFilePath}-snapshots/{arg}{ext}',
            use: {
                ...devices['Desktop Chrome'],
                launchOptions: {
                    // GPU-less CI runners must explicitly opt in to Chromium's
                    // software WebGL fallback. Keep the lower-security switch
                    // isolated to our trusted 3D capture fixture.
                    args: [
                        '--use-gl=angle',
                        '--use-angle=swiftshader',
                        '--enable-unsafe-swiftshader',
                    ],
                },
            },
        },
        {
            name: 'chromium-webgl-outlet',
            testMatch: outletGardenRouteTestPattern,
            timeout: 30_000,
            expect: { timeout: 30_000 },
            use: {
                ...devices['Desktop Chrome'],
                actionTimeout: 60_000,
                launchOptions: {
                    args: [
                        '--use-gl=angle',
                        '--use-angle=swiftshader',
                        '--enable-unsafe-swiftshader',
                    ],
                },
            },
        },
    ],
    webServer: {
        command: 'node ../../scripts/run-app-command.mjs start',
        env: {
            FLAGS_SECRET: process.env.FLAGS_SECRET ?? gardenTestFlagsSecret,
            GREDICE_DETACH_CHILD_PROCESS: 'false',
            GREDICE_GARDEN_BUILDING_PROFILE_FIXTURE_ENABLED: 'true',
            VERCEL_ENV: 'preview',
        },
        gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
        url: getPlaywrightBaseUrl(app),
        reuseExistingServer: shouldReusePlaywrightServer(),
    },
};

export default defineConfig(config);
