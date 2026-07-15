#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(scriptDir, '..');
const sourceFiles = [
    'electron/main.cjs',
    'electron/oauth-redirect.cjs',
    'electron/preload.cjs',
    'scripts/check-desktop-sources.mjs',
    'scripts/desktop-apps.mjs',
    'scripts/package-desktop-app.mjs',
    'scripts/run-desktop-app.mjs',
    'tests/desktop-apps.test.mjs',
];

for (const sourceFile of sourceFiles) {
    const result = spawnSync(
        process.execPath,
        ['--check', resolve(desktopRoot, sourceFile)],
        {
            stdio: 'inherit',
        },
    );

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}
