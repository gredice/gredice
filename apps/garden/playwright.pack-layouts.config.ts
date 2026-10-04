import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';
export default defineConfig({
    ...config,
    workers: 1,
    retries: 0,
    reporter: 'list',
    webServer: undefined,
    use: { ...config.use, ctPort: 5487 },
    projects: config.projects
        ?.filter((project) => project.name === 'chromium-webgl')
        .map((project) => ({
            ...project,
            testMatch: ['tests/pack-layouts.spec.tsx'],
        })),
});
