import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';
export default defineConfig({
    ...config,
    testMatch: ['tests/autumn-photo-prompts.spec.tsx'],
    workers: 1,
    retries: 0,
    reporter: 'list',
    webServer: undefined,
    projects: config.projects
        ?.filter((project) => project.name === 'chromium-webgl')
        .map((project) => ({
            ...project,
            testMatch: ['tests/autumn-photo-prompts.spec.tsx'],
        })),
});
