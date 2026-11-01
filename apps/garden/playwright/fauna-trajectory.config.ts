import { defineConfig, devices } from '@playwright/experimental-ct-react';
import { faunaPoseOraclePlugin } from './faunaPoseOraclePlugin.mjs';

// This witness also runs in the frozen legacy checkout. Keep its configuration
// independent of app/server helpers introduced after that runtime revision.
export default defineConfig({
    testDir: '../tests',
    testMatch: 'fauna-trajectory.spec.tsx',
    timeout: 120_000,
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        ctPort: 3145,
        ctTemplateDir: '.',
        ctViteConfig: {
            legacy: { inconsistentCjsInterop: true },
            plugins: [faunaPoseOraclePlugin()],
            resolve: { dedupe: ['next', 'nuqs', 'react', 'react-dom'] },
        },
    },
    projects: [
        {
            name: 'chromium-webgl',
            use: {
                ...devices['Desktop Chrome'],
                launchOptions: {
                    args: [
                        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
                        '--use-gl=angle',
                        '--use-angle=swiftshader',
                        '--enable-unsafe-swiftshader',
                    ],
                },
            },
        },
    ],
});
