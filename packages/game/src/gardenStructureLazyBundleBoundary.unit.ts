import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const sourceExtensions = ['.ts', '.tsx'];
const entryPaths = [
    join(sourceRoot, 'GameHud.tsx'),
    join(sourceRoot, 'GameScene.tsx'),
    join(sourceRoot, 'viewers/PublicGardenViewer.tsx'),
];
const editorOnlyRuntimeFiles = new Set([
    'structures/GardenStructureCollectionRenderer.tsx',
    'structures/GardenStructureKitV1AssetRenderer.tsx',
    'structures/GardenStructureSceneLayer.tsx',
    'structures/GardenStructureVerticalSlice.tsx',
    'structures/GardenStructureVerticalSliceHud.tsx',
]);

function resolveSourceImport(fromPath: string, specifier: string) {
    if (!specifier.startsWith('.')) {
        return null;
    }

    const unresolvedPath = resolve(dirname(fromPath), specifier);
    const candidates = extname(unresolvedPath)
        ? [unresolvedPath]
        : [
              ...sourceExtensions.map(
                  (extension) => unresolvedPath + extension,
              ),
              ...sourceExtensions.map((extension) =>
                  join(unresolvedPath, `index${extension}`),
              ),
          ];

    return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function getStaticRuntimeImports(source: string) {
    const imports: string[] = [];
    const statementPattern =
        /(?:import|export)\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;/g;
    const sideEffectPattern = /import\s+['"]([^'"]+)['"]\s*;/g;

    for (const match of source.matchAll(statementPattern)) {
        const clause = match[1]?.trimStart();
        const specifier = match[2];
        if (clause?.startsWith('type ') || !specifier) {
            continue;
        }
        imports.push(specifier);
    }

    for (const match of source.matchAll(sideEffectPattern)) {
        if (match[1]) {
            imports.push(match[1]);
        }
    }

    return imports;
}

test('keeps building editor and GLB renderers behind lazy boundaries', () => {
    const pending = [...entryPaths];
    const visited = new Set<string>();

    while (pending.length > 0) {
        const sourcePath = pending.pop();
        if (!sourcePath || visited.has(sourcePath)) {
            continue;
        }
        visited.add(sourcePath);

        const relativePath = relative(sourceRoot, sourcePath);
        assert.equal(
            editorOnlyRuntimeFiles.has(relativePath),
            false,
            `${relativePath} must be reachable only through next/dynamic`,
        );
        assert.equal(
            relativePath.startsWith('structures/editor/'),
            false,
            `${relativePath} must not enter the default HUD or scene graph`,
        );

        for (const specifier of getStaticRuntimeImports(
            readFileSync(sourcePath, 'utf8'),
        )) {
            const importedSource = resolveSourceImport(sourcePath, specifier);
            if (importedSource) {
                pending.push(importedSource);
            }
        }
    }

    assert.ok(visited.size > 100, 'expected to inspect the shared scene graph');
});

test('declares explicit dynamic boundaries for saved and active structures', () => {
    const dynamicBoundaries = [
        [
            'structures/GardenStructureSceneLayerDynamic.tsx',
            './GardenStructureSceneLayer',
        ],
        [
            'structures/GardenStructureVerticalSliceDynamic.tsx',
            './GardenStructureVerticalSlice',
        ],
        [
            'structures/GardenStructureVerticalSliceHudDynamic.tsx',
            './GardenStructureVerticalSliceHud',
        ],
    ] as const;

    for (const [relativePath, target] of dynamicBoundaries) {
        const source = readFileSync(join(sourceRoot, relativePath), 'utf8');
        assert.match(source, /import dynamic from 'next\/dynamic'/);
        assert.ok(source.includes(`import('${target}')`));
        assert.match(source, /ssr: false/);
    }
});
