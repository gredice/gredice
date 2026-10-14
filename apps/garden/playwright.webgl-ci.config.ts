import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';

// Keep component fixtures at the regular CI viewport and timezone for local validation.
export default defineConfig({
    ...config,
    workers: 1,
    retries: 0,
    projects: config.projects
        ?.filter((project) => project.name === 'chromium-webgl')
        .map((project) => ({
            ...project,
            use: { ...project.use, timezoneId: 'UTC' },
        })),
    webServer: undefined,
});
