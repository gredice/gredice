import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { BlockData } from '@gredice/client';
import { test } from '@playwright/experimental-ct-react';
import sharp from 'sharp';
import { allGameAssetNames } from '../../../packages/game/src/data/models';
import { gameQualityProfiles } from '../../../packages/game/src/scene/gameQuality';
// Load EntityViewer through a lazy wrapper (not the @gredice/game barrel) so the
// component-test bundle does not pull in GameSceneDynamic -> next/dynamic, and
// resolves three.js deps through a dynamic chunk that Rollup can build.
import { EntitySnapshotViewer } from './EntitySnapshotViewer';

// Snapshots render at 640x640 (double the previous 320x320). A device scale
// factor of 4 over the 160px CSS canvas produces a 640px capture, and the
// matching dpr=4 quality override makes the WebGL buffer render natively at
// that resolution instead of being upscaled, so the result stays crisp.
const SNAPSHOT_DEVICE_SCALE_FACTOR = 4;

// Keep the low-tier look (no shadows/ground decoration) to match the previous
// snapshots, but force a high dpr so the higher-resolution capture is sharp.
const snapshotQuality = {
    ...gameQualityProfiles.low,
    dpr: SNAPSHOT_DEVICE_SCALE_FACTOR,
};

// Playwright can only screenshot to PNG/JPEG, so capture the PNG buffer and
// re-encode to lossy WebP (with alpha) at 90% quality for small, fast assets.
async function saveWebp(buffer: Buffer, path: string) {
    const webp = await sharp(buffer).webp({ quality: 90 }).toBuffer();
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
});

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
]);
const gameAssetBaseUrl =
    process.env.GAME_ASSET_BASE_URL ?? 'https://vrt.gredice.com';

function getSnapshotView(entity: BlockData): SnapshotView {
    if (CLOSEUP_ENTITIES.has(entity.information.name)) {
        return 'closeup';
    }

    if (entity.attributes.height > 1.5) {
        return 'far';
    }

    return 'normal';
}

function getViewOptions(view: SnapshotView): {
    zoom?: number;
    itemPosition?: [number, number, number];
    label: string;
} {
    switch (view) {
        case 'far':
            return {
                zoom: 60,
                itemPosition: [1.25, 0, 1.25],
                label: 'zoomed out',
            };
        case 'closeup':
            return {
                zoom: 130,
                label: 'zoomed in',
            };
        default:
            return { label: 'normal' };
    }
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
                const { itemPosition, label, zoom } = getViewOptions(view);
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
                            itemPosition={itemPosition}
                            entityName={entity.information.name}
                            appBaseUrl={gameAssetBaseUrl}
                            quality={snapshotQuality}
                            noControl
                            rotation={rotation}
                            renderDetails={false}
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
                    `./public/assets/blocks/${entity.information.name}_${rotation + 1}.webp`,
                );

                // Save base version (unsuffixed) for the first rotation to maintain backward compatibility
                if (rotation === 0) {
                    await saveWebp(
                        buffer,
                        `./public/assets/blocks/${entity.information.name}.webp`,
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
            `./public/assets/blocks/Block_Icon_GroundOverGrass.webp`,
        );
    });
});
