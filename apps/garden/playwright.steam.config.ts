import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';

export default defineConfig({
    ...config,
    testMatch: 'tests/localized-steam.spec.tsx',
    timeout: 120_000,
    expect: { timeout: 60_000 },
    workers: 1,
    retries: 0,
    reporter: 'list',
    projects: config.projects
        ?.filter((project) => project.name === 'chromium-webgl')
        .map((project) => ({
            ...project,
            testMatch: 'tests/localized-steam.spec.tsx',
            use: {
                ...project.use,
                viewport: { width: 720, height: 580 },
                timezoneId: 'Europe/Zagreb',
                deviceScaleFactor: 1,
            },
        })),
    webServer: undefined,
});
