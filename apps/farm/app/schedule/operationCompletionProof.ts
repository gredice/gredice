import { validateHostedImageUrl } from '@gredice/js/urls';

export const MAX_FARM_OPERATION_COMPLETION_IMAGE_COUNT = 20;
export const MAX_FARM_OPERATION_COMPLETION_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;

export class FarmOperationCompletionImagesValidationError extends Error {
    constructor(
        message: string,
        readonly imageUrls: string[],
    ) {
        super(message);
        this.name = 'FarmOperationCompletionImagesValidationError';
    }
}

export function getFarmOperationCompletionImageFileError(
    file: Pick<File, 'size' | 'type'>,
) {
    if (!file.type.toLowerCase().startsWith('image/')) {
        return 'Odaberi datoteku fotografije.';
    }
    if (
        !Number.isSafeInteger(file.size) ||
        file.size <= 0 ||
        file.size > MAX_FARM_OPERATION_COMPLETION_IMAGE_SIZE_BYTES
    ) {
        return 'Fotografija mora biti manja od 25 MB.';
    }

    return null;
}

export function getFarmOperationCompletionImagePathPrefix(
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
) {
    return `operations/${operationId}/entity-${expectedEntityId}/version-${expectedTaskVersionEventId}/`;
}

function isOperationImageUrl(
    imageUrl: string,
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
) {
    const parsedImageUrl = new URL(imageUrl);
    return (
        !parsedImageUrl.search &&
        !parsedImageUrl.hash &&
        parsedImageUrl.pathname.startsWith(
            `/${getFarmOperationCompletionImagePathPrefix(operationId, expectedEntityId, expectedTaskVersionEventId)}`,
        )
    );
}

export interface FarmOperationCompletionImageMetadata {
    contentType: string;
    pathname: string;
    size: number;
    url: string;
}

type FarmOperationCompletionImageMetadataLoader = (
    imageUrl: string,
) => Promise<FarmOperationCompletionImageMetadata>;

export function normalizeFarmOperationCompletionImageUrls(
    value: unknown,
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
) {
    if (value === undefined) {
        return undefined;
    }
    if (!Array.isArray(value)) {
        throw new Error('Popis slika nije ispravan.');
    }

    const uniqueUrls = new Set<string>();
    for (const item of value) {
        if (typeof item !== 'string') {
            throw new Error('Popis slika nije ispravan.');
        }

        const imageUrl = item.trim();
        if (!imageUrl) {
            continue;
        }
        if (
            validateHostedImageUrl(imageUrl) ||
            !isOperationImageUrl(
                imageUrl,
                operationId,
                expectedEntityId,
                expectedTaskVersionEventId,
            )
        ) {
            throw new Error(
                'Slike moraju biti učitane kroz ovu radnju u Gredicama.',
            );
        }

        uniqueUrls.add(imageUrl);
    }

    if (uniqueUrls.size > MAX_FARM_OPERATION_COMPLETION_IMAGE_COUNT) {
        throw new Error(
            `Zapis završetka može imati najviše ${MAX_FARM_OPERATION_COMPLETION_IMAGE_COUNT} slika.`,
        );
    }

    return uniqueUrls.size > 0 ? Array.from(uniqueUrls) : undefined;
}

export async function assertFarmOperationCompletionImagesStored(
    imageUrls: string[] | undefined,
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
    loadMetadata: FarmOperationCompletionImageMetadataLoader,
) {
    if (!imageUrls) {
        return;
    }

    const expectedPathPrefix = getFarmOperationCompletionImagePathPrefix(
        operationId,
        expectedEntityId,
        expectedTaskVersionEventId,
    );
    const validationResults = await Promise.all(
        imageUrls.map(async (imageUrl) => {
            let metadata: FarmOperationCompletionImageMetadata;
            try {
                metadata = await loadMetadata(imageUrl);
            } catch {
                return {
                    imageUrl,
                    message:
                        'Fotografija nije pronađena. Učitaj je ponovno prije završetka radnje.',
                };
            }

            const expectedPathname = new URL(imageUrl).pathname.slice(1);
            if (
                metadata.url !== imageUrl ||
                metadata.pathname !== expectedPathname ||
                !metadata.pathname.startsWith(expectedPathPrefix) ||
                !metadata.contentType.toLowerCase().startsWith('image/') ||
                !Number.isSafeInteger(metadata.size) ||
                metadata.size <= 0
            ) {
                return {
                    imageUrl,
                    message:
                        'Dokaz mora biti postojeća fotografija učitana kroz ovu radnju.',
                };
            }

            return { imageUrl, message: null };
        }),
    );
    const invalidResults = validationResults.filter(
        (result) => result.message !== null,
    );
    if (invalidResults.length > 0) {
        throw new FarmOperationCompletionImagesValidationError(
            invalidResults[0]?.message ??
                'Fotografija nije dostupna. Učitaj je ponovno.',
            invalidResults.map((result) => result.imageUrl),
        );
    }
}
