import { defineConfig, devices, PlaywrightTestConfig } from '@playwright/experimental-ct-react';

export const config: PlaywrightTestConfig = {
    testDir: './',
    snapshotDir: './__snapshots__',
    timeout: 10 * 1000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://127.0.0.1:3002',
        trace: 'on-first-retry',
        ctPort: 3100,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        }
    ],
    webServer: {
        command: 'pnpm dev',
        url: 'http://127.0.0.1:3002',
        reuseExistingServer: !process.env.CI,
    },
};

export default defineConfig(config);
