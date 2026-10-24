import { defineConfig } from '@playwright/test';
import config from './playwright.public-html.config';

export default defineConfig({
    ...config,
    testMatch: 'news-navigation.spec.ts',
    outputDir: './test-results/news-navigation',
});
