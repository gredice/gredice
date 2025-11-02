#!/usr/bin/env node

/**
 * Post-processes gltfjsx output to fix TypeScript and linting issues
 * This script:
 * - Converts regular imports to type imports where appropriate
 * - Removes unused React import
 * - Fixes JSX namespace references
 * - Removes GLTFAction[] from animations (not used in our setup)
 * - Fixes type assertions to use 'as unknown as' pattern
 * - Adds semicolons for consistency
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

async function fixGltfjsxOutput() {
    try {
        let content = await readFile(targetFile, 'utf-8');

        // Fix imports - convert to type imports
        content = content.replace(
            /^import \* as THREE from 'three'$/m,
            "import type * as THREE from 'three';",
        );
        content = content.replace(
            /^import { GLTF } from 'three-stdlib'$/m,
            "import type { GLTF } from 'three-stdlib';",
        );

        // Add missing semicolons to imports
        content = content.replace(
            /^(import .+ from '.+')$/gm,
            '$1;',
        );

        // Remove unused React import (if it exists)
        content = content.replace(/^import React from 'react';\n/m, '');
        content = content.replace(/^import type React from 'react';\n/m, '');

        // Remove GLTFAction[] animations property (not used)
        content = content.replace(/\s+animations: GLTFAction\[\]\n/m, '\n');

        // Export GLTFResult type
        content = content.replace(/^type GLTFResult = /m, 'export type GLTFResult = ');

        // Fix JSX namespace reference
        content = content.replace(
            /JSX\.IntrinsicElements\['group'\]/g,
            "React.JSX.IntrinsicElements['group']",
        );

        // Add React type import if we're using React.JSX namespace
        if (content.includes('React.JSX')) {
            const importIndex = content.indexOf("import { useGLTF }");
            if (importIndex !== -1) {
                content = `${content.slice(0, importIndex)}import type React from 'react';\n${content.slice(importIndex)}`;
            }
        }

        // Fix type assertion
        content = content.replace(
            / as GLTFResult$/m,
            ' as unknown as GLTFResult',
        );

        // Ensure semicolons
        content = content.replace(/^(\}\n)$/m, '};\n');
        content = content.replace(/useGLTF\.preload\('\/GameAssets\.glb'\)$/m, "useGLTF.preload('/GameAssets.glb');");

        await writeFile(targetFile, content, 'utf-8');
        console.log('✅ Successfully fixed GameAssets.tsx');

        // Run biome to apply linting fixes
        const { execSync } = await import('node:child_process');
        try {
            execSync('pnpm biome check --write --unsafe ./src/models/GameAssets.tsx', {
                cwd: join(__dirname, '..', 'packages', 'game'),
                stdio: 'inherit',
            });
            console.log('✅ Applied biome linting fixes');
        } catch (biomeError) {
            console.warn('⚠️  Biome linting had issues (non-fatal)');
        }
    } catch (error) {
        console.error('❌ Error fixing gltfjsx output:', error);
        process.exit(1);
    }
}

fixGltfjsxOutput();
