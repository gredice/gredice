#!/usr/bin/env node

/**
 * Cross-platform script to generate game assets
 * - Exports one GLB per split Blender asset.
 * - Then generates runtime model metadata and TypeScript model types.
 */

import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { platform } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const assetsDir = join(__dirname, '..', 'assets');

const isWindows = platform() === 'win32';

console.log(
    `Generating game assets for ${isWindows ? 'Windows' : 'Unix-like system'}...\n`,
);

try {
    console.log('Step 1/2: Exporting split GLB files from Blender...');

    if (isWindows) {
        execSync('powershell.exe -ExecutionPolicy Bypass -File .\\export.ps1', {
            cwd: assetsDir,
            stdio: 'inherit',
        });
    } else {
        execSync('./export.sh', {
            cwd: assetsDir,
            stdio: 'inherit',
        });
    }

    console.log('GLB files exported successfully\n');

    console.log('Step 2/2: Generating runtime metadata and TypeScript types...');
    execSync('pnpm generate:models-types', {
        cwd: join(__dirname, '..'),
        stdio: 'inherit',
    });

    console.log('\nGame assets generation complete.');
} catch (error) {
    console.error('\nError generating game assets:', error.message);
    process.exit(1);
}
