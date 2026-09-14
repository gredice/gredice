import { defineConfig, devices } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';

export default defineConfig({
    ...config,
    fullyParallel: false,
    projects: [
        {
            name: 'chromium-generate-webgl',
            use: {
                ...devices['Desktop Chrome'],
                launchOptions: {
                    args: [
                        '--use-gl=angle',
                        '--use-angle=swiftshader',
                        '--enable-unsafe-swiftshader',
                    ],
                },
            },
        },
    ],
    testDir: '.',
    testMatch: 'generate/**/*.specgen.tsx',
    webServer: undefined,
    workers: 1,
});
