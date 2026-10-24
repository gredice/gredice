import { createHash } from 'node:crypto';
import { gardenPreviewMinimumUploadIntervalMs } from '@gredice/js/gardenPreviews';

export type GardenPreviewRevisionInput = {
    backgroundPalette: unknown;
    farmId: unknown;
    homeCamera: unknown;
    isSandbox: unknown;
    latitude: unknown;
    longitude: unknown;
    raisedBeds: unknown;
    stacks: unknown;
};

export type GardenPreviewSourceAccessInput = {
    gardenAccountId: string;
    gardenIsPublic: boolean;
    requestAccountId: string;
    requestRole: string;
};

type GardenPreviewUploadCandidate = {
    capturedAt: Date;
    height: number;
    rendererVersion: string;
    sourceRevision: string;
    width: number;
};

type GardenPreviewUploadDecision<TPreview> =
    | { status: 'proceed' }
    | { preview: TPreview; status: 'unchanged' }
    | { retryAfterSeconds: number; status: 'rate-limited' };

export function getGardenPreviewUploadDecision<
    TPreview extends GardenPreviewUploadCandidate,
>({
    currentPreview,
    height,
    now = new Date(),
    rendererVersion,
    sourceRevision,
    width,
}: {
    currentPreview: TPreview | null | undefined;
    height: number;
    now?: Date;
    rendererVersion: string;
    sourceRevision: string;
    width: number;
}): GardenPreviewUploadDecision<TPreview> {
    if (
        currentPreview?.sourceRevision === sourceRevision &&
        currentPreview.rendererVersion === rendererVersion &&
        currentPreview.width === width &&
        currentPreview.height === height
    ) {
        return { preview: currentPreview, status: 'unchanged' };
    }

    if (currentPreview?.rendererVersion === rendererVersion) {
        const elapsedMs = Math.max(
            0,
            now.getTime() - currentPreview.capturedAt.getTime(),
        );
        const remainingMs = gardenPreviewMinimumUploadIntervalMs - elapsedMs;
        if (remainingMs > 0) {
            return {
                retryAfterSeconds: Math.ceil(remainingMs / 1000),
                status: 'rate-limited',
            };
        }
    }

    return { status: 'proceed' };
}

/**
 * Garden owners may capture any of their gardens. Administrators may also
 * capture another account's garden, but only while it is publicly visible.
 */
export function canAccessGardenPreviewSource({
    gardenAccountId,
    gardenIsPublic,
    requestAccountId,
    requestRole,
}: GardenPreviewSourceAccessInput) {
    return (
        gardenAccountId === requestAccountId ||
        (requestRole === 'admin' && gardenIsPublic)
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareRecordValues(
    left: Record<string, unknown>,
    right: Record<string, unknown>,
    keys: string[],
) {
    for (const key of keys) {
        const leftValue = left[key];
        const rightValue = right[key];
        if (typeof leftValue === 'number' && typeof rightValue === 'number') {
            if (leftValue !== rightValue) {
                return leftValue - rightValue;
            }
            continue;
        }

        const leftText = String(leftValue ?? '');
        const rightText = String(rightValue ?? '');
        const comparison = leftText.localeCompare(rightText);
        if (comparison !== 0) {
            return comparison;
        }
    }

    return 0;
}

function sortedRecordArray(value: unknown, keys: string[]): unknown[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return [...value].sort((left, right) => {
        if (!isRecord(left) || !isRecord(right)) {
            return 0;
        }
        return compareRecordValues(left, right, keys);
    });
}

function normalizeRaisedBeds(value: unknown) {
    return sortedRecordArray(value, ['id']).map((raisedBed) => {
        if (!isRecord(raisedBed)) {
            return raisedBed;
        }

        return {
            ...raisedBed,
            fields: sortedRecordArray(raisedBed.fields, [
                'positionIndex',
                'id',
            ]),
            appliedOperations: sortedRecordArray(raisedBed.appliedOperations, [
                'id',
            ]),
        };
    });
}

function canonicalJson(value: unknown): string {
    if (value === null) {
        return 'null';
    }
    if (value instanceof Date) {
        return JSON.stringify(value.toISOString());
    }

    switch (typeof value) {
        case 'boolean':
        case 'number':
        case 'string':
            return JSON.stringify(value);
        case 'undefined':
            return 'null';
        case 'object':
            if (Array.isArray(value)) {
                return `[${value.map(canonicalJson).join(',')}]`;
            }

            return `{${Object.entries(value)
                .filter(([, entryValue]) => entryValue !== undefined)
                .sort(([leftKey], [rightKey]) =>
                    leftKey.localeCompare(rightKey),
                )
                .map(
                    ([key, entryValue]) =>
                        `${JSON.stringify(key)}:${canonicalJson(entryValue)}`,
                )
                .join(',')}}`;
        default:
            return 'null';
    }
}

export function createGardenPreviewSourceRevision(
    input: GardenPreviewRevisionInput,
    referenceDate = new Date(),
) {
    const renderSource = {
        backgroundPalette: input.backgroundPalette,
        farmId: input.farmId,
        homeCamera: input.homeCamera,
        isSandbox: input.isSandbox,
        latitude: input.latitude,
        longitude: input.longitude,
        raisedBeds: normalizeRaisedBeds(input.raisedBeds),
        renderDay: referenceDate.toISOString().slice(0, 10),
        stacks: input.stacks,
    };

    return createHash('sha256')
        .update(canonicalJson(renderSource))
        .digest('hex');
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
    return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function uint16le(bytes: Uint8Array, offset: number) {
    return bytes[offset] | (bytes[offset + 1] << 8);
}

function uint24le(bytes: Uint8Array, offset: number) {
    return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function uint32le(bytes: Uint8Array, offset: number) {
    return (
        (bytes[offset] |
            (bytes[offset + 1] << 8) |
            (bytes[offset + 2] << 16) |
            (bytes[offset + 3] << 24)) >>>
        0
    );
}

export type GardenPreviewImageDimensions = {
    width: number;
    height: number;
};

const webpVp8xAnimationFlag = 0x02;

/** Returns dimensions only for a structurally valid, non-animated WebP. */
export function readWebpDimensions(
    bytes: Uint8Array,
): GardenPreviewImageDimensions | null {
    if (
        bytes.length < 20 ||
        ascii(bytes, 0, 4) !== 'RIFF' ||
        ascii(bytes, 8, 4) !== 'WEBP'
    ) {
        return null;
    }

    let chunkOffset = 12;
    let dimensions: GardenPreviewImageDimensions | null = null;
    let hasImageData = false;
    while (chunkOffset + 8 <= bytes.length) {
        const chunkType = ascii(bytes, chunkOffset, 4);
        const chunkLength = uint32le(bytes, chunkOffset + 4);
        const payloadOffset = chunkOffset + 8;
        if (payloadOffset + chunkLength > bytes.length) {
            return null;
        }

        if (chunkType === 'ANIM' || chunkType === 'ANMF') {
            return null;
        }

        if (chunkType === 'VP8X' && chunkLength >= 10) {
            if ((bytes[payloadOffset] & webpVp8xAnimationFlag) !== 0) {
                return null;
            }
            dimensions ??= {
                width: uint24le(bytes, payloadOffset + 4) + 1,
                height: uint24le(bytes, payloadOffset + 7) + 1,
            };
        }

        if (
            chunkType === 'VP8 ' &&
            chunkLength >= 10 &&
            bytes[payloadOffset + 3] === 0x9d &&
            bytes[payloadOffset + 4] === 0x01 &&
            bytes[payloadOffset + 5] === 0x2a
        ) {
            if (hasImageData) {
                return null;
            }
            const imageDimensions = {
                width: uint16le(bytes, payloadOffset + 6) & 0x3fff,
                height: uint16le(bytes, payloadOffset + 8) & 0x3fff,
            };
            if (
                dimensions &&
                (dimensions.width !== imageDimensions.width ||
                    dimensions.height !== imageDimensions.height)
            ) {
                return null;
            }
            dimensions = imageDimensions;
            hasImageData = true;
        }

        if (
            chunkType === 'VP8L' &&
            chunkLength >= 5 &&
            bytes[payloadOffset] === 0x2f
        ) {
            if (hasImageData) {
                return null;
            }
            const byte1 = bytes[payloadOffset + 1];
            const byte2 = bytes[payloadOffset + 2];
            const byte3 = bytes[payloadOffset + 3];
            const byte4 = bytes[payloadOffset + 4];

            const imageDimensions = {
                width: 1 + byte1 + ((byte2 & 0x3f) << 8),
                height:
                    1 + (byte2 >> 6) + (byte3 << 2) + ((byte4 & 0x0f) << 10),
            };
            if (
                dimensions &&
                (dimensions.width !== imageDimensions.width ||
                    dimensions.height !== imageDimensions.height)
            ) {
                return null;
            }
            dimensions = imageDimensions;
            hasImageData = true;
        }

        chunkOffset = payloadOffset + chunkLength + (chunkLength % 2);
    }

    return hasImageData ? dimensions : null;
}
