import { defineConfig, devices } from '@playwright/test';
import {
    getAppByName,
    getPlaywrightBaseUrl,
    shouldReusePlaywrightServer,
} from '../../scripts/app-registry.ts';
import { deliveryQualityJwtSignSecret } from './tests/e2e/deliveryTestSession';

const app = getAppByName('delivery');

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30 * 1_000,
    expect: { timeout: 5 * 1_000 },
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report/e2e' }],
    ],
    outputDir: 'test-results/e2e',
    use: {
        baseURL: getPlaywrightBaseUrl(app),
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'node ../../scripts/run-app-command.mjs start',
        env: {
            COOKIE_DOMAIN: '',
            GREDICE_DETACH_CHILD_PROCESS: 'false',
            GREDICE_JWT_SIGN_SECRET: deliveryQualityJwtSignSecret,
            GREDICE_SECURE_AUTH_COOKIES: 'false',
        },
        gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
        url: getPlaywrightBaseUrl(app),
        reuseExistingServer: shouldReusePlaywrightServer(),
    },
});
