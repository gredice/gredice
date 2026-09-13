import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';

export default defineConfig({
    ...config,
    testMatch: ['tests/achievements.spec.tsx'],
    projects: config.projects?.filter((project) => project.name === 'chromium'),
    webServer: undefined,
});
