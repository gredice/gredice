import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    defineConfig,
    devices,
    type PlaywrightTestConfig,
} from '@playwright/experimental-ct-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Plugin to intercept next/font/google before Vite's resolver
function nextFontMockPlugin() {
    const mockPath = path.resolve(
        __dirname,
        'playwright/__mocks__/next-font-google.ts',
    );
    return {
        name: 'next-font-mock',
        enforce: 'pre' as const,
        async resolveId(source: string) {
            if (source === 'next/font/google') {
                return { id: mockPath, external: false };
            }
            return null;
        },
    };
}

export const config: PlaywrightTestConfig = {
    testDir: './',
    snapshotDir: './__snapshots__',
    timeout: 10 * 1000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://127.0.0.1:3001',
        trace: 'on-first-retry',
        ctPort: 3100,
        ctViteConfig: {
            plugins: [nextFontMockPlugin()],
            optimizeDeps: {
                exclude: ['next/font/google'],
            },
        },
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'pnpm start',
        url: 'http://127.0.0.1:3001',
        reuseExistingServer: !process.env.CI,
    },
};

export default defineConfig(config);
