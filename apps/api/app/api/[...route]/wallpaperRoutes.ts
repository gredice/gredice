import { getGarden } from '@gredice/storage';
import type { HandleUploadBody } from '@vercel/blob/client';
import { Hono, type MiddlewareHandler } from 'hono';
import { describeRoute } from 'hono-openapi';
import { z } from 'zod';
import { authSecurity } from '../../../lib/docs/security';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';
import {
    type MacOSDynamicWallpaperPhase,
    macOSDynamicWallpaperPhases,
    macOSDynamicWallpaperSizes,
    readPngDimensions,
} from '../../../lib/wallpapers/macOSDynamicWallpaper';
import {
    deleteMacOSDynamicWallpaperBlobs,
    handleMacOSDynamicWallpaperUpload,
    type MacOSDynamicWallpaperUpload,
    macOSDynamicWallpaperEncryptionOverheadBytes,
    macOSDynamicWallpaperFramePathnames,
    macOSDynamicWallpaperMaximumFrameBytes,
    macOSDynamicWallpaperOutputPath,
    readMacOSDynamicWallpaperBlob,
    storeMacOSDynamicWallpaperBlob,
} from '../../../lib/wallpapers/macOSDynamicWallpaperBlobs';
import { encodeMacOSDynamicWallpaper } from '../../../lib/wallpapers/macOSDynamicWallpaperEncoder';
import {
    decryptMacOSDynamicWallpaperBytes,
    encryptMacOSDynamicWallpaperBytes,
} from '../../../lib/wallpapers/macOSDynamicWallpaperEncryption';
import {
    macOSDynamicWallpaperRateLimitAllows,
    macOSDynamicWallpaperRateLimitRetryAfterSeconds,
    macOSDynamicWallpaperUploadRateLimitAllows,
} from '../../../lib/wallpapers/macOSDynamicWallpaperRateLimit';

const maximumCombinedFrameBytes =
    macOSDynamicWallpaperMaximumFrameBytes * macOSDynamicWallpaperPhases.length;
const wallpaperRequestSchema = z
    .object({
        branding: z.enum(['clean', 'gredice']),
        conversionId: z.uuid(),
        encryptionKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        gardenId: z.number().int().positive(),
        size: z.enum(['fullHd', 'uhd', 'ultrawide']),
        template: z.literal('standard'),
    })
    .strict();

type WallpaperRequest = z.infer<typeof wallpaperRequestSchema>;
type WallpaperAuthValidator = (
    roles: string[],
) => MiddlewareHandler<{ Variables: AuthVariables }>;

export type WallpaperRouteDeps = {
    authValidator: WallpaperAuthValidator;
    createUpload(input: {
        authorize(upload: MacOSDynamicWallpaperUpload): Promise<void>;
        body: HandleUploadBody;
        request: Request;
    }): Promise<unknown>;
    deleteBlobs(pathnames: ReadonlyArray<string>): Promise<void>;
    encodeMacOSDynamicWallpaper(input: {
        frames: ReadonlyMap<MacOSDynamicWallpaperPhase, Uint8Array>;
    }): Promise<Uint8Array>;
    getGarden(gardenId: number): Promise<{ accountId: string } | null>;
    rateLimitAllows(accountId: string): Promise<boolean>;
    readBlob(pathname: string): Promise<{
        bytes: Uint8Array;
        contentType: string;
        size: number;
    } | null>;
    storeBlob(input: {
        bytes: Uint8Array;
        pathname: string;
    }): Promise<{ downloadUrl: string; pathname: string }>;
    uploadRateLimitAllows(accountId: string): Promise<boolean>;
};

const defaultDeps: WallpaperRouteDeps = {
    authValidator,
    createUpload: handleMacOSDynamicWallpaperUpload,
    deleteBlobs: deleteMacOSDynamicWallpaperBlobs,
    encodeMacOSDynamicWallpaper,
    getGarden,
    rateLimitAllows: macOSDynamicWallpaperRateLimitAllows,
    readBlob: readMacOSDynamicWallpaperBlob,
    storeBlob: storeMacOSDynamicWallpaperBlob,
    uploadRateLimitAllows: macOSDynamicWallpaperUploadRateLimitAllows,
};

function responseFileName({ branding, size, template }: WallpaperRequest) {
    return [
        'gredice-vrt',
        template,
        size,
        branding === 'gredice' ? 'potpis' : 'cista',
        'mac-dinamicka.heic',
    ].join('-');
}

function invalidRequest(error: string) {
    return { error };
}

function rateLimited(context: {
    header(name: string, value: string): void;
    json(body: { error: string }, status: 429): Response;
}) {
    context.header(
        'Retry-After',
        macOSDynamicWallpaperRateLimitRetryAfterSeconds.toString(),
    );
    return context.json(
        invalidRequest(
            'Previše HEIC izrada u kratkom vremenu. Pokušaj ponovno za nekoliko minuta.',
        ),
        429,
    );
}

function outputPath({
    accountId,
    request,
}: {
    accountId: string;
    request: WallpaperRequest;
}) {
    return macOSDynamicWallpaperOutputPath({
        accountId,
        conversionId: request.conversionId,
        fileName: responseFileName(request),
    });
}

async function deleteBlobsBestEffort(
    deps: WallpaperRouteDeps,
    pathnames: ReadonlyArray<string>,
    context: { accountId: string; conversionId: string },
) {
    try {
        await deps.deleteBlobs(pathnames);
    } catch (error) {
        console.warn('Unable to delete temporary macOS wallpaper blobs', {
            ...context,
            error,
        });
    }
}

export function createWallpaperRoutes(deps: WallpaperRouteDeps = defaultDeps) {
    return new Hono<{ Variables: AuthVariables }>()
        .post(
            '/macos-dynamic/uploads',
            describeRoute({
                description:
                    'Authorize a short-lived direct upload for one client-encrypted macOS wallpaper frame.',
                security: authSecurity,
            }),
            deps.authValidator(['user', 'admin']),
            async (context) => {
                let body: HandleUploadBody;
                try {
                    body = await context.req.json<HandleUploadBody>();
                } catch {
                    return context.json(
                        invalidRequest(
                            'Zahtjev za prijenos slike nije valjan.',
                        ),
                        400,
                    );
                }

                const { accountId } = context.get('authContext');
                try {
                    const result = await deps.createUpload({
                        body,
                        request: context.req.raw,
                        authorize: async (upload) => {
                            const garden = await deps.getGarden(
                                upload.gardenId,
                            );
                            if (!garden || garden.accountId !== accountId) {
                                throw new Error('Garden not found');
                            }
                            if (
                                !(await deps.uploadRateLimitAllows(accountId))
                            ) {
                                throw new Error('Upload rate limit exceeded');
                            }
                        },
                    });
                    return context.json(result);
                } catch (error) {
                    console.warn(
                        'macOS wallpaper upload authorization failed',
                        {
                            accountId,
                            error,
                        },
                    );
                    return context.json(
                        invalidRequest(
                            'Prijenos slike za HEIC pozadinu nije odobren.',
                        ),
                        400,
                    );
                }
            },
        )
        .post(
            '/macos-dynamic',
            describeRoute({
                description:
                    'Convert four authenticated, client-encrypted garden wallpaper frames into a native macOS dynamic HEIC download. Temporary encrypted blobs are deleted after conversion or download and by a scheduled expiry cleanup.',
                security: authSecurity,
            }),
            deps.authValidator(['user', 'admin']),
            async (context) => {
                let requestBody: unknown;
                try {
                    requestBody = await context.req.json();
                } catch {
                    return context.json(
                        invalidRequest('Zahtjev za HEIC pozadinu nije valjan.'),
                        400,
                    );
                }

                const request = wallpaperRequestSchema.safeParse(requestBody);
                if (!request.success) {
                    return context.json(
                        invalidRequest('Postavke HEIC pozadine nisu valjane.'),
                        400,
                    );
                }

                const { accountId } = context.get('authContext');
                const garden = await deps.getGarden(request.data.gardenId);
                if (!garden || garden.accountId !== accountId) {
                    return context.json(
                        invalidRequest('Garden not found'),
                        404,
                    );
                }

                const framePathnames = macOSDynamicWallpaperFramePathnames(
                    request.data,
                );
                const inputPathnames = [...framePathnames.values()];
                if (!(await deps.rateLimitAllows(accountId))) {
                    await deleteBlobsBestEffort(deps, inputPathnames, {
                        accountId,
                        conversionId: request.data.conversionId,
                    });
                    return rateLimited(context);
                }

                try {
                    const dimensions =
                        macOSDynamicWallpaperSizes[request.data.size];
                    const frames = new Map<
                        MacOSDynamicWallpaperPhase,
                        Uint8Array
                    >();
                    let totalBytes = 0;

                    for (const phase of macOSDynamicWallpaperPhases) {
                        const pathname = framePathnames.get(phase);
                        if (!pathname) {
                            return context.json(
                                invalidRequest(
                                    `PNG slika za doba dana ${phase} nije valjana.`,
                                ),
                                400,
                            );
                        }
                        const frame = await deps.readBlob(pathname);
                        if (
                            frame?.contentType !== 'application/octet-stream' ||
                            frame.size === 0 ||
                            frame.size >
                                macOSDynamicWallpaperMaximumFrameBytes +
                                    macOSDynamicWallpaperEncryptionOverheadBytes ||
                            frame.bytes.byteLength !== frame.size
                        ) {
                            return context.json(
                                invalidRequest(
                                    `PNG slika za doba dana ${phase} nije valjana.`,
                                ),
                                400,
                            );
                        }

                        let decryptedFrame: Uint8Array;
                        try {
                            decryptedFrame = decryptMacOSDynamicWallpaperBytes({
                                bytes: frame.bytes,
                                encodedKey: request.data.encryptionKey,
                                pathname,
                            });
                        } catch {
                            return context.json(
                                invalidRequest(
                                    `PNG slika za doba dana ${phase} nije valjana.`,
                                ),
                                400,
                            );
                        }
                        if (
                            decryptedFrame.byteLength === 0 ||
                            decryptedFrame.byteLength >
                                macOSDynamicWallpaperMaximumFrameBytes
                        ) {
                            return context.json(
                                invalidRequest(
                                    `PNG slika za doba dana ${phase} nije valjana.`,
                                ),
                                400,
                            );
                        }

                        totalBytes += decryptedFrame.byteLength;
                        if (totalBytes > maximumCombinedFrameBytes) {
                            return context.json(
                                invalidRequest(
                                    'Datoteke pozadine su prevelike.',
                                ),
                                413,
                            );
                        }

                        const actualDimensions =
                            readPngDimensions(decryptedFrame);
                        if (
                            !actualDimensions ||
                            actualDimensions.width !== dimensions.width ||
                            actualDimensions.height !== dimensions.height
                        ) {
                            return context.json(
                                invalidRequest(
                                    `PNG slike moraju biti veličine ${dimensions.width.toString()} × ${dimensions.height.toString()}.`,
                                ),
                                400,
                            );
                        }
                        frames.set(phase, decryptedFrame);
                    }

                    const heic = await deps.encodeMacOSDynamicWallpaper({
                        frames,
                    });
                    const fileName = responseFileName(request.data);
                    const pathname = outputPath({
                        accountId,
                        request: request.data,
                    });
                    const stored = await deps.storeBlob({
                        bytes: encryptMacOSDynamicWallpaperBytes({
                            bytes: heic,
                            encodedKey: request.data.encryptionKey,
                            pathname,
                        }),
                        pathname,
                    });
                    return context.json(
                        {
                            downloadUrl: stored.downloadUrl,
                            fileName,
                            pathname: stored.pathname,
                        },
                        200,
                        { 'Cache-Control': 'private, no-store' },
                    );
                } catch (error) {
                    console.error('macOS wallpaper conversion failed', {
                        accountId,
                        error,
                        gardenId: request.data.gardenId,
                    });
                    return context.json(
                        invalidRequest(
                            'Dinamička HEIC pozadina trenutačno nije dostupna. Pokušaj ponovno.',
                        ),
                        503,
                    );
                } finally {
                    await deleteBlobsBestEffort(deps, inputPathnames, {
                        accountId,
                        conversionId: request.data.conversionId,
                    });
                }
            },
        )
        .delete(
            '/macos-dynamic',
            describeRoute({
                description:
                    'Delete temporary encrypted macOS wallpaper inputs and output after the browser finishes downloading.',
                security: authSecurity,
            }),
            deps.authValidator(['user', 'admin']),
            async (context) => {
                const request = wallpaperRequestSchema.safeParse(
                    await context.req.json().catch(() => null),
                );
                if (!request.success) {
                    return context.json(
                        invalidRequest('Zahtjev za brisanje nije valjan.'),
                        400,
                    );
                }

                const { accountId } = context.get('authContext');
                const garden = await deps.getGarden(request.data.gardenId);
                if (!garden || garden.accountId !== accountId) {
                    return context.json(
                        invalidRequest('Garden not found'),
                        404,
                    );
                }

                await deps.deleteBlobs([
                    ...macOSDynamicWallpaperFramePathnames(
                        request.data,
                    ).values(),
                    outputPath({ accountId, request: request.data }),
                ]);
                return context.body(null, 204);
            },
        );
}

export default createWallpaperRoutes();
