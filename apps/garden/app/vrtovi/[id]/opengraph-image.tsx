import { clientPublic, directoriesClient } from '@gredice/client';
import { getBlockImageUrl } from '@gredice/ui/BlockImage';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import {
    GardenDisplay2D,
    type GardenDisplay2DProps,
    getGardenDisplayBlockImageKey,
    getGardenDisplayRotationSuffix,
    getGardenDisplayViewportOffset,
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
const gardenOgImageAssetBaseUrl = 'https://vrt.gredice.com';
const gardenOgViewportSize = 1200;
const gardenOgViewportCenter = { x: 576, y: 184 };
const gardenOgDefaultBlockSize = 128;
const gardenOgDefaultViewportOffset = { x: 24, y: 630 / 2 + 24 * 2 + 106 / 2 };

type GardenOgStacks = GardenDisplay2DProps['garden']['stacks'];
type GardenOgHomeCamera = {
    target: [x: number, y: number, z: number];
    zoom: number;
} | null;

const spritePngDataUrlBySrc = new Map<string, Promise<string>>();

export function getGardenOgBlockSpriteRequests(stacks: GardenOgStacks) {
    const requests = new Map<string, string>();

    for (const rows of Object.values(stacks)) {
        for (const blocks of Object.values(rows)) {
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

async function getPngDataUrlForSprite(src: string) {
    const absoluteSrc = new URL(src, gardenOgImageAssetBaseUrl).toString();

    if (!spritePngDataUrlBySrc.has(absoluteSrc)) {
        spritePngDataUrlBySrc.set(
            absoluteSrc,
            (async () => {
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
        console.error(error);
        return absoluteSrc;
    });
}

async function getGardenOgBlockImageSrcByKey(stacks: GardenOgStacks) {
    return new Map(
        await Promise.all(
            getGardenOgBlockSpriteRequests(stacks).map(
                async ({ key, src }) =>
                    [key, await getPngDataUrlForSprite(src)] as const,
            ),
        ),
    );
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
    if (gardenResponse.status === 400 || gardenResponse.status === 404) {
        console.error(`Garden with ID ${gardenId} not found`);
        return null;
    }
    const garden = await gardenResponse.json();

    const blockData = (await directoriesClient().GET('/entities/block')).data;
    if (!blockData) {
        console.error(`Block data not found`);
        return null;
    }
    const blockImageSrcByKey = await getGardenOgBlockImageSrcByKey(
        garden.stacks,
    );
    const viewportOffset = getGardenOgViewportOffset(garden.homeCamera);
    const blockSize = getGardenOgBlockSize(garden.homeCamera);

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
                    blockImageSrcByKey={blockImageSrcByKey}
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
            },
        },
    );
}
