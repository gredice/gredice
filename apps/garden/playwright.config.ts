import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    defineConfig,
    devices,
    type PlaywrightTestConfig,
} from '@playwright/experimental-ct-react';
import {
    getAppByName,
    getComponentTestPort,
    getPlaywrightBaseUrl,
    shouldReusePlaywrightServer,
} from '../../scripts/app-registry.ts';
import { blobGuardLaunchArgs } from '../../scripts/blob-test-fixtures.mjs';
import { faunaPoseOraclePlugin } from './playwright/faunaPoseOraclePlugin.mjs';
import { gardenTestFlagsSecret } from './playwright/gardenFlagTestSupport';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = getAppByName('garden');
const reporter: PlaywrightTestConfig['reporter'] = [
    ['list'],
    ['html', { open: 'never' }],
];
const webglComponentTestPattern =
