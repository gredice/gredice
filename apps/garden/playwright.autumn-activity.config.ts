import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';

export default defineConfig({
    ...config,
    testMatch: 'tests/autumn-activity.spec.tsx',
    workers: 1,
    retries: 0,
    reporter: 'list',
    use: { ...config.use, ctPort: 5490 },
    projects: config.projects?.filter((project) => project.name === 'chromium'),
    webServer: undefined,
});
