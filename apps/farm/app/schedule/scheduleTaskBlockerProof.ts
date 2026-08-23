import { validateHostedImageUrl } from '@gredice/js/urls';
import {
    getScheduleTaskBlockerTargetKey,
    type ScheduleTaskBlockerTarget,
} from './scheduleTaskBlocker';

export const MAX_SCHEDULE_TASK_BLOCKER_IMAGE_COUNT = 5;
export const MAX_SCHEDULE_TASK_BLOCKER_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;

export class ScheduleTaskBlockerImagesValidationError extends Error {
    constructor(
        message: string,
        readonly imageUrls: string[],
    ) {
        super(message);
        this.name = 'ScheduleTaskBlockerImagesValidationError';
    }
}

export function getScheduleTaskBlockerImageFileError(
    file: Pick<File, 'size' | 'type'>,
) {
    if (!file.type.toLowerCase().startsWith('image/')) {
        return 'Odaberi datoteku fotografije.';
    }
    if (
        !Number.isSafeInteger(file.size) ||
        file.size <= 0 ||
        file.size > MAX_SCHEDULE_TASK_BLOCKER_IMAGE_SIZE_BYTES
    ) {
        return 'Fotografija mora biti manja od 25 MB.';
    }

    return null;
}

export function getScheduleTaskBlockerImagePathPrefix(
    target: ScheduleTaskBlockerTarget,
) {
    return `schedule-blockers/${getScheduleTaskBlockerTargetKey(target)}/`;
}

function isScheduleTaskBlockerImageUrl(
    imageUrl: string,
    target: ScheduleTaskBlockerTarget,
) {
    const parsedImageUrl = new URL(imageUrl);
    return (
        !parsedImageUrl.search &&
        !parsedImageUrl.hash &&
        parsedImageUrl.pathname.startsWith(
            `/${getScheduleTaskBlockerImagePathPrefix(target)}`,
        )
    );
}

export interface ScheduleTaskBlockerImageMetadata {
    contentType: string;
    pathname: string;
    size: number;
    url: string;
}

type ScheduleTaskBlockerImageMetadataLoader = (
    imageUrl: string,
) => Promise<ScheduleTaskBlockerImageMetadata>;

export function normalizeScheduleTaskBlockerImageUrls(
    value: unknown,
    target: ScheduleTaskBlockerTarget,
) {
    if (value === undefined) {
        return undefined;
    }
    if (!Array.isArray(value)) {
        throw new Error('Popis fotografija nije ispravan.');
    }

    const uniqueUrls = new Set<string>();
    for (const item of value) {
        if (typeof item !== 'string') {
            throw new Error('Popis fotografija nije ispravan.');
        }

        const imageUrl = item.trim();
        if (!imageUrl) {
            continue;
        }
        if (
            validateHostedImageUrl(imageUrl) ||
            !isScheduleTaskBlockerImageUrl(imageUrl, target)
        ) {
            throw new Error(
                'Fotografije prepreke moraju biti učitane kroz ovaj zadatak.',
            );
        }

        uniqueUrls.add(imageUrl);
    }

    if (uniqueUrls.size > MAX_SCHEDULE_TASK_BLOCKER_IMAGE_COUNT) {
        throw new Error(
            `Prepreka može imati najviše ${MAX_SCHEDULE_TASK_BLOCKER_IMAGE_COUNT} fotografija.`,
        );
    }

    return uniqueUrls.size > 0 ? Array.from(uniqueUrls) : undefined;
}

export async function assertScheduleTaskBlockerImagesStored(
    imageUrls: string[] | undefined,
    target: ScheduleTaskBlockerTarget,
    loadMetadata: ScheduleTaskBlockerImageMetadataLoader,
) {
    if (!imageUrls) {
        return;
    }

    const expectedPathPrefix = getScheduleTaskBlockerImagePathPrefix(target);
    const validationResults = await Promise.all(
        imageUrls.map(async (imageUrl) => {
            let metadata: ScheduleTaskBlockerImageMetadata;
            try {
                metadata = await loadMetadata(imageUrl);
            } catch {
                return {
                    imageUrl,
                    message:
                        'Fotografija prepreke nije pronađena. Učitaj je ponovno.',
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
                        'Dokaz prepreke mora biti postojeća fotografija učitana kroz ovaj zadatak.',
                };
            }

            return { imageUrl, message: null };
        }),
    );
    const invalidResults = validationResults.filter(
        (result) => result.message !== null,
    );
    if (invalidResults.length > 0) {
        throw new ScheduleTaskBlockerImagesValidationError(
            invalidResults[0]?.message ??
                'Fotografija prepreke nije dostupna. Učitaj je ponovno.',
            invalidResults.map((result) => result.imageUrl),
        );
    }
}
