import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';

export default defineConfig({
    ...config,
    testMatch: 'tests/garden-tea-table.capture.tsx',
    timeout: 120_000,
    // Software WebGL needs time for cold shader compilation; readiness still checks actual meshes.
    expect: { timeout: 60_000 },
    workers: 1,
    retries: 0,
    reporter: 'list',
    projects: [
        ...(config.projects
            ?.filter((project) => project.name === 'chromium-webgl')
            .map((project) => ({
                ...project,
                testMatch: 'tests/garden-tea-table.capture.tsx',
                snapshotPathTemplate: fileURLToPath(
                    new URL(
                        '../../docs/garden-tea-table-2026/{arg}{ext}',
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
                grep: /tea table|Vrtni stolić s čajem/,
            })) ?? []),
    ],
    webServer: undefined,
});
