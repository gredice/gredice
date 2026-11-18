import { stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { readOperationCoverIllustrations } from './read-operation-cover-illustrations';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const publicIconPath = 'apps/www/public/assets/operation-icons';

const canvasSize = 640;

async function fileExists(path: string) {
    try {
        const file = await stat(path);
        return file.isFile() && file.size > 0;
    } catch {
        return false;
    }
}

async function validateIllustrationAssets(
    illustrations: Awaited<ReturnType<typeof readOperationCoverIllustrations>>,
) {
    const errors: string[] = [];

    for (const [operationName, entry] of illustrations) {
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
    const illustrations = await readOperationCoverIllustrations();
    if (illustrations.size === 0) {
        throw new Error('No operation cover illustrations found.');
    }
    const illustrationErrors = await validateIllustrationAssets(illustrations);
    if (illustrationErrors.length > 0) {
        throw new Error(
            `Invalid operation cover illustrations:\n${illustrationErrors.join('\n')}`,
        );
    }

    console.log(
        JSON.stringify(
            {
                illustrationsChecked: illustrations.size,
                directory: join(repoRoot, publicIconPath, 'illustrated'),
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
