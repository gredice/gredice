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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = getAppByName('garden');
const reporter: PlaywrightTestConfig['reporter'] = [
    ['list'],
    ['html', { open: 'never' }],
];

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
            testIgnore: /garden-preview-capture\.spec\.tsx/,
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'chromium-webgl',
            testMatch: /garden-preview-capture\.spec\.tsx/,
            use: {
                ...devices['Desktop Chrome'],
                launchOptions: {
                    // GPU-less CI runners must explicitly opt in to Chromium's
                    // software WebGL fallback. Keep the lower-security switch
                    // isolated to our trusted 3D capture fixture.
                    args: ['--enable-unsafe-swiftshader'],
                },
            },
        },
    ],
    webServer: {
        command: 'node ../../scripts/run-app-command.mjs start',
        env: { GREDICE_DETACH_CHILD_PROCESS: 'false' },
        gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
        url: getPlaywrightBaseUrl(app),
        reuseExistingServer: shouldReusePlaywrightServer(),
    },
};

export default defineConfig(config);
