import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';

export default defineConfig({
    ...config,
    testMatch: ['pricing-display.spec.tsx'],
    testIgnore: [],
    webServer: undefined,
});
