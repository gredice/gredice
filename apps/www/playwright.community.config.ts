import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';
export default defineConfig({
    ...config,
    testMatch: [
        'plant-community-suggestions.spec.tsx',
        'plant-relationships.spec.tsx',
        'plant-tips.spec.tsx',
        'community-entity-suggestion-button.spec.tsx',
        'community-edit-button.spec.tsx',
        'existing-plant-health-suggestion.spec.tsx',
    ],
    testIgnore: [],
    webServer: undefined,
});
