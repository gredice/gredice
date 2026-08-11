import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { BlockData } from '@gredice/client';
import { getGardenBlockSpan } from '@gredice/js/gardenBlocks';
import { test } from '@playwright/experimental-ct-react';
import sharp from 'sharp';
import { allGameAssetNames } from '../../../packages/game/src/data/models';
import { gameQualityProfiles } from '../../../packages/game/src/scene/gameQuality';
import { EntitySnapshotViewer } from './EntitySnapshotViewer';

const snapshotDeviceScaleFactor = 4;
const outputDirectory = resolve('../garden/public/assets/blocks/top-down');
const snapshotQuality = {
    ...gameQualityProfiles.low,
    dpr: snapshotDeviceScaleFactor,
};

test.use({
    deviceScaleFactor: snapshotDeviceScaleFactor,
    viewport: { width: 160, height: 160 },
});

test.beforeAll(async () => {
    await mkdir(outputDirectory, { recursive: true });
});

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const assetName of allGameAssetNames) {
        await page.route(
            `**/assets/models/${assetName}.glb*`,
            async (route) => {
                await route.fulfill({
                    contentType: 'model/gltf-binary',
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    },
                    path: resolve(
                        `../garden/public/assets/models/${assetName}.glb`,
                    ),
                });
            },
        );
    }
});

const entities = JSON.parse(
    readFileSync('./generate/test-cases.json', 'utf8'),
) as BlockData[];

for (const entity of entities) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
        test(`${entity.information.name} rotation ${rotation + 1}`, async ({
            mount,
        }) => {
            const span = getGardenBlockSpan(entity, rotation);
            // Aim through the asset rather than its base so tall props stay
            // centered. The small northward offset keeps thin vertical details
            // recognizable while terrain still reads as a plan view.
            const target: [number, number, number] = [
                1.25,
                entity.attributes.height * 0.35,
                1.25,
            ];
            const itemPosition: [number, number, number] = [
                target[0] - (span.width - 1) / 2,
                0,
                target[2] - (span.depth - 1) / 2,
            ];
            const component = await mount(
                <div style={{ width: 160, height: 160 }}>
                    <EntitySnapshotViewer
                        style={{ width: 160, height: 160 }}
                        appBaseUrl={
                            process.env.GAME_ASSET_BASE_URL ??
                            'https://vrt.gredice.com'
                        }
                        cameraPosition={[
                            target[0],
                            target[1] + 100,
                            target[2] + 12,
                        ]}
                        cameraTarget={target}
                        cameraUp={[0, 0, -1]}
                        entityName={entity.information.name}
                        message={
                            entity.information.name === 'WoodenSign'
                                ? 'MOJ\nVRT'
                                : undefined
                        }
                        itemPosition={itemPosition}
                        noControl
                        quality={snapshotQuality}
                        renderDetails={false}
                        rotation={rotation}
                        staticEnvironment
                        zoom={80 / Math.max(span.width, span.depth)}
                    />
                </div>,
            );

            const canvas = component.locator('canvas').first();
            await canvas.waitFor({ state: 'visible' });
            await new Promise((resolveWait) => setTimeout(resolveWait, 1000));

            const buffer = await canvas.screenshot({
                animations: 'disabled',
                omitBackground: true,
            });
            const transparent = { alpha: 0, b: 0, g: 0, r: 0 };
            const image = await sharp(buffer)
                // Cropping preserves the intrinsic ratio of rotated multi-cell
                // blocks when the browser fits them into their grid footprint.
                .trim({ background: transparent })
                .extend({
                    background: transparent,
                    bottom: 16,
                    left: 16,
                    right: 16,
                    top: 16,
                })
                .webp({ quality: 90 })
                .toBuffer();

            await sharp(image).toFile(
                resolve(
                    outputDirectory,
                    `${entity.information.name}_${rotation + 1}.webp`,
                ),
            );
        });
    }
}
