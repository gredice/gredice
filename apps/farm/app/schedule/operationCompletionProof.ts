import { validateHostedImageUrl } from '@gredice/js/urls';

export const MAX_FARM_OPERATION_COMPLETION_IMAGE_COUNT = 20;
export const MAX_FARM_OPERATION_COMPLETION_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;
export const FARM_OPERATION_COMPLETION_IDEMPOTENT_UPLOAD_CONSTRAINTS = {
    addRandomSuffix: false,
    allowOverwrite: false,
} as const;

const FARM_OPERATION_COMPLETION_UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FARM_OPERATION_COMPLETION_IMAGE_EXTENSION_PATTERN = /^[a-z0-9]{1,10}$/;

export class FarmOperationCompletionImagesValidationError extends Error {
    constructor(
        message: string,
        readonly imageUrls: string[],
        readonly reason: 'invalid' | 'missing',
    ) {
        super(message);
        this.name = 'FarmOperationCompletionImagesValidationError';
    }
}

export class FarmOperationCompletionImageMetadataUnavailableError extends Error {
    constructor() {
        super('Provjera spremljene fotografije trenutačno nije dostupna.');
        this.name = 'FarmOperationCompletionImageMetadataUnavailableError';
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

function parseFarmOperationCompletionUuid(value: unknown, label: string) {
    if (
        typeof value !== 'string' ||
        !FARM_OPERATION_COMPLETION_UUID_PATTERN.test(value)
    ) {
        throw new Error(`${label} nije ispravan.`);
    }

    return value.toLowerCase();
}

export function parseFarmOperationCompletionSubmissionId(value: unknown) {
    return parseFarmOperationCompletionUuid(value, 'ID slanja');
}

export function parseFarmOperationCompletionAttachmentId(value: unknown) {
    return parseFarmOperationCompletionUuid(value, 'ID fotografije');
}

export function getFarmOperationCompletionSubmissionImagePathPrefix(
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
    submissionId: string,
) {
    const validSubmissionId =
        parseFarmOperationCompletionSubmissionId(submissionId);

    return `${getFarmOperationCompletionImagePathPrefix(operationId, expectedEntityId, expectedTaskVersionEventId)}submissions/${validSubmissionId}/attachments/`;
}

function getFarmOperationCompletionImageExtension(fileName: string) {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex < 0 || lastDotIndex === fileName.length - 1) {
        return '';
    }

    const extension = fileName.slice(lastDotIndex + 1).toLowerCase();
    return FARM_OPERATION_COMPLETION_IMAGE_EXTENSION_PATTERN.test(extension)
        ? `.${extension}`
        : '';
}

export function getFarmOperationCompletionSubmissionImagePath(
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
    submissionId: string,
    attachmentId: string,
    fileName: string,
) {
    const validAttachmentId =
        parseFarmOperationCompletionAttachmentId(attachmentId);

    return `${getFarmOperationCompletionSubmissionImagePathPrefix(
        operationId,
        expectedEntityId,
        expectedTaskVersionEventId,
        submissionId,
    )}${validAttachmentId}${getFarmOperationCompletionImageExtension(fileName)}`;
}

export function isFarmOperationCompletionSubmissionImagePath(
    pathname: string,
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
    submissionId: string,
    attachmentId: string,
    fileName: string,
) {
    return (
        pathname ===
        getFarmOperationCompletionSubmissionImagePath(
            operationId,
            expectedEntityId,
            expectedTaskVersionEventId,
            submissionId,
            attachmentId,
            fileName,
        )
    );
}

function isSubmissionAttachmentPathname(
    pathname: string,
    expectedPathPrefix: string,
) {
    if (!pathname.startsWith(expectedPathPrefix)) {
        return false;
    }

    const fileName = pathname.slice(expectedPathPrefix.length);
    const dotIndex = fileName.indexOf('.');
    const attachmentId = dotIndex < 0 ? fileName : fileName.slice(0, dotIndex);
    try {
        if (
            parseFarmOperationCompletionAttachmentId(attachmentId) !==
            attachmentId
        ) {
            return false;
        }
    } catch {
        return false;
    }

    return (
        dotIndex < 0 ||
        FARM_OPERATION_COMPLETION_IMAGE_EXTENSION_PATTERN.test(
            fileName.slice(dotIndex + 1),
        )
    );
}

function isOperationImageUrl(
    imageUrl: string,
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
    submissionId?: string,
) {
    const parsedImageUrl = new URL(imageUrl);
    const expectedPathPrefix = submissionId
        ? getFarmOperationCompletionSubmissionImagePathPrefix(
              operationId,
              expectedEntityId,
              expectedTaskVersionEventId,
              submissionId,
          )
        : getFarmOperationCompletionImagePathPrefix(
              operationId,
              expectedEntityId,
              expectedTaskVersionEventId,
          );
    if (parsedImageUrl.search || parsedImageUrl.hash) {
        return false;
    }

    const pathname = parsedImageUrl.pathname.slice(1);
    return submissionId
        ? isSubmissionAttachmentPathname(pathname, expectedPathPrefix)
        : pathname.startsWith(expectedPathPrefix);
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
    submissionId?: string,
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
                submissionId,
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
    submissionId?: string,
) {
    if (!imageUrls) {
        return;
    }

    const expectedPathPrefix = submissionId
        ? getFarmOperationCompletionSubmissionImagePathPrefix(
              operationId,
              expectedEntityId,
              expectedTaskVersionEventId,
              submissionId,
          )
        : getFarmOperationCompletionImagePathPrefix(
              operationId,
              expectedEntityId,
              expectedTaskVersionEventId,
          );
    const validationResults = await Promise.all(
        imageUrls.map(async (imageUrl) => {
            let metadata: FarmOperationCompletionImageMetadata;
            try {
                metadata = await loadMetadata(imageUrl);
            } catch (error) {
                if (
                    error instanceof
                    FarmOperationCompletionImageMetadataUnavailableError
                ) {
                    throw error;
                }
                return {
                    imageUrl,
                    message:
                        'Fotografija nije pronađena. Učitaj je ponovno prije završetka radnje.',
                    reason: 'missing' as const,
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
                    reason: 'invalid' as const,
                };
            }

            return { imageUrl, message: null, reason: null };
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
            invalidResults.some((result) => result.reason === 'invalid')
                ? 'invalid'
                : 'missing',
        );
    }
}
