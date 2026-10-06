import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';

export default defineConfig({
    ...config,
    testMatch: 'tests/autumn-prop-wind.spec.tsx',
    timeout: 120_000,
    expect: { timeout: 60_000 },
    workers: 1,
    retries: 0,
    reporter: 'list',
    projects: config.projects
        ?.filter((project) => project.name === 'chromium-webgl')
        .map((project) => ({
            ...project,
            testMatch: 'tests/autumn-prop-wind.spec.tsx',
            use: {
                ...project.use,
                timezoneId: 'Europe/Zagreb',
                viewport: { width: 720, height: 620 },
                deviceScaleFactor: 1,
            },
        })),
    webServer: undefined,
});
