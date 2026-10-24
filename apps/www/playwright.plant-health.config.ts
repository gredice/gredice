import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';

export default defineConfig({
    ...config,
    testMatch: ['plant-health-affected-plants.spec.tsx'],
    testIgnore: [],
    webServer: undefined,
});
