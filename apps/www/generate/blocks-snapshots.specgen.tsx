import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { BlockData } from '@gredice/client';
import { getGardenBlockSpan } from '@gredice/js/gardenBlocks';
import { test } from '@playwright/experimental-ct-react';
import sharp from 'sharp';
import { allGameAssetNames } from '../../../packages/game/src/data/models';
import { gameQualityProfiles } from '../../../packages/game/src/scene/gameQuality';
import {
    getOrthographicSnapshotCamera,
    parseBlockSnapshotCameraView,
} from './blockSnapshotCamera';
// Load EntityViewer through a lazy wrapper (not the @gredice/game barrel) so the
// component-test bundle does not pull in GameSceneDynamic -> next/dynamic, and
// resolves three.js deps through a dynamic chunk that Rollup can build.
import { EntitySnapshotViewer } from './EntitySnapshotViewer';

// Snapshots render at 640x640 (double the previous 320x320). A device scale
// factor of 4 over the 160px CSS canvas produces a 640px capture, and the
// matching dpr=4 quality override makes the WebGL buffer render natively at
// that resolution instead of being upscaled, so the result stays crisp.
const SNAPSHOT_DEVICE_SCALE_FACTOR = 4;
const SNAPSHOT_SIZE = 640;
const SNAPSHOT_CONTENT_SIZE = 576;

// Keep the low-tier look (no shadows/ground decoration) to match the previous
// snapshots, but force a high dpr so the higher-resolution capture is sharp.
const snapshotQuality = {
    ...gameQualityProfiles.low,
    dpr: SNAPSHOT_DEVICE_SCALE_FACTOR,
};

// Playwright can only screenshot to PNG/JPEG, so capture the PNG buffer and
// re-encode to lossy WebP (with alpha) at 90% quality for small, fast assets.
async function saveWebp(buffer: Buffer, path: string) {
    const transparent = { alpha: 0, b: 0, g: 0, r: 0 };
    const subject = await sharp(buffer)
        .trim({ background: transparent })
        .resize(SNAPSHOT_CONTENT_SIZE, SNAPSHOT_CONTENT_SIZE, {
            fit: 'inside',
            withoutEnlargement: true,
        })
        .png()
        .toBuffer();
    const webp = await sharp({
        create: {
            background: transparent,
            channels: 4,
            height: SNAPSHOT_SIZE,
            width: SNAPSHOT_SIZE,
        },
    })
        .composite([{ input: subject, gravity: 'centre' }])
        .webp({ quality: 90 })
        .toBuffer();
    await writeFile(path, webp);
}

test.use({
    deviceScaleFactor: SNAPSHOT_DEVICE_SCALE_FACTOR,
    viewport: { width: 320 / 2, height: 320 },
});

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const assetName of allGameAssetNames) {
        await page.route(
            `**/assets/models/${assetName}.glb*`,
            async (route) => {
                const gameAssetsModelPath = resolve(
                    `../garden/public/assets/models/${assetName}.glb`,
                );

                await route.fulfill({
                    contentType: 'model/gltf-binary',
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    },
                    path: gameAssetsModelPath,
                });
            },
        );
    }

    await page.route(
        '**/assets/sprites/decorations/ground-cover-v2.atlas.*',
        async (route) => {
            const assetName = new URL(route.request().url()).pathname
                .split('/')
                .at(-1);
            if (!assetName) {
                await route.abort();
                return;
            }
            await route.fulfill({
                path: resolve(
                    `../garden/public/assets/sprites/decorations/${assetName}`,
                ),
            });
        },
    );
});

function shouldRenderSnapshotDetails(entityName: string) {
    return (
        entityName === 'Block_Swamp_Ground' ||
        entityName === 'Block_Swamp_Ground_Angle'
    );
}

type SnapshotView = 'normal' | 'far' | 'closeup';

const CLOSEUP_ENTITIES = new Set<string>([
    // Flowers and other small props look better when zoomed in
    'FireflyJar',
    'LiquidPreparationBottlePestControl',
    'LiquidPreparationBottleAphidControl',
    'LiquidPreparationBottleSlugControl',
    'LiquidPreparationBottleTomatoEggplantResistance',
    'LiquidPreparationBottleFertilizer',
    'LiquidPreparationBottleDiseaseControl',
    'LiquidPreparationBottleWeevilControl',
    'LiquidPreparationBottleVoleControl',
    'LiquidPreparationBottleBeetleControl',
    'Tulip',
    'SummerHat',
    'BeachBall',
    'SandcastleSmallA',
    'SmallWoodenBridge',
    'WoodenWalkway',
    'StoneWalkway',
    'RoofTileLantern',
    'WickerGardenLantern',
    'WoodenHandLantern',
    'MoonRainBarrel',
]);
const CLOSEUP_ENTITY_ZOOM = new Map<string, number>([
    ['SummerHat', 105],
    ['BeachBall', 175],
    ['SandcastleSmallA', 145],
    ['SmallWoodenBridge', 125],
    ['WoodenWalkway', 125],
    ['StoneWalkway', 125],
    ['RoofTileLantern', 145],
    ['WickerGardenLantern', 130],
    ['WoodenHandLantern', 145],
    ['MoonRainBarrel', 120],
]);
const FAR_ENTITIES = new Set<string>(['PalmTree']);
const gameAssetBaseUrl =
    process.env.GAME_ASSET_BASE_URL ?? 'https://vrt.gredice.com';
const defaultSnapshotOutputDirectory = resolve('./public/assets/blocks');
const configuredSnapshotOutputDirectory =
    process.env.BLOCK_SNAPSHOT_OUTPUT_DIRECTORY;
const snapshotCameraView = parseBlockSnapshotCameraView(
    process.env.BLOCK_SNAPSHOT_CAMERA_VIEW,
);
if (
    configuredSnapshotOutputDirectory !== undefined &&
    configuredSnapshotOutputDirectory.trim() === ''
) {
    throw new Error('BLOCK_SNAPSHOT_OUTPUT_DIRECTORY must not be empty.');
}
const snapshotOutputDirectory = resolve(
    configuredSnapshotOutputDirectory ?? defaultSnapshotOutputDirectory,
);
const snapshotFreezeTime = process.env.BLOCK_SNAPSHOT_FREEZE_TIME
    ? new Date(process.env.BLOCK_SNAPSHOT_FREEZE_TIME)
    : undefined;

if (snapshotFreezeTime && Number.isNaN(snapshotFreezeTime.getTime())) {
    throw new Error('BLOCK_SNAPSHOT_FREEZE_TIME must be a valid date.');
}

if (
    snapshotCameraView === 'orthographic' &&
    (configuredSnapshotOutputDirectory === undefined ||
        snapshotOutputDirectory === defaultSnapshotOutputDirectory)
) {
    throw new Error(
        'BLOCK_SNAPSHOT_CAMERA_VIEW=orthographic requires a dedicated BLOCK_SNAPSHOT_OUTPUT_DIRECTORY.',
    );
}

test.beforeAll(async () => {
    await mkdir(snapshotOutputDirectory, { recursive: true });
});

function getSnapshotView(entity: BlockData): SnapshotView {
    if (CLOSEUP_ENTITIES.has(entity.information.name)) {
        return 'closeup';
    }

    if (
        FAR_ENTITIES.has(entity.information.name) ||
        entity.attributes.height > 1.5
    ) {
        return 'far';
    }

    return 'normal';
}

type SnapshotViewOptions = {
    zoom?: number;
    itemPosition?: [number, number, number];
    cameraPosition?: [number, number, number];
    cameraTarget?: [number, number, number];
    cameraUp?: [number, number, number];
    label: string;
};
function getViewOptions(
    entity: BlockData,
    rotation: number,
    view: SnapshotView,
): SnapshotViewOptions {
    const span = getGardenBlockSpan(entity, rotation);
    const hasMultiBlockFootprint = span.width > 1 || span.depth > 1;
    const target: [number, number, number] = hasMultiBlockFootprint
        ? [1.25, entity.attributes.height * 0.45, 1.25]
        : [1.25, 0, 1.25];
    const centeredItemPosition: [number, number, number] = [
        target[0] - (span.width - 1) / 2,
        0,
        target[2] - (span.depth - 1) / 2,
    ];

    let options: SnapshotViewOptions;
    switch (view) {
        case 'far':
            options = {
                zoom: hasMultiBlockFootprint ? 38 : 60,
                itemPosition: hasMultiBlockFootprint
                    ? centeredItemPosition
                    : target,
                cameraTarget: hasMultiBlockFootprint ? target : undefined,
                label: 'zoomed out',
            };
            break;
        case 'closeup':
            options = {
                zoom: CLOSEUP_ENTITY_ZOOM.get(entity.information.name) ?? 130,
                itemPosition: hasMultiBlockFootprint
                    ? centeredItemPosition
                    : undefined,
                cameraTarget: hasMultiBlockFootprint ? target : undefined,
                label: 'zoomed in',
            };
            break;
        default:
            options = hasMultiBlockFootprint
                ? {
                      itemPosition: centeredItemPosition,
                      cameraTarget: target,
                      label: 'normal',
                  }
                : { label: 'normal' };
    }

    if (snapshotCameraView !== 'orthographic') {
        return options;
    }

    const orthographicCamera = getOrthographicSnapshotCamera({
        height: entity.attributes.height,
        itemPosition: options.itemPosition,
        rotation,
        span,
    });
    return {
        ...options,
        ...orthographicCamera,
        label: `${options.label}, orthographic ${orthographicCamera.label}`,
    };
}

test.describe('block screenshots', async () => {
    const entities = JSON.parse(
        readFileSync('./generate/test-cases.json', 'utf8'),
    ) as BlockData[];
    for (const entity of entities) {
        for (let rotation = 0; rotation < 4; rotation += 1) {
            test(`${entity.information.name} rotation ${rotation + 1}`, async ({
                mount,
                page,
            }) => {
                page.on('pageerror', (error) => {
                    console.error('Browser page error:', error.message);
                });
                const view = getSnapshotView(entity);
                const {
                    cameraPosition,
                    cameraTarget,
                    cameraUp,
                    itemPosition,
                    label,
                    zoom,
                } = getViewOptions(entity, rotation, view);
                console.info(
                    'Taking screenshot of',
                    entity.information.name,
                    `(${label})`,
                    `rotation ${rotation + 1}`,
                );
                const component = await mount(
                    <div style={{ width: 160, height: 160 }}>
                        <EntitySnapshotViewer
                            style={{ width: 160, height: 160 }}
                            zoom={zoom}
                            cameraPosition={cameraPosition}
                            cameraTarget={cameraTarget}
                            cameraUp={cameraUp}
                            itemPosition={itemPosition}
                            entityName={entity.information.name}
                            message={
                                entity.information.name === 'WoodenSign'
                                    ? 'MOJ\nVRT'
                                    : undefined
                            }
                            appBaseUrl={gameAssetBaseUrl}
                            freezeTime={snapshotFreezeTime}
                            quality={snapshotQuality}
                            noControl
                            rotation={rotation}
                            renderDetails={shouldRenderSnapshotDetails(
                                entity.information.name,
                            )}
                            staticEnvironment
                        />
                    </div>,
                );

                // EntitySnapshotViewer mounts the canvas lazily, so wait for it
                // first, then let the model load and any animations settle.
                const canvas = component.locator('canvas').first();
                await canvas.waitFor({ state: 'visible' });
                await new Promise((resolve) => setTimeout(resolve, 1000));

                console.debug('Taking screenshot now...');

                const buffer = await canvas.screenshot({
                    omitBackground: true,
                    animations: 'disabled',
                });

                // Save rotation-specific version
                await saveWebp(
                    buffer,
                    join(
                        snapshotOutputDirectory,
                        `${entity.information.name}_${rotation + 1}.webp`,
                    ),
                );

                // Save base version (unsuffixed) for the first rotation to maintain backward compatibility
                if (rotation === 0) {
                    await saveWebp(
                        buffer,
                        join(
                            snapshotOutputDirectory,
                            `${entity.information.name}.webp`,
                        ),
                    );
                }
            });
        }
    }
});

test.describe('icons', () => {
    test('block ground over grass', async ({ mount }) => {
        const component = await mount(
            <div
                style={{
                    height: 160,
                    overflow: 'hidden',
                    position: 'relative',
                    width: 160,
                }}
            >
                {/** biome-ignore lint/performance/noImgElement: Not part of NextJS app */}
                <img
                    src="/assets/blocks/Block_Grass.webp"
                    alt="Block_Grass"
                    width={128}
                    height={128}
                    style={{ left: 16, position: 'absolute', top: 20 }}
                />
                {/** biome-ignore lint/performance/noImgElement: Not part of NextJS app */}
                <img
                    src="/assets/blocks/Block_Sand.webp"
                    alt="Block_Sand"
                    width={128}
                    height={128}
                    style={{ left: 16, position: 'absolute', top: -10 }}
                />
                {/** biome-ignore lint/performance/noImgElement: Not part of NextJS app */}
                <img
                    src="/assets/blocks/Block_Ground.webp"
                    alt="Block_Ground"
                    width={128}
                    height={128}
                    style={{ left: 16, position: 'absolute', top: -40 }}
                />
            </div>,
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        const buffer = await component.screenshot({
            omitBackground: true,
        });
        await saveWebp(
            buffer,
            join(snapshotOutputDirectory, 'Block_Icon_GroundOverGrass.webp'),
        );
    });
});
