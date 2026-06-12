import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from '@playwright/experimental-ct-react';
import sharp from 'sharp';
import { allGameAssetNames } from '../../../packages/game/src/data/models';
import { OperationCoverSnapshotViewer } from './OperationCoverSnapshotViewer';
import {
    OPERATION_ICON_DEVICE_SCALE_FACTOR,
    OPERATION_ICON_SIZE,
    operationCoverRecipes,
    validateOperationCoverRecipes,
} from './operation-cover-recipes';

const gameAssetBaseUrl =
    process.env.GAME_ASSET_BASE_URL ?? 'https://vrt.gredice.com';

async function assertCaptureNotBlank(buffer: Buffer, outputFileName: string) {
    const { data, info } = await sharp(buffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const alphaChannel = 4;
    let visiblePixels = 0;

    for (let index = alphaChannel - 1; index < data.length; index += 4) {
        if (data[index] > 8) {
            visiblePixels += 1;
        }
    }

    const minVisiblePixels = Math.max(32, info.width * info.height * 0.002);
    if (visiblePixels < minVisiblePixels) {
        throw new Error(
            `${outputFileName} appears blank: ${visiblePixels} visible pixels.`,
        );
    }
}

async function saveWebp(buffer: Buffer, path: string) {
    const webp = await sharp(buffer).webp({ quality: 90 }).toBuffer();
    await writeFile(path, webp);
}

const recipeValidationErrors = validateOperationCoverRecipes(
    operationCoverRecipes,
);
if (recipeValidationErrors.length > 0) {
    throw new Error(
        `Invalid operation cover recipes:\n${recipeValidationErrors.join('\n')}`,
    );
}

test.use({
    deviceScaleFactor: OPERATION_ICON_DEVICE_SCALE_FACTOR,
    viewport: { width: OPERATION_ICON_SIZE, height: OPERATION_ICON_SIZE },
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

test.describe('operation cover snapshots', () => {
    for (const recipe of operationCoverRecipes) {
        test(recipe.operationLabel, async ({ mount, page }) => {
            page.on('pageerror', (error) => {
                console.error('Browser page error:', error.message);
            });

            await mkdir('./public/assets/operation-icons', { recursive: true });

            const component = await mount(
                <div
                    style={{
                        width: OPERATION_ICON_SIZE,
                        height: OPERATION_ICON_SIZE,
                    }}
                >
                    <OperationCoverSnapshotViewer
                        style={{
                            width: OPERATION_ICON_SIZE,
                            height: OPERATION_ICON_SIZE,
                        }}
                        appBaseUrl={gameAssetBaseUrl}
                        recipe={recipe}
                    />
                </div>,
            );

            const canvas = component.locator('canvas').first();
            await canvas.waitFor({ state: 'visible' });
            await page.waitForTimeout(1000);

            const buffer = await canvas.screenshot({
                omitBackground: true,
                animations: 'disabled',
            });

            await assertCaptureNotBlank(buffer, recipe.outputFileName);
            await saveWebp(
                buffer,
                `./public/assets/operation-icons/${recipe.outputFileName}`,
            );
        });
    }
});
