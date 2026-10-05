import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';

// Opt-in documentation capture, outside the regression snapshot inventory.
export default defineConfig({
    ...config,
    testMatch: 'tests/autumn-arrangements.capture.tsx',
    timeout: 360_000,
    expect: { timeout: 60_000 },
    workers: 1,
    retries: 0,
    reporter: 'list',
    projects: config.projects
        ?.filter((project) => project.name === 'chromium-webgl')
        .map((project) => ({
            ...project,
            testMatch: 'tests/autumn-arrangements.capture.tsx',
            snapshotPathTemplate: fileURLToPath(
                new URL(
                    '../../docs/autumn-arrangements-2026/{arg}{ext}',
                    import.meta.url,
                ),
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
