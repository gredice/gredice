#!/usr/bin/env node

/**
 * Cross-platform script to generate game assets
 * - On Windows: runs export.ps1 using PowerShell
 * - On Unix-like systems (macOS, Linux): runs export.sh
 * - Then generates TypeScript types using gltfjsx
 */

import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const assetsDir = join(__dirname, '..', 'assets');

const isWindows = platform() === 'win32';

console.log(`🎨 Generating game assets for ${isWindows ? 'Windows' : 'Unix-like system'}...\n`);

try {
    // Step 1: Export GLB file from Blender
    console.log('📦 Step 1/2: Exporting GLB file from Blender...');
    
    if (isWindows) {
        // On Windows, run the PowerShell script
        execSync('powershell.exe -ExecutionPolicy Bypass -File .\\export.ps1', {
            cwd: assetsDir,
            stdio: 'inherit',
        });
    } else {
        // On Unix-like systems, run the shell script
        execSync('./export.sh', {
            cwd: assetsDir,
            stdio: 'inherit',
        });
    }
    
    console.log('✅ GLB file exported successfully\n');
    
    // Step 2: Generate TypeScript types
    console.log('🔧 Step 2/2: Generating TypeScript types...');
    execSync('pnpm generate:models-types', {
        cwd: join(__dirname, '..'),
        stdio: 'inherit',
    });
    
    console.log('\n✅ Game assets generation complete!');
} catch (error) {
    console.error('\n❌ Error generating game assets:', error.message);
    process.exit(1);
}
