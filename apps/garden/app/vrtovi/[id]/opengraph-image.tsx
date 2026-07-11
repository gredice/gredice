import { clientPublic, directoriesClient } from '@gredice/client';
import { getBlockImageUrl } from '@gredice/ui/BlockImage';
import { ImageResponse } from 'next/og';
import type sharp from 'sharp';
import {
    GardenDisplay2D,
    type GardenDisplay2DProps,
    getGardenDisplayBlockImageKey,
    getGardenDisplayProjectedPosition,
    getGardenDisplayRotationSuffix,
    getGardenDisplayViewportOffset,
    getGardenDisplayViewportPosition,
} from '../../../components/GardenDisplay2D';
import { Logotype } from '../../../components/Logotype';

export const size = {
    width: 1200,
    height: 630,
};
export const dynamic = 'force-dynamic';
export const contentType = 'image/png';
export const maxDuration = 10;
export const runtime = 'nodejs';

const gardenOgImageCacheControl =
    'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400';
const gardenOgFallbackCacheControl = 'no-store';
const gardenOgRenderHeader = 'X-Gredice-Garden-Preview';
const gardenOgImageAssetBaseUrl = 'https://vrt.gredice.com';
const gardenOgViewportSize = 1200;
const gardenOgViewportCenter = { x: 576, y: 184 };
const gardenOgDefaultBlockSize = 128;
const gardenOgDefaultViewportOffset = { x: 24, y: 630 / 2 + 24 * 2 + 106 / 2 };
const transparentPngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+4N1vWQAAAABJRU5ErkJggg==';

type GardenOgStacks = GardenDisplay2DProps['garden']['stacks'];
type GardenOgHomeCamera = {
    target: [x: number, y: number, z: number];
    zoom: number;
} | null;

const spritePngDataUrlBySrc = new Map<string, Promise<string>>();
type SharpFactory = typeof sharp;
let sharpModulePromise: Promise<SharpFactory> | undefined;

export function getGardenOgBlockSpriteRequests(
    stacks: GardenOgStacks,
    viewport?: {
        blockSize: number;
        viewportOffset: { x: number; y: number };
        viewportSize: number;
    },
) {
    const requests = new Map<string, string>();

    for (const [x, rows] of Object.entries(stacks)) {
        for (const [y, blocks] of Object.entries(rows)) {
            if (viewport) {
                const projectedPosition = getGardenDisplayProjectedPosition({
                    blockSize: viewport.blockSize,
                    position: { x: Number(x), y: Number(y) },
                    viewportSize: viewport.viewportSize,
                });
                const viewportPosition = getGardenDisplayViewportPosition({
                    projectedPosition,
                    viewportOffset: viewport.viewportOffset,
                });
                const visibilityMargin = viewport.blockSize * 1.5;
                if (
                    viewportPosition.top + visibilityMargin <= 0 ||
                    viewportPosition.left + visibilityMargin <= 0 ||
                    viewportPosition.top - visibilityMargin >=
                        viewport.viewportSize ||
                    viewportPosition.left - visibilityMargin >=
                        viewport.viewportSize
                ) {
                    continue;
                }
            }

            for (const block of blocks) {
                const rotationSuffix = getGardenDisplayRotationSuffix(
                    block.rotation,
                );
                const key = getGardenDisplayBlockImageKey(
                    block.name,
                    rotationSuffix,
                );
                const src = getBlockImageUrl(block.name, { rotationSuffix });
                if (src) {
                    requests.set(key, src);
                }
            }
        }
    }

    return [...requests].map(([key, src]) => ({ key, src }));
}

function isSharpFactory(value: unknown): value is SharpFactory {
    return typeof value === 'function';
}

function resolveSharpFactory(value: unknown): SharpFactory | undefined {
    if (isSharpFactory(value)) {
        return value;
    }

    if (typeof value !== 'object' || value === null || !('default' in value)) {
        return undefined;
    }

    return resolveSharpFactory(value.default);
}

async function loadSharp() {
    const sharpModule: unknown = await import('sharp');
    const sharpFactory = resolveSharpFactory(sharpModule);
    if (!sharpFactory) {
        throw new Error('Sharp module does not expose a default factory');
    }

    return sharpFactory;
}

async function getSharp() {
    const currentPromise = sharpModulePromise ?? loadSharp();
    sharpModulePromise = currentPromise;

    try {
        return await currentPromise;
    } catch (error) {
        if (sharpModulePromise === currentPromise) {
            sharpModulePromise = undefined;
        }
        throw error;
    }
}

async function getPngDataUrlForSprite(src: string) {
    const absoluteSrc = new URL(src, gardenOgImageAssetBaseUrl).toString();

    if (!spritePngDataUrlBySrc.has(absoluteSrc)) {
        spritePngDataUrlBySrc.set(
            absoluteSrc,
            (async () => {
                const sharp = await getSharp();
                const response = await fetch(absoluteSrc);
                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch garden OG sprite ${absoluteSrc}: ${response.status.toString()}`,
                    );
                }

                const png = await sharp(
                    Buffer.from(await response.arrayBuffer()),
                )
                    .png()
                    .toBuffer();

                return `data:image/png;base64,${png.toString('base64')}`;
            })(),
        );
    }

    const sprite = spritePngDataUrlBySrc.get(absoluteSrc);
    if (!sprite) {
        return absoluteSrc;
    }

    return sprite.catch((error: unknown) => {
        if (spritePngDataUrlBySrc.get(absoluteSrc) === sprite) {
            spritePngDataUrlBySrc.delete(absoluteSrc);
        }
        console.error(error);
        return null;
    });
}

async function getGardenOgBlockImageSrcByKey(
    requests: ReturnType<typeof getGardenOgBlockSpriteRequests>,
) {
    const resolvedSprites = await Promise.all(
        requests.map(async ({ key, src }) => ({
            key,
            src: await getPngDataUrlForSprite(src),
        })),
    );

    return {
        failedSpriteCount: resolvedSprites.filter(({ src }) => !src).length,
        imageSrcByKey: new Map(
            resolvedSprites.map(({ key, src }) => [
                key,
                src ?? transparentPngDataUrl,
            ]),
        ),
    };
}

function clampGardenOgZoomScale(zoom: number) {
    return Math.min(1.5, Math.max(0.7, zoom / 100));
}

function getGardenOgBlockSize(homeCamera: GardenOgHomeCamera) {
    return homeCamera
        ? gardenOgDefaultBlockSize * clampGardenOgZoomScale(homeCamera.zoom)
        : gardenOgDefaultBlockSize;
}

function getGardenOgViewportOffset(homeCamera: GardenOgHomeCamera) {
    if (!homeCamera) {
        return gardenOgDefaultViewportOffset;
    }

    return getGardenDisplayViewportOffset({
        blockSize: getGardenOgBlockSize(homeCamera),
        focus: { x: homeCamera.target[0], y: homeCamera.target[2] },
        viewportCenter: gardenOgViewportCenter,
        viewportSize: gardenOgViewportSize,
    });
}

function createGardenOgFallbackImage(gardenName: string) {
    return new ImageResponse(
        <div
            style={{
                alignItems: 'center',
                background: 'linear-gradient(145deg, #eff3cf, #b9d48d)',
                color: '#2E6F40',
                display: 'flex',
                height: '100%',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
                width: '100%',
            }}
        >
            <div
                style={{
                    background: '#79ad64',
                    borderRadius: 999,
                    display: 'flex',
                    height: 260,
                    position: 'absolute',
                    right: -40,
                    top: -70,
                    width: 260,
                }}
            />
            <div
                style={{
                    background: '#593a2a',
                    border: '24px solid #a86f4d',
                    borderRadius: 54,
                    boxShadow: '0 24px 42px rgba(42, 28, 15, 0.18)',
                    display: 'flex',
                    height: 250,
                    left: 170,
                    position: 'absolute',
                    top: 120,
                    transform: 'rotate(-5deg)',
                    width: 660,
                }}
            >
                <div
                    style={{
                        alignItems: 'center',
                        color: '#8fca62',
                        display: 'flex',
                        fontSize: 108,
                        height: '100%',
                        justifyContent: 'center',
                        letterSpacing: 24,
                        width: '100%',
                    }}
                >
                    • • • • •
                </div>
            </div>
            <div
                style={{
                    alignItems: 'center',
                    background: 'rgba(254, 250, 246, 0.94)',
                    bottom: 0,
                    display: 'flex',
                    height: 116,
                    justifyContent: 'space-between',
                    left: 0,
                    padding: '0 42px',
                    position: 'absolute',
                    right: 0,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        fontSize: 42,
                        maxWidth: 820,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {gardenName}
                </div>
                <Logotype width={220} color="#2E6F40" />
            </div>
        </div>,
        {
            ...size,
            headers: {
                'Cache-Control': gardenOgFallbackCacheControl,
                [gardenOgRenderHeader]: 'fallback',
            },
        },
    );
}

export default async function GardenOgImage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: gardenId } = await params;
    if (!gardenId) {
        return new Response('Garden ID is required', { status: 400 });
    }

    const gardenResponse = await clientPublic().api.gardens[
        ':gardenId'
    ].public.$get({
        param: {
            gardenId: gardenId.toString(),
        },
    });
    if (!gardenResponse.ok) {
        console.error(`Garden with ID ${gardenId} not found`);
        return new Response('Garden not found', {
            status:
                gardenResponse.status === 400 || gardenResponse.status === 404
                    ? gardenResponse.status
                    : 502,
        });
    }
    const garden = await gardenResponse.json();

    const blockData = (await directoriesClient().GET('/entities/block')).data;
    if (!blockData) {
        console.error(`Block data not found`);
        return createGardenOgFallbackImage(garden.name);
    }
    const viewportOffset = getGardenOgViewportOffset(garden.homeCamera);
    const blockSize = getGardenOgBlockSize(garden.homeCamera);
    const spriteRequests = getGardenOgBlockSpriteRequests(garden.stacks, {
        blockSize,
        viewportOffset,
        viewportSize: gardenOgViewportSize,
    });
    const { failedSpriteCount, imageSrcByKey } =
        await getGardenOgBlockImageSrcByKey(spriteRequests);
    if (
        spriteRequests.length === 0 ||
        failedSpriteCount === spriteRequests.length
    ) {
        console.error('Garden OG preview could not render any block sprites', {
            failedSpriteCount,
            gardenId,
            spriteRequestCount: spriteRequests.length,
        });
        return createGardenOgFallbackImage(garden.name);
    }

    return new ImageResponse(
        <div
            style={{
                fontSize: 36,
                background: '#fefaf6',
                color: 'white',
                width: '100%',
                height: '100%',
                display: 'flex',
                position: 'relative',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    left: 24,
                    right: 24,
                    top: 24,
                    bottom: 106,
                    display: 'flex',
                    border: '1px solid #2a1c0f26',
                    background: '#E7E2CC',
                    borderRadius: 32,
                    overflow: 'hidden',
                    boxShadow: '0px 10px 24px 0px rgba(0,0,0,0.1)',
                }}
            >
                <GardenDisplay2D
                    garden={garden}
                    blockData={blockData}
                    blockImageSrcByKey={imageSrcByKey}
                    blockSize={blockSize}
                    viewportSize={gardenOgViewportSize}
                    viewportOffset={viewportOffset}
                    style={{
                        marginLeft: 0,
                        display: 'flex',
                        width: gardenOgViewportSize,
                        height: 630,
                    }}
                />
            </div>
            <div
                style={{
                    position: 'absolute',
                    bottom: 24,
                    left: 32,
                    right: 32,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 32,
                    justifyContent: 'space-between',
                }}
            >
                <div
                    style={{
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        color: '#2E6F40',
                    }}
                >
                    {garden.name}
                </div>
                <Logotype width={220} color={'#2E6F40'} />
            </div>
        </div>,
        {
            width: 1200,
            height: 630,
            headers: {
                'Cache-Control': gardenOgImageCacheControl,
                [gardenOgRenderHeader]: 'rendered',
            },
        },
    );
}
