import { validateHostedImageUrl } from '@gredice/js/urls';

export const MAX_FARM_OPERATION_COMPLETION_IMAGE_COUNT = 20;

function isOperationImageUrl(imageUrl: string, operationId: number) {
    const parsedImageUrl = new URL(imageUrl);
    return (
        !parsedImageUrl.search &&
        !parsedImageUrl.hash &&
        parsedImageUrl.pathname.startsWith(`/operations/${operationId}/`)
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
            !isOperationImageUrl(imageUrl, operationId)
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
    loadMetadata: FarmOperationCompletionImageMetadataLoader,
) {
    if (!imageUrls) {
        return;
    }

    await Promise.all(
        imageUrls.map(async (imageUrl) => {
            let metadata: FarmOperationCompletionImageMetadata;
            try {
                metadata = await loadMetadata(imageUrl);
            } catch {
                throw new Error(
                    'Fotografija nije pronađena. Učitaj je ponovno prije završetka radnje.',
                );
            }

            const expectedPathname = new URL(imageUrl).pathname.slice(1);
            if (
                metadata.url !== imageUrl ||
                metadata.pathname !== expectedPathname ||
                !metadata.pathname.startsWith(`operations/${operationId}/`) ||
                !metadata.contentType.toLowerCase().startsWith('image/') ||
                !Number.isSafeInteger(metadata.size) ||
                metadata.size <= 0
            ) {
                throw new Error(
                    'Dokaz mora biti postojeća fotografija učitana kroz ovu radnju.',
                );
            }
        }),
    );
}
