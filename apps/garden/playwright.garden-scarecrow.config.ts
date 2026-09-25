import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';

export default defineConfig({
    ...config,
    testMatch: 'tests/garden-scarecrow.capture.tsx',
    timeout: 60_000,
    expect: { timeout: 20_000 },
    workers: 1,
    retries: 0,
    reporter: 'list',
    projects: [
        ...(config.projects
            ?.filter((project) => project.name === 'chromium-webgl')
            .map((project) => ({
                ...project,
                testMatch: 'tests/garden-scarecrow.capture.tsx',
                snapshotPathTemplate: fileURLToPath(
                    new URL(
                        '../../docs/garden-scarecrow-2026/{arg}{ext}',
                        import.meta.url,
                    ),
                ),
                use: {
                    ...project.use,
                    timezoneId: 'Europe/Zagreb',
                    viewport: { width: 720, height: 580 },
                    deviceScaleFactor: 1,
                },
            })) ?? []),
        ...(config.projects
            ?.filter((project) => project.name === 'chromium')
            .map((project) => ({
                ...project,
                testMatch: 'tests/items-hud.spec.tsx',
                grep: /scarecrow|Vrtno strašilo/,
            })) ?? []),
    ],
    webServer: undefined,
});
