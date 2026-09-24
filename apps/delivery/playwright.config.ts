import { fileURLToPath } from 'node:url';
import {
    defineConfig,
    devices,
    type PlaywrightTestConfig,
} from '@playwright/experimental-ct-react';
import {
    getAppByName,
    getComponentTestPort,
} from '../../scripts/app-registry.ts';

const app = getAppByName('delivery');
const deliveryRoot = fileURLToPath(new URL('.', import.meta.url));
const zxingTestDouble = fileURLToPath(
    new URL('./playwright/mocks/zxing.ts', import.meta.url),
);
const reporter: PlaywrightTestConfig['reporter'] = [
    ['list'],
    ['html', { open: 'never' }],
];

export const config: PlaywrightTestConfig = {
    testDir: './tests',
    testIgnore: /e2e\//,
    snapshotDir: './__snapshots__',
    timeout: 10 * 1000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter,
    use: {
        trace: 'on-first-retry',
        ctPort: getComponentTestPort(app),
        ctViteConfig: {
            // Playwright CT 1.62 bundles Vite 8, whose CJS interop turns default imports
            // of Next's CJS entry points (e.g. next/image) into module objects.
            legacy: { inconsistentCjsInterop: true },
            css: {
                postcss: deliveryRoot,
            },
            resolve: {
                alias: {
                    '@zxing/library': zxingTestDouble,
                },
                dedupe: ['react', 'react-dom'],
            },
        },
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
};

export default defineConfig(config);
