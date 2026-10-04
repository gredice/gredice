import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';
export default defineConfig({
    ...config,
    testMatch: [
        'tests/raised-bed-review-chat.spec.tsx',
        'tests/suncokret-chat-hud.spec.tsx',
    ],
    projects: config.projects?.filter((project) => project.name === 'chromium'),
    webServer: undefined,
    workers: 2,
});
