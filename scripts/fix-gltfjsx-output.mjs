#!/usr/bin/env node

/**
 * Post-processes gltfjsx output to fix TypeScript issues
 * This script:
 * - Runs biome formatting first to handle structural fixes
 * - Converts regular imports to type imports
 * - Exports GLTFResult type
 * - Fixes JSX namespace references
 * - Removes the generated Model component and preload call
 * - Preserves generated animation clip types when assets include animations
 * - Fixes type assertions
 * - Runs biome again for final cleanup
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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
const manifestFile = join(__dirname, '..', 'assets', 'game-assets.json');
const modelsDir = join(
    __dirname,
    '..',
    'apps',
    'garden',
    'public',
    'assets',
    'models',
);

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

function readGlbJson(filePath) {
    const buffer = readFileSync(filePath);
    const jsonLength = buffer.readUInt32LE(12);
    return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
}

function collectSplitAssetMaterialNames() {
    if (!existsSync(manifestFile)) {
        return [];
    }

    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    const materialNames = new Set();

    for (const asset of manifest.assets ?? []) {
        const glbPath = join(modelsDir, asset.output);
        if (!existsSync(glbPath)) {
            continue;
        }

        const glb = readGlbJson(glbPath);
        for (const material of glb.materials ?? []) {
            if (typeof material.name === 'string') {
                materialNames.add(material.name);
            }
        }
    }

    return [...materialNames].sort((left, right) => left.localeCompare(right));
}

function replaceMaterialTypesWithSplitAssetNames(content) {
    const materialNames = collectSplitAssetMaterialNames();
    if (materialNames.length === 0) {
        return content;
    }

    const materialsBlock = [
        '    materials: {',
        ...materialNames.map(
            (name) => `        ${JSON.stringify(name)}: THREE.MeshStandardMaterial;`,
        ),
        '    };',
    ].join('\n');

    return content.replace(
        /    materials: \{\n[\s\S]*?\n    \};/,
        materialsBlock,
    );
}

async function fixGltfjsxOutput() {
    try {
        // Step 1: Run biome first to handle formatting, semicolons, etc.
        console.log('🔧 Step 1: Running biome for initial formatting...');
        runBiome('Initial biome formatting complete');

        // Step 2: Apply TypeScript-specific fixes
        console.log('\n🔧 Step 2: Applying TypeScript fixes...');
        let content = await readFile(targetFile, 'utf-8');

        content = content.replace(
            /Command: npx gltfjsx@6\.5\.3 .*GameAssetsTypes\.glb --types --typeonly --output \.\.\/\.\.\/packages\/game\/src\/models\/GameAssets\.tsx[ \t]*/,
            'Command: npx gltfjsx@6.5.3 ./apps/garden/.tmp/GameAssetsTypes.glb --types --typeonly --output packages/game/src/models/GameAssets.tsx',
        );

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
        content = content.replace(/^import { useGLTF } from '@react-three\/drei';\n/m, '');

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

        const modelIndex = content.indexOf('\nexport function Model(');
        if (modelIndex >= 0) {
            content = `${content.slice(0, modelIndex).trimEnd()}\n`;
        }
        content = content.replace(/\nuseGLTF\.preload\([\s\S]*?\);\s*$/m, '\n');
        content = replaceMaterialTypesWithSplitAssetNames(content);

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
