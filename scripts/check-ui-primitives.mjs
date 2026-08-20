import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEMPORARY_UI_PRIMITIVE_ALLOWLIST = new Set([
    'packages/ui/src/Menu/Menu.tsx',
    'packages/ui/src/Modal/Modal.tsx',
    'packages/ui/src/ModalConfirm/ModalConfirm.tsx',
    'packages/ui/src/Popper/Popper.tsx',
    'packages/ui/src/SelectItems/SelectItems.tsx',
    'packages/ui/src/Tooltip/Tooltip.tsx',
]);

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
    'build',
    'coverage',
    'dist',
    'node_modules',
    'out',
    'storybook-static',
]);
const PRIMITIVE_IMPORT =
    /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)["'](@base-ui\/react(?:\/[^"']+)?|@radix-ui\/[^"']+|vaul)["']/gu;

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

export function findRestrictedUiPrimitiveImports(
    root,
    allowlist = TEMPORARY_UI_PRIMITIVE_ALLOWLIST,
) {
    const imports = [];

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

    const legacyImports = imports.filter(
        ({ specifier }) =>
            specifier === 'vaul' || specifier.startsWith('@radix-ui/'),
    );
    const importedFiles = new Set(legacyImports.map((entry) => entry.file));

    return {
        imports,
        legacyImports,
        staleAllowlistEntries: [...allowlist].filter(
            (file) => !importedFiles.has(file),
        ),
        unexpectedImports: imports.filter((entry) => {
            if (entry.specifier.startsWith('@base-ui/react')) {
                return !entry.file.startsWith('packages/ui/');
            }

            return !allowlist.has(entry.file);
        }),
    };
}

export function validateUiPrimitiveImports(
    root,
    allowlist = TEMPORARY_UI_PRIMITIVE_ALLOWLIST,
) {
    const result = findRestrictedUiPrimitiveImports(root, allowlist);
    const errors = [
        ...result.unexpectedImports.map(
            ({ file, line, specifier }) =>
                `${file}:${line} imports primitive outside its approved boundary: ${specifier}`,
        ),
        ...result.staleAllowlistEntries.map(
            (file) => `${file} is a stale temporary allowlist entry`,
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
    const result = validateUiPrimitiveImports(repositoryRoot);
    console.log(
        `UI primitive import guard passed (${result.legacyImports.length} temporary imports in ${TEMPORARY_UI_PRIMITIVE_ALLOWLIST.size} allowlisted files).`,
    );
}
