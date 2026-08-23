import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_EXTENSIONS = new Set([
    '.cjs',
    '.cts',
    '.js',
    '.jsx',
    '.mjs',
    '.mts',
    '.ts',
    '.tsx',
]);
const IGNORED_DIRECTORIES = new Set([
    '.next',
    '.turbo',
    '.vercel',
    'build',
    'coverage',
    'dist',
    'node_modules',
    'out',
    'storybook-static',
]);
const PRIMITIVE_IMPORT =
    /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)["'](@base-ui\/react(?:\/[^"']+)?|@radix-ui\/[^"']+|vaul)["']/gu;
const DEPENDENCY_FIELDS = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
];

function sourceFiles(directory) {
    const files = [];

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
            continue;
        }

        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...sourceFiles(entryPath));
            continue;
        }

        if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
            files.push(entryPath);
        }
    }

    return files;
}

function lineNumber(source, index) {
    return source.slice(0, index).split('\n').length;
}

function manifestFiles(directory) {
    const files = [];

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
            continue;
        }

        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...manifestFiles(entryPath));
        } else if (entry.name === 'package.json') {
            files.push(entryPath);
        }
    }

    return files;
}

function packageManifests(root) {
    const manifests = [];
    const rootManifest = path.join(root, 'package.json');

    if (existsSync(rootManifest)) {
        manifests.push(rootManifest);
    }

    for (const sourceRoot of ['apps', 'packages']) {
        const absoluteSourceRoot = path.join(root, sourceRoot);

        manifests.push(...manifestFiles(absoluteSourceRoot));
    }

    return manifests;
}

function isPrimitiveDependency(specifier) {
    return (
        specifier === '@base-ui/react' ||
        specifier === 'vaul' ||
        specifier.startsWith('@radix-ui/')
    );
}

function isLegacyPrimitive(specifier) {
    return specifier === 'vaul' || specifier.startsWith('@radix-ui/');
}

export function findRestrictedUiPrimitives(root) {
    const imports = [];
    const dependencies = [];

    for (const sourceRoot of ['apps', 'packages']) {
        const absoluteSourceRoot = path.join(root, sourceRoot);

        for (const file of sourceFiles(absoluteSourceRoot)) {
            const source = readFileSync(file, 'utf8');
            for (const match of source.matchAll(PRIMITIVE_IMPORT)) {
                imports.push({
                    file: path.relative(root, file).split(path.sep).join('/'),
                    line: lineNumber(source, match.index),
                    specifier: match[1],
                });
            }
        }
    }

    for (const file of packageManifests(root)) {
        const manifest = JSON.parse(readFileSync(file, 'utf8'));

        for (const field of DEPENDENCY_FIELDS) {
            const declarations = manifest[field];
            if (!declarations || typeof declarations !== 'object') {
                continue;
            }

            for (const specifier of Object.keys(declarations)) {
                if (isPrimitiveDependency(specifier)) {
                    dependencies.push({
                        field,
                        file: path
                            .relative(root, file)
                            .split(path.sep)
                            .join('/'),
                        specifier,
                    });
                }
            }
        }
    }

    return {
        dependencies,
        imports,
        legacyDependencies: dependencies.filter(({ specifier }) =>
            isLegacyPrimitive(specifier),
        ),
        legacyImports: imports.filter(({ specifier }) =>
            isLegacyPrimitive(specifier),
        ),
        unexpectedDependencies: dependencies.filter(({ file, specifier }) => {
            if (specifier === '@base-ui/react') {
                return file !== 'packages/ui/package.json';
            }

            return true;
        }),
        unexpectedImports: imports.filter((entry) => {
            if (entry.specifier.startsWith('@base-ui/react')) {
                return !entry.file.startsWith('packages/ui/');
            }

            return true;
        }),
    };
}

export function validateUiPrimitives(root) {
    const result = findRestrictedUiPrimitives(root);
    const errors = [
        ...result.unexpectedImports.map(
            ({ file, line, specifier }) =>
                `${file}:${line} imports primitive outside its approved boundary: ${specifier}`,
        ),
        ...result.unexpectedDependencies.map(
            ({ field, file, specifier }) =>
                `${file} declares primitive outside its approved boundary in ${field}: ${specifier}`,
        ),
    ];

    if (errors.length > 0) {
        throw new Error(errors.join('\n'));
    }

    return result;
}

const repositoryRoot = path.resolve(
    fileURLToPath(new URL('..', import.meta.url)),
);
const invokedAsScript =
    process.argv[1] !== undefined &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedAsScript) {
    const result = validateUiPrimitives(repositoryRoot);
    console.log(
        `UI primitive boundary passed (${result.imports.length} Base UI imports and ${result.dependencies.length} approved direct dependency declaration).`,
    );
}
