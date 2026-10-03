import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: '.',
    testMatch: 'tests/kestenijada-route.spec.ts',
    workers: 1,
    retries: 0,
    timeout: 60000,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:5486',
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
        url: 'http://localhost:5486/kestenijada',
        reuseExistingServer: false,
        timeout: 60000,
    },
});
