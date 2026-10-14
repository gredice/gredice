import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';

const matches = [
    'tests/garden-preview-capture.spec.tsx',
    'tests/autumn-photo-prompts.spec.tsx',
];
export default defineConfig({
    ...config,
    testMatch: matches,
    workers: 1,
    retries: 0,
    reporter: 'list',
    use: { ...config.use, ctPort: 5486 },
    projects: config.projects
        ?.filter((project) => project.name === 'chromium-webgl')
        .map((project) => ({ ...project, testMatch: matches })),
    webServer: undefined,
});
