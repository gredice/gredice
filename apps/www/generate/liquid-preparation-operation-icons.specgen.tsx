import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from '@playwright/experimental-ct-react';
import sharp from 'sharp';
import { allGameAssetNames } from '../../../packages/game/src/data/models';
import { gameQualityProfiles } from '../../../packages/game/src/scene/gameQuality';
import { EntitySnapshotViewer } from './EntitySnapshotViewer';

const SNAPSHOT_DEVICE_SCALE_FACTOR = 4;
const ICON_SIZE = 160;

const snapshotQuality = {
    ...gameQualityProfiles.low,
    dpr: SNAPSHOT_DEVICE_SCALE_FACTOR,
};

const liquidPreparationBottleIcons = [
    'LiquidPreparationBottlePestControl',
    'LiquidPreparationBottleAphidControl',
    'LiquidPreparationBottleSlugControl',
    'LiquidPreparationBottleTomatoEggplantResistance',
    'LiquidPreparationBottleFertilizer',
    'LiquidPreparationBottleDiseaseControl',
    'LiquidPreparationBottleWeevilControl',
    'LiquidPreparationBottleVoleControl',
    'LiquidPreparationBottleBeetleControl',
] as const;

const gameAssetBaseUrl =
    process.env.GAME_ASSET_BASE_URL ?? 'https://vrt.gredice.com';

async function saveWebp(buffer: Buffer, path: string) {
    const webp = await sharp(buffer).webp({ quality: 90 }).toBuffer();
    await writeFile(path, webp);
}

test.use({
    deviceScaleFactor: SNAPSHOT_DEVICE_SCALE_FACTOR,
    viewport: { width: ICON_SIZE, height: ICON_SIZE },
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

test.describe('liquid preparation operation icons', () => {
    for (const entityName of liquidPreparationBottleIcons) {
        test(entityName, async ({ mount, page }) => {
            page.on('pageerror', (error) => {
                console.error('Browser page error:', error.message);
            });

            await mkdir('./public/assets/operation-icons', { recursive: true });

            const component = await mount(
                <div style={{ width: ICON_SIZE, height: ICON_SIZE }}>
                    <EntitySnapshotViewer
                        style={{ width: ICON_SIZE, height: ICON_SIZE }}
                        appBaseUrl={gameAssetBaseUrl}
                        cameraPosition={[0.5, 0.62, 7]}
                        cameraTarget={[0.5, 0.62, 0.5]}
                        entityName={entityName}
                        itemPosition={[0.5, 0, 0.5]}
                        noControl
                        quality={snapshotQuality}
                        renderDetails={false}
                        rotation={0}
                        showBackground={false}
                        staticEnvironment
                        zoom={118}
                    />
                </div>,
            );

            const canvas = component.locator('canvas').first();
            await canvas.waitFor({ state: 'visible' });
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const buffer = await canvas.screenshot({
                omitBackground: true,
                animations: 'disabled',
            });

            await saveWebp(
                buffer,
                `./public/assets/operation-icons/${entityName}.webp`,
            );
        });
    }
});
