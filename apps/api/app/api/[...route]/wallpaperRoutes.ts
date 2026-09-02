import { getGarden } from '@gredice/storage';
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
import { encodeMacOSDynamicWallpaper } from '../../../lib/wallpapers/macOSDynamicWallpaperEncoder';
import {
    macOSDynamicWallpaperRateLimitAllows,
    macOSDynamicWallpaperRateLimitRetryAfterSeconds,
} from '../../../lib/wallpapers/macOSDynamicWallpaperRateLimit';

const maximumFrameBytes = 25 * 1_024 * 1_024;
const maximumRequestBytes = 100 * 1_024 * 1_024;
const wallpaperRequestSchema = z
    .object({
        branding: z.enum(['clean', 'gredice']),
        gardenId: z.coerce.number().int().positive(),
        size: z.enum(['fullHd', 'uhd', 'ultrawide']),
        template: z.enum(['minimal', 'standard']),
    })
    .strict();

type WallpaperAuthValidator = (
    roles: string[],
) => MiddlewareHandler<{ Variables: AuthVariables }>;

export type WallpaperRouteDeps = {
    authValidator: WallpaperAuthValidator;
    encodeMacOSDynamicWallpaper(input: {
        frames: ReadonlyMap<MacOSDynamicWallpaperPhase, Uint8Array>;
    }): Promise<Uint8Array>;
    getGarden(gardenId: number): Promise<{ accountId: string } | null>;
    rateLimitAllows(accountId: string): Promise<boolean>;
};

const defaultDeps: WallpaperRouteDeps = {
    authValidator,
    encodeMacOSDynamicWallpaper,
    getGarden,
    rateLimitAllows: macOSDynamicWallpaperRateLimitAllows,
};

function responseFileName({
    branding,
    size,
    template,
}: z.infer<typeof wallpaperRequestSchema>) {
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

function fileFromFormData(formData: FormData, phase: string) {
    const value = formData.get(phase);
    return value instanceof File ? value : null;
}

export function createWallpaperRoutes(deps: WallpaperRouteDeps = defaultDeps) {
    return new Hono<{ Variables: AuthVariables }>().post(
        '/macos-dynamic',
        describeRoute({
            description:
                'Convert four authenticated garden wallpaper PNG frames into a native macOS dynamic HEIC download. Inputs and output are processed transiently and are not retained.',
            security: authSecurity,
        }),
        deps.authValidator(['user', 'admin']),
        async (context) => {
            const declaredLength = Number.parseInt(
                context.req.header('content-length') ?? '0',
                10,
            );
            if (
                Number.isFinite(declaredLength) &&
                declaredLength > maximumRequestBytes
            ) {
                return context.json(
                    invalidRequest('Datoteke pozadine su prevelike.'),
                    413,
                );
            }

            let formData: FormData;
            try {
                formData = await context.req.raw.formData();
            } catch {
                return context.json(
                    invalidRequest('Zahtjev za HEIC pozadinu nije valjan.'),
                    400,
                );
            }

            const request = wallpaperRequestSchema.safeParse({
                branding: formData.get('branding'),
                gardenId: formData.get('gardenId'),
                size: formData.get('size'),
                template: formData.get('template'),
            });
            if (!request.success) {
                return context.json(
                    invalidRequest('Postavke HEIC pozadine nisu valjane.'),
                    400,
                );
            }

            const { accountId } = context.get('authContext');
            const garden = await deps.getGarden(request.data.gardenId);
            if (!garden || garden.accountId !== accountId) {
                return context.json(invalidRequest('Garden not found'), 404);
            }

            const dimensions = macOSDynamicWallpaperSizes[request.data.size];
            const frames = new Map<MacOSDynamicWallpaperPhase, Uint8Array>();
            let totalBytes = 0;
            for (const phase of macOSDynamicWallpaperPhases) {
                const file = fileFromFormData(formData, phase);
                if (
                    file?.type !== 'image/png' ||
                    file.size === 0 ||
                    file.size > maximumFrameBytes
                ) {
                    return context.json(
                        invalidRequest(
                            `PNG slika za doba dana ${phase} nije valjana.`,
                        ),
                        400,
                    );
                }

                totalBytes += file.size;
                if (totalBytes > maximumRequestBytes) {
                    return context.json(
                        invalidRequest('Datoteke pozadine su prevelike.'),
                        413,
                    );
                }

                const bytes = new Uint8Array(await file.arrayBuffer());
                const actualDimensions = readPngDimensions(bytes);
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
                frames.set(phase, bytes);
            }

            if (!(await deps.rateLimitAllows(accountId))) {
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

            try {
                const heic = await deps.encodeMacOSDynamicWallpaper({ frames });
                return context.body(new Uint8Array(heic), 200, {
                    'Cache-Control': 'private, no-store',
                    'Content-Disposition': `attachment; filename="${responseFileName(request.data)}"`,
                    'Content-Length': heic.byteLength.toString(),
                    'Content-Type': 'image/heic',
                    'X-Content-Type-Options': 'nosniff',
                });
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
            }
        },
    );
}

export default createWallpaperRoutes();
