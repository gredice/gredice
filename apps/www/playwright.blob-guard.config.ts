import { defineConfig } from '@playwright/test';
import { blobGuardLaunchArgs } from '../../scripts/blob-test-fixtures.mjs';

export default defineConfig({
    testDir: './tests',
    testMatch: 'blob-network-guard.spec.ts',
    reporter: 'list',
    workers: 1,
    use: {
        launchOptions: { args: blobGuardLaunchArgs() },
    },
});
