#!/usr/bin/env node

/**
 * Post-processes gltfjsx output to fix TypeScript issues
 * This script:
 * - Runs biome formatting first to handle structural fixes
 * - Converts regular imports to type imports
 * - Exports GLTFResult type
 * - Fixes JSX namespace references
 * - Removes unused GLTFAction[] animations
 * - Fixes type assertions
 * - Runs biome again for final cleanup
 */

import { execSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const targetFile = join(
    __dirname,
    '..',
    'packages',
    'game',
    'src',
    'models',
    'GameAssets.tsx',
);

const gamePackageDir = join(__dirname, '..', 'packages', 'game');

function runBiome(message) {
    try {
        execSync(
            'pnpm biome check --write --unsafe ./src/models/GameAssets.tsx',
            {
                cwd: gamePackageDir,
                stdio: 'inherit',
            },
        );
        console.log(`✅ ${message}`);
    } catch (error) {
        console.warn(`⚠️  Biome had issues (non-fatal): ${message}`);
    }
}

async function fixGltfjsxOutput() {
    try {
        // Step 1: Run biome first to handle formatting, semicolons, etc.
        console.log('🔧 Step 1: Running biome for initial formatting...');
        runBiome('Initial biome formatting complete');

        // Step 2: Apply TypeScript-specific fixes
        console.log('\n🔧 Step 2: Applying TypeScript fixes...');
        let content = await readFile(targetFile, 'utf-8');

        // Convert to type imports
        content = content.replace(
            /^import \* as THREE from 'three';$/m,
            "import type * as THREE from 'three';",
        );
        content = content.replace(
            /^import { GLTF } from 'three-stdlib';$/m,
            "import type { GLTF } from 'three-stdlib';",
        );

        // Remove unused React import if present
        content = content.replace(/^import React from 'react';\n/m, '');
        content = content.replace(/^import type React from 'react';\n/m, '');

        // Remove GLTFAction[] animations property (not used)
        content = content.replace(/\s+animations: GLTFAction\[\];?\n/m, '\n');

        // Export GLTFResult type
        content = content.replace(
            /^type GLTFResult = /m,
            'export type GLTFResult = ',
        );

        // Fix JSX namespace reference
        content = content.replace(
            /JSX\.IntrinsicElements\['group'\]/g,
            "React.JSX.IntrinsicElements['group']",
        );

        // Add React type import if we're using React.JSX namespace
        if (content.includes('React.JSX')) {
            const importIndex = content.indexOf('import { useGLTF }');
            if (importIndex !== -1) {
                content = `${content.slice(0, importIndex)}import type React from 'react';\n${content.slice(importIndex)}`;
            }
        }

        // Fix type assertion
        content = content.replace(
            / as GLTFResult/m,
            ' as unknown as GLTFResult',
        );

        await writeFile(targetFile, content, 'utf-8');
        console.log('✅ TypeScript fixes applied');

        // Step 3: Run biome again for final cleanup
        console.log('\n🔧 Step 3: Running biome for final cleanup...');
        runBiome('Final biome formatting complete');

        console.log('\n✅ Successfully fixed GameAssets.tsx');
    } catch (error) {
        console.error('❌ Error fixing gltfjsx output:', error);
        process.exit(1);
    }
}

fixGltfjsxOutput();
