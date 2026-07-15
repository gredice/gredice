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
const reporter: PlaywrightTestConfig['reporter'] = [
    ['list'],
    ['html', { open: 'never' }],
];

export const config: PlaywrightTestConfig = {
    testDir: './tests',
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
            css: {
                postcss: deliveryRoot,
            },
            resolve: {
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
