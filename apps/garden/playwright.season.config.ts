import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';
export default defineConfig({
    ...config,
    testMatch: ['tests/season-date-control.spec.tsx'],
    projects: config.projects?.filter((p) => p.name === 'chromium'),
    webServer: undefined,
});
