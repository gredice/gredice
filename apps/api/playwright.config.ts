import { defineConfig, devices, PlaywrightTestConfig } from '@playwright/test';

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
        baseURL: 'http://127.0.0.1:3005',
        trace: 'on-first-retry'
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        }
    ],
    webServer: {
        command: 'pnpm dev',
        url: 'http://127.0.0.1:3005',
        reuseExistingServer: !process.env.CI,
    },
};

export default defineConfig(config);
