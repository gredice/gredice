import { copyFile, mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

function getStringArg(key: string, fallback: string) {
    const prefixedKey = `--${key}`;
    const index = process.argv.indexOf(prefixedKey);

    if (index < 0) {
        return fallback;
    }

    const value = process.argv[index + 1];
    if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${prefixedKey}.`);
    }

    return value;
}

function resolveFromRepositoryRoot(targetPath: string) {
    return path.isAbsolute(targetPath)
        ? targetPath
        : path.resolve(repositoryRoot, targetPath);
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

async function listMatchingFiles(directory: string, pattern: RegExp) {
    const entries = await readdir(directory, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isFile() && pattern.test(entry.name))
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
}

async function main() {
    const sourceDirectory = resolveFromRepositoryRoot(
        getStringArg('source', 'apps/garden/public/assets/sprites/decorations'),
    );
    const targetDirectory = resolveFromRepositoryRoot(
        getStringArg('target', 'apps/www/public/assets/sprites/decorations'),
    );
    const baseName = getStringArg('base', 'ground-cover.atlas');
    const pattern = new RegExp(
        `^${escapeRegExp(baseName)}(?:\\.\\d+)?\\.(?:json|png|webp)$`,
        'u',
    );
    const sourceFiles = await listMatchingFiles(sourceDirectory, pattern);
    const targetFiles = await listMatchingFiles(targetDirectory, pattern);
    const sourceFileSet = new Set(sourceFiles);

    await mkdir(targetDirectory, { recursive: true });

    await Promise.all(
        sourceFiles.map((fileName) =>
            copyFile(
                path.join(sourceDirectory, fileName),
                path.join(targetDirectory, fileName),
            ),
        ),
    );

    await Promise.all(
        targetFiles
            .filter((fileName) => !sourceFileSet.has(fileName))
            .map((fileName) => unlink(path.join(targetDirectory, fileName))),
    );

    console.info(
        `Synced ${sourceFiles.length} decoration atlas file(s) to ${path.relative(repositoryRoot, targetDirectory)}.`,
    );
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
