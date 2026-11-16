import { stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import operationCoverIllustrations from './operation-cover-illustrations.json' with {
    type: 'json',
};
import {
    directoryOperationCoverRecipes,
    validateOperationCoverRecipes,
} from './operation-cover-recipes';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const publicIconPath = 'apps/www/public/assets/operation-icons';
const publicIconDirectory = join(repoRoot, publicIconPath);

type IllustrationEntry = {
    asset: string;
    entityId?: number;
    export: string;
    mode: string;
    previousUrl?: string | null;
    prompt: string;
    styleReferences: string[];
};

const canvasSize = 640;
const illustrationEntries: [string, IllustrationEntry][] = Object.entries(
    operationCoverIllustrations,
);

async function fileExists(path: string) {
    try {
        const file = await stat(path);
        return file.isFile() && file.size > 0;
    } catch {
        return false;
    }
}

async function validateIllustrationAssets() {
    const errors: string[] = [];
    const entityIds = new Set<number>();

    for (const [operationName, entry] of illustrationEntries) {
        const expectedPath = `${publicIconPath}/illustrated/${operationName}.webp`;
        if (
            !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(operationName) ||
            entry.asset !== expectedPath
        ) {
            errors.push(
                `${operationName}: expected illustration at ${expectedPath}.`,
            );
            continue;
        }

        if (
            entry.entityId === undefined ||
            !Number.isSafeInteger(entry.entityId) ||
            entry.entityId <= 0 ||
            entityIds.has(entry.entityId)
        ) {
            errors.push(
                `${operationName}: entityId must be a unique positive integer.`,
            );
        } else {
            entityIds.add(entry.entityId);
        }

        if (
            entry.previousUrl !== null &&
            (typeof entry.previousUrl !== 'string' ||
                !URL.canParse(entry.previousUrl) ||
                new URL(entry.previousUrl).protocol !== 'https:')
        ) {
            errors.push(
                `${operationName}: previousUrl must be null or an HTTPS URL.`,
            );
        }

        if (
            !entry.mode.trim() ||
            !entry.prompt.trim() ||
            !entry.export.trim() ||
            entry.styleReferences.length === 0
        ) {
            errors.push(`${operationName}: missing illustration provenance.`);
        }

        for (const reference of entry.styleReferences) {
            const resolved = resolve(repoRoot, reference);
            const location = relative(repoRoot, resolved);
            if (
                isAbsolute(reference) ||
                location === '..' ||
                location.startsWith(`..${sep}`) ||
                !(await fileExists(resolved))
            ) {
                errors.push(
                    `${operationName}: missing repository style reference ${reference}.`,
                );
            }
        }

        try {
            const image = sharp(join(repoRoot, entry.asset));
            const metadata = await image.metadata();
            if (
                metadata.format !== 'webp' ||
                metadata.width !== canvasSize ||
                metadata.height !== canvasSize ||
                !metadata.hasAlpha
            ) {
                errors.push(
                    `${operationName}: expected a ${canvasSize}×${canvasSize} transparent WebP.`,
                );
                continue;
            }
            const { channels, isOpaque } = await image.stats();
            if (isOpaque || channels[3].min !== 0 || channels[3].max <= 8) {
                errors.push(
                    `${operationName}: expected both transparent background and visible artwork.`,
                );
            }
        } catch (error) {
            errors.push(
                `${operationName}: could not decode ${entry.asset}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    return errors;
}

async function main() {
    const recipeValidationErrors = validateOperationCoverRecipes(
        directoryOperationCoverRecipes,
    );
    if (recipeValidationErrors.length > 0) {
        throw new Error(
            `Invalid operation cover recipes:\n${recipeValidationErrors.join('\n')}`,
        );
    }

    const missingFiles: string[] = [];
    for (const recipe of directoryOperationCoverRecipes) {
        const outputPath = join(publicIconDirectory, recipe.outputFileName);
        if (!(await fileExists(outputPath))) {
            missingFiles.push(recipe.outputFileName);
        }
    }

    if (missingFiles.length > 0) {
        throw new Error(
            `Missing operation cover assets:\n${missingFiles.join('\n')}`,
        );
    }

    const illustrationErrors = await validateIllustrationAssets();
    if (illustrationErrors.length > 0) {
        throw new Error(
            `Invalid operation cover illustrations:\n${illustrationErrors.join('\n')}`,
        );
    }

    console.log(
        JSON.stringify(
            {
                checked: directoryOperationCoverRecipes.length,
                illustrationsChecked: illustrationEntries.length,
                directory: publicIconDirectory,
            },
            null,
            2,
        ),
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
