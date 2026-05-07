import {
    defineConfig,
    devices,
    type PlaywrightTestConfig,
} from '@playwright/test';
import { getAppByName, localAppUrl } from '../../scripts/app-registry.ts';

const app = getAppByName('api');
const reporter: PlaywrightTestConfig['reporter'] = [
    ['list'],
    ['html', { open: 'never' }],
];

export const config: PlaywrightTestConfig = {
    testDir: './tests',
    snapshotDir: './__snapshots__',
    timeout: 10 * 1000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter,
    use: {
        baseURL: localAppUrl(app),
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'pnpm start',
        url: localAppUrl(app),
        reuseExistingServer: !process.env.CI,
    },
};

export default defineConfig(config);
