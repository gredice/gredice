import path from 'node:path';
import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';

// Opt-in documentation capture, outside the regression snapshot inventory.
export default defineConfig({
    ...config,
    testMatch: 'tests/autumn-art.capture.tsx',
    timeout: 120_000,
    expect: { timeout: 20_000 },
    workers: 1,
    retries: 0,
    reporter: 'list',
    projects: config.projects
        ?.filter((project) => project.name === 'chromium-webgl')
        .map((project) => ({
            ...project,
            testMatch: 'tests/autumn-art.capture.tsx',
            snapshotPathTemplate: path.resolve(
                '../../docs/autumn-art-direction-2026/{arg}{ext}',
            ),
            use: {
                ...project.use,
                timezoneId: 'Europe/Zagreb',
                viewport: { width: 1000, height: 760 },
                deviceScaleFactor: 1,
            },
        })),
    webServer: undefined,
});
