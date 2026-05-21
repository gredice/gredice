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
        baseURL: getPlaywrightBaseUrl(app),
        trace: 'on-first-retry',
        ctPort: getComponentTestPort(app),
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'pnpm start',
        url: getPlaywrightBaseUrl(app),
        reuseExistingServer: shouldReusePlaywrightServer(),
    },
};

export default defineConfig(config);
