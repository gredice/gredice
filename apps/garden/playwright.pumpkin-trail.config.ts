import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';
export default defineConfig({
    ...config,
    testMatch: 'tests/pumpkin-trail.spec.tsx',
    timeout: 120000,
    workers: 1,
    retries: 0,
    reporter: 'list',
    use: { ...config.use, ctPort: 5491 },
    projects: config.projects
        ?.filter((p) => p.name === 'chromium-webgl')
        .map((p) => ({
            ...p,
            testMatch: 'tests/pumpkin-trail.spec.tsx',
            use: {
                ...p.use,
                viewport: { width: 900, height: 1100 },
                deviceScaleFactor: 1,
                hasTouch: true,
            },
        })),
    webServer: undefined,
});
