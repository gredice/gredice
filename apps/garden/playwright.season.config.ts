import { defineConfig } from '@playwright/experimental-ct-react';
import { config } from './playwright.config';
export default defineConfig({
    ...config,
    testMatch: [
        'tests/squirrel-caching.spec.tsx',
        'tests/leaf-steps.spec.tsx',
        'tests/season-date-control.spec.tsx',
        'tests/autumn-season.spec.tsx',
        'tests/rain-ripples.spec.tsx',
        'tests/cold-weather.spec.tsx',
        'tests/autumn-audio.spec.tsx',
        'tests/weather-audio.spec.tsx',
        'tests/wind-audio.spec.tsx',
    ],
    projects: config.projects
        ?.filter((p) => p.name === 'chromium' || p.name === 'chromium-webgl')
        .map((project) => ({
            ...project,
            testMatch:
                project.name === 'chromium'
                    ? [
                          'tests/season-date-control.spec.tsx',
                          'tests/autumn-audio.spec.tsx',
                          'tests/weather-audio.spec.tsx',
                          'tests/wind-audio.spec.tsx',
                      ]
                    : [
                          'tests/squirrel-caching.spec.tsx',
                          'tests/leaf-steps.spec.tsx',
                          'tests/autumn-season.spec.tsx',
                          'tests/rain-ripples.spec.tsx',
                          'tests/cold-weather.spec.tsx',
                      ],
        })),
    webServer: undefined,
});
