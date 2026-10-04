import { defineConfig } from '@playwright/test';

const baseURL =
    process.env.GREDICE_PUMPKIN_TRAIL_TEST_ORIGIN ?? 'http://127.0.0.1:5491';
export default defineConfig({
    testDir: '.',
    testMatch: 'tests/pumpkin-trail-route.spec.ts',
    workers: 1,
    retries: 0,
    timeout: 60000,
    reporter: 'list',
    use: {
        baseURL,
        viewport: { width: 390, height: 1000 },
        hasTouch: true,
        launchOptions: {
            args: [
                '--use-gl=angle',
                '--use-angle=swiftshader',
                '--enable-unsafe-swiftshader',
            ],
        },
    },
    webServer: {
        command: 'node tests/fixtures/pumpkin-trail-server.mjs',
        url: `${baseURL}/staza-bundeva`,
        env: { GREDICE_PUMPKIN_TRAIL_TEST_ORIGIN: baseURL },
        reuseExistingServer: false,
        timeout: 60000,
    },
});
