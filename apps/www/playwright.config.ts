import {
    defineConfig,
    devices,
    type PlaywrightTestConfig,
} from '@playwright/experimental-ct-react';
import {
    getAppByName,
    getComponentTestPort,
    localAppUrl,
} from '../../scripts/app-registry.ts';

const app = getAppByName('www');
const reporter: PlaywrightTestConfig['reporter'] = [
    ['list'],
    ['html', { open: 'never' }],
];

export const config: PlaywrightTestConfig = {
    testDir: './',
    snapshotDir: './__snapshots__',
    timeout: 10 * 1000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 4 : undefined,
    reporter,
    use: {
        baseURL: localAppUrl(app),
        trace: 'on-first-retry',
        ctPort: getComponentTestPort(app),
    },
    projects: [
        {
            name: 'chromium',
            testIgnore: /visual\.spec\.ts$/,
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'visual',
            testMatch: /visual\.spec\.ts$/,
            workers: 4,
            retries: 3,
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1280, height: 720 },
            },
        },
    ],
    webServer: {
        command: 'pnpm start',
        url: localAppUrl(app),
        reuseExistingServer: !process.env.CI,
    },
};

export default defineConfig(config);
