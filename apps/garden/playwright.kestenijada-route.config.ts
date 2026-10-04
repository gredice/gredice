import { defineConfig } from '@playwright/test';

const baseURL =
    process.env.GREDICE_KESTENIJADA_TEST_ORIGIN ?? 'http://127.0.0.1:5486';
export default defineConfig({
    testDir: '.',
    testMatch: 'tests/kestenijada-route.spec.ts',
    workers: 1,
    retries: 0,
    timeout: 60000,
    reporter: 'list',
    use: {
        baseURL,
        viewport: { width: 900, height: 1100 },
        launchOptions: {
            args: [
                '--use-gl=angle',
                '--use-angle=swiftshader',
                '--enable-unsafe-swiftshader',
            ],
        },
    },
    webServer: {
        command: 'node --import tsx tests/fixtures/kestenijada-server.mjs',
        url: `${baseURL}/kestenijada`,
        env: { GREDICE_KESTENIJADA_TEST_ORIGIN: baseURL },
        reuseExistingServer: false,
        timeout: 60000,
    },
});
