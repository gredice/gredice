import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const entryPath = join(sourceRoot, 'GardenOverview2DWrapper.tsx');
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

function getStaticRuntimeImports(source: string) {
    const imports: string[] = [];
    const statementPattern =
        /(?:import|export)\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;/g;

    for (const match of source.matchAll(statementPattern)) {
        const clause = match[1]?.trimStart();
        const specifier = match[2];
        if (clause?.startsWith('type ') || !specifier) {
            continue;
        }
        imports.push(specifier);
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

test('keeps the React-only garden entry free of 3D runtime imports', () => {
    const pending = [entryPath];
    const visited = new Set<string>();

    while (pending.length > 0) {
        const sourcePath = pending.pop();
        if (!sourcePath || visited.has(sourcePath)) {
            continue;
        }
        visited.add(sourcePath);

        const imports = getStaticRuntimeImports(
            readFileSync(sourcePath, 'utf8'),
        );
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

    assert.ok(visited.size > 10, 'expected to inspect the shared HUD graph');
});

test('keeps saved structure summaries visible when the managed building flag is off', () => {
    const content = readFileSync(
        join(sourceRoot, 'GardenOverview2DContent.tsx'),
        'utf8',
    );

    assert.match(content, /garden\.structures\.length > 0/);
    assert.doesNotMatch(
        content,
        /enableGardenBuildingSystemFlag\s*&&\s*garden\.structures/,
    );
});
