import 'server-only';
import { del, get, put } from '@vercel/blob';
import { type HandleUploadBody, handleUpload } from '@vercel/blob/client';
import { z } from 'zod';
import {
    type MacOSDynamicWallpaperPhase,
    macOSDynamicWallpaperPhases,
} from './macOSDynamicWallpaper';

export const macOSDynamicWallpaperBlobPrefix = 'wallpapers/macos-dynamic/';
const uploadTokenLifetimeMs = 10 * 60 * 1_000;
export const macOSDynamicWallpaperMaximumFrameBytes = 25 * 1_024 * 1_024;
export const macOSDynamicWallpaperEncryptionOverheadBytes = 29;

const uploadPayloadSchema = z
    .object({
        conversionId: z.uuid(),
        gardenId: z.number().int().positive(),
        phase: z.enum(macOSDynamicWallpaperPhases),
    })
    .strict();

export type MacOSDynamicWallpaperUpload = z.infer<typeof uploadPayloadSchema>;

export function macOSDynamicWallpaperInputPath({
    conversionId,
    gardenId,
    phase,
}: MacOSDynamicWallpaperUpload) {
    return `${macOSDynamicWallpaperBlobPrefix}input/${gardenId.toString()}/${conversionId}/${phase}.bin`;
}

export function macOSDynamicWallpaperOutputPath({
    accountId,
    conversionId,
    fileName,
}: {
    accountId: string;
    conversionId: string;
    fileName: string;
}) {
    return `${macOSDynamicWallpaperBlobPrefix}output/${encodeURIComponent(accountId)}/${conversionId}/${fileName}.bin`;
}

export function parseMacOSDynamicWallpaperUpload(
    pathname: string,
    clientPayload: string | null,
) {
    if (!clientPayload) {
        throw new Error('Wallpaper upload payload is required');
    }

    let parsedPayload: unknown;
    try {
        parsedPayload = JSON.parse(clientPayload);
    } catch {
        throw new Error('Invalid wallpaper upload payload');
    }

    const upload = uploadPayloadSchema.safeParse(parsedPayload);
    if (
        !upload.success ||
        pathname !== macOSDynamicWallpaperInputPath(upload.data)
    ) {
        throw new Error('Invalid wallpaper upload');
    }
    return upload.data;
}

export async function handleMacOSDynamicWallpaperUpload({
    authorize,
    body,
    request,
}: {
    authorize(upload: MacOSDynamicWallpaperUpload): Promise<void>;
    body: HandleUploadBody;
    request: Request;
}) {
    return handleUpload({
        body,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
            const upload = parseMacOSDynamicWallpaperUpload(
                pathname,
                clientPayload,
            );
            await authorize(upload);
            return {
                addRandomSuffix: false,
                allowOverwrite: false,
                allowedContentTypes: ['application/octet-stream'],
                cacheControlMaxAge: 60,
                maximumSizeInBytes:
                    macOSDynamicWallpaperMaximumFrameBytes +
                    macOSDynamicWallpaperEncryptionOverheadBytes,
                tokenPayload: null,
                validUntil: Date.now() + uploadTokenLifetimeMs,
            };
        },
        request,
    });
}

export async function readMacOSDynamicWallpaperBlob(pathname: string) {
    const result = await get(pathname, {
        access: 'public',
        useCache: false,
    });
    if (result?.statusCode !== 200) {
        return null;
    }

    const bytes = new Uint8Array(
        await new Response(result.stream).arrayBuffer(),
    );
    return {
        bytes,
        contentType: result.blob.contentType,
        size: bytes.byteLength,
    };
}

export async function storeMacOSDynamicWallpaperBlob({
    bytes,
    pathname,
}: {
    bytes: Uint8Array;
    pathname: string;
}) {
    const stored = await put(pathname, Buffer.from(bytes), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: 60,
        contentType: 'application/octet-stream',
    });
    return { downloadUrl: stored.downloadUrl, pathname: stored.pathname };
}

export async function deleteMacOSDynamicWallpaperBlobs(
    pathnames: ReadonlyArray<string>,
) {
    const uniquePathnames = [...new Set(pathnames)];
    if (uniquePathnames.length > 0) {
        await del(uniquePathnames);
    }
}

export function macOSDynamicWallpaperFramePathnames({
    conversionId,
    gardenId,
}: {
    conversionId: string;
    gardenId: number;
}) {
    return new Map<MacOSDynamicWallpaperPhase, string>(
        macOSDynamicWallpaperPhases.map((phase) => [
            phase,
            macOSDynamicWallpaperInputPath({
                conversionId,
                gardenId,
                phase,
            }),
        ]),
    );
}
