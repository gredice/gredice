import { defineConfig, devices } from '@playwright/test';
import {
    getAppByName,
    getPlaywrightBaseUrl,
    shouldReusePlaywrightServer,
} from '../../scripts/app-registry.ts';

const baseURL = getPlaywrightBaseUrl(getAppByName('www'));

export default defineConfig({
    testDir: './tests',
    testMatch: 'public-html.spec.ts',
    outputDir: './test-results/public-html',
    reporter: 'list',
    workers: 2,
    use: { baseURL, trace: 'retain-on-failure' },
    projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
    webServer: {
        command: 'node ../../scripts/run-app-command.mjs start',
        env: { GREDICE_DETACH_CHILD_PROCESS: 'false' },
        gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
        url: baseURL,
        reuseExistingServer: shouldReusePlaywrightServer(),
    },
});
