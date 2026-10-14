import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';
export default defineConfig({
    ...config,
    testMatch: 'tests/kestenijada.spec.tsx',
    timeout: 120000,
    workers: 1,
    retries: 0,
    reporter: 'list',
    use: { ...config.use, ctPort: 5486 },
    projects: config.projects
        ?.filter((project) => project.name === 'chromium-webgl')
        .map((project) => ({
            ...project,
            testMatch: 'tests/kestenijada.spec.tsx',
            use: {
                ...project.use,
                viewport: { width: 900, height: 1100 },
                timezoneId: 'Europe/Zagreb',
                deviceScaleFactor: 1,
            },
        })),
    webServer: undefined,
});
