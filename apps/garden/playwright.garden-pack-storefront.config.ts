import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';
export default defineConfig({
    ...config,
    testMatch: [
        'tests/garden-pack-storefront.spec.tsx',
        'tests/autumn-starter-pack-review.spec.tsx',
    ],
    workers: 1,
    retries: 0,
    reporter: 'list',
    projects: config.projects?.filter((project) => project.name === 'chromium'),
    webServer: undefined,
});
