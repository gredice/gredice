import { readdir, readFile } from 'node:fs/promises';

const directory = new URL('./operation-cover-illustrations/', import.meta.url);

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readIllustration(value: unknown) {
    if (!isRecord(value)) {
        return null;
    }
    const { asset, entityId, mode, previousUrl, prompt, styleReferences } =
        value;
    const exportDetails = value.export;
    if (
        typeof asset !== 'string' ||
        typeof entityId !== 'number' ||
        !Number.isSafeInteger(entityId) ||
        entityId < 1 ||
        typeof mode !== 'string' ||
        !mode.trim() ||
        (previousUrl !== null &&
            (typeof previousUrl !== 'string' ||
                !URL.canParse(previousUrl) ||
                new URL(previousUrl).protocol !== 'https:')) ||
        typeof prompt !== 'string' ||
        !prompt.trim() ||
        !Array.isArray(styleReferences) ||
        styleReferences.length === 0 ||
        !styleReferences.every(
            (reference): reference is string => typeof reference === 'string',
        ) ||
        typeof exportDetails !== 'string' ||
        !exportDetails.trim()
    ) {
        return null;
    }
    return { asset, entityId, mode, previousUrl, prompt, styleReferences };
}

export async function readOperationCoverIllustrations() {
    const files = (await readdir(directory))
        .filter((file) => file.endsWith('.json'))
        .sort();
    const illustrations = new Map<
        string,
        NonNullable<ReturnType<typeof readIllustration>>
    >();
    const entityIds = new Set<number>();

    for (const file of files) {
        const contents = await readFile(new URL(file, directory), 'utf8');
        const batch: unknown = JSON.parse(contents);
        if (!isRecord(batch)) {
            throw new Error(
                `${file} must contain an object keyed by operation name.`,
            );
        }
        for (const [operation, value] of Object.entries(batch)) {
            const illustration = readIllustration(value);
            if (!illustration) {
                throw new Error(
                    `${file}: invalid illustration for ${operation}.`,
                );
            }
            if (
                illustrations.has(operation) ||
                entityIds.has(illustration.entityId)
            ) {
                throw new Error(
                    `${file}: duplicate illustration assignment for ${operation}.`,
                );
            }
            illustrations.set(operation, illustration);
            entityIds.add(illustration.entityId);
        }
    }

    return illustrations;
}
