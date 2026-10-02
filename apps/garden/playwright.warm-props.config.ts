import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';

export default defineConfig({
    ...config,
    testMatch: 'tests/warm-props.spec.tsx',
    timeout: 90_000,
    expect: { timeout: 30_000 },
    workers: 1,
    retries: 0,
    reporter: 'list',
    projects: config.projects
        ?.filter((project) => project.name === 'chromium-webgl')
        .map((project) => ({
            ...project,
            testMatch: 'tests/warm-props.spec.tsx',
            use: {
                ...project.use,
                viewport: { width: 760, height: 620 },
                deviceScaleFactor: 1,
            },
        })),
    webServer: undefined,
});
