import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const entryPath = join(sourceRoot, 'OutletGardenBrowserViewer.tsx');
const sourceExtensions = ['.ts', '.tsx'];
const prohibitedRuntimePackages = [
    '@react-spring/three',
    '@react-three/drei',
    '@react-three/fiber',
    'three',
    'three-custom-shader-material',
    'three-stdlib',
];

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

function getRuntimeImports(source: string) {
    const imports: string[] = [];
    const statementPattern =
        /(?:import|export)\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;/g;
    const sideEffectPattern = /import\s+['"]([^'"]+)['"]\s*;/g;
    const dynamicPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

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

    for (const match of source.matchAll(dynamicPattern)) {
        if (match[1]) {
            imports.push(match[1]);
        }
    }

    return imports;
}

function isProhibitedRuntimeImport(specifier: string) {
    return prohibitedRuntimePackages.some(
        (packageName) =>
            specifier === packageName ||
            specifier.startsWith(`${packageName}/`),
    );
}

test('keeps the Outlet list fallback free of 3D runtime imports', () => {
    const pending = [entryPath];
    const visited = new Set<string>();

    while (pending.length > 0) {
        const sourcePath = pending.pop();
        if (!sourcePath || visited.has(sourcePath)) {
            continue;
        }
        visited.add(sourcePath);

        const imports = getRuntimeImports(readFileSync(sourcePath, 'utf8'));
        for (const specifier of imports) {
            assert.equal(
                isProhibitedRuntimeImport(specifier),
                false,
                `${relative(sourceRoot, sourcePath)} statically imports ${specifier}`,
            );

            const importedSource = resolveSourceImport(sourcePath, specifier);
            if (importedSource) {
                pending.push(importedSource);
            }
        }
    }

    assert.ok(
        visited.has(join(sourceRoot, 'OutletGardenOfferBrowser.tsx')),
        'expected to inspect the shared Outlet offer browser',
    );
    assert.ok(
        visited.has(join(sourceRoot, '../hooks/useOutletOffers.ts')),
        'expected to inspect the shared Outlet offer query',
    );
});

test('exposes the list controller through its dedicated package entry', async () => {
    const listEntry = await import('@gredice/game/outlet-garden-list');
    assert.equal(typeof listEntry.OutletGardenBrowserViewer, 'function');
});
