import sharp from 'sharp';
import { sanitizePublicOgImageUrl } from './publicMetadata.ts';

type SupportedImageFormat = 'jpeg' | 'png' | 'webp';

const allowedContentTypes = new Map<string, SupportedImageFormat>([
    ['image/jpeg', 'jpeg'],
    ['image/jpg', 'jpeg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
] as const);
const maximumSourceBytes = 5 * 1024 * 1024;
const maximumOutputBytes = 2 * 1024 * 1024;
const maximumInputPixels = 20_000_000;
const maximumOutputDimension = 800;
const requestTimeoutMilliseconds = 4_000;

type PublicOgImageFetcher = (
    input: string,
    init: RequestInit,
) => Promise<Response>;

function contentType(response: Response) {
    return response.headers
        .get('content-type')
        ?.split(';', 1)[0]
        ?.toLowerCase();
}

function declaredContentLength(response: Response) {
    const value = response.headers.get('content-length');
    if (!value) {
        return undefined;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

async function readBoundedResponseBody(response: Response) {
    if (!response.body) {
        return undefined;
    }

    const declaredLength = declaredContentLength(response);
    if (declaredLength !== undefined && declaredLength > maximumSourceBytes) {
        await response.body.cancel();
        return undefined;
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const reader = response.body.getReader();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            totalBytes += value.byteLength;
            if (totalBytes > maximumSourceBytes) {
                await reader.cancel();
                return undefined;
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }

    if (totalBytes === 0) {
        return undefined;
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return bytes;
}

function sniffImageFormat(bytes: Uint8Array): SupportedImageFormat | undefined {
    if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
    ) {
        return 'png';
    }

    if (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
    ) {
        return 'jpeg';
    }

    if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    ) {
        return 'webp';
    }

    return undefined;
}

async function convertToPngDataUrl(
    bytes: Uint8Array,
    expectedFormat: SupportedImageFormat,
) {
    if (sniffImageFormat(bytes) !== expectedFormat) {
        return undefined;
    }

    const image = sharp(bytes, {
        failOn: 'warning',
        limitInputPixels: maximumInputPixels,
        sequentialRead: true,
    });
    const metadata = await image.metadata();

    if (
        metadata.format !== expectedFormat ||
        !metadata.width ||
        !metadata.height
    ) {
        return undefined;
    }

    const converted = await image
        .rotate()
        .resize({
            width: maximumOutputDimension,
            height: maximumOutputDimension,
            fit: 'inside',
            withoutEnlargement: true,
        })
        .png({
            compressionLevel: 9,
            palette: true,
            quality: 90,
        })
        .toBuffer();

    if (converted.byteLength > maximumOutputBytes) {
        return undefined;
    }

    return `data:image/png;base64,${converted.toString('base64')}`;
}

export async function resolvePublicOgImageDataUrl(
    imageUrl: string | null | undefined,
    fetcher: PublicOgImageFetcher = fetch,
) {
    const currentUrl = sanitizePublicOgImageUrl(imageUrl);
    if (!currentUrl) {
        return undefined;
    }

    const signal = AbortSignal.timeout(requestTimeoutMilliseconds);

    try {
        const response = await fetcher(currentUrl, {
            headers: {
                Accept: 'image/webp,image/png,image/jpeg',
            },
            redirect: 'error',
            signal,
        });

        if (!response.ok) {
            await response.body?.cancel();
            return undefined;
        }

        const expectedFormat = allowedContentTypes.get(
            contentType(response) ?? '',
        );
        if (!expectedFormat) {
            await response.body?.cancel();
            return undefined;
        }

        const bytes = await readBoundedResponseBody(response);
        if (!bytes) {
            return undefined;
        }

        return await convertToPngDataUrl(bytes, expectedFormat);
    } catch {
        return undefined;
    }
}
