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
const visibleAlphaThreshold = 8;
const normalizedIconPaddingRatio = 0.14;

type AlphaBounds = {
    left: number;
    top: number;
    width: number;
    height: number;
    visiblePixels: number;
};

function findAlphaBounds({
    data,
    width,
    height,
}: {
    data: Buffer;
    width: number;
    height: number;
}): AlphaBounds | null {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let visiblePixels = 0;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const alpha = data[(y * width + x) * 4 + 3];

            if (alpha > visibleAlphaThreshold) {
                visiblePixels += 1;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }

    if (visiblePixels === 0) {
        return null;
    }

    return {
        left: minX,
        top: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        visiblePixels,
    };
}

async function assertCaptureNotBlank(buffer: Buffer, outputFileName: string) {
    const { data, info } = await sharp(buffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const bounds = findAlphaBounds({
        data,
        width: info.width,
        height: info.height,
    });
    const visiblePixels = bounds?.visiblePixels ?? 0;

    const minVisiblePixels = Math.max(32, info.width * info.height * 0.002);
    if (visiblePixels < minVisiblePixels) {
        throw new Error(
            `${outputFileName} appears blank: ${visiblePixels} visible pixels.`,
        );
    }
}

async function normalizeOperationIconBuffer(buffer: Buffer) {
    const { data, info } = await sharp(buffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const bounds = findAlphaBounds({
        data,
        width: info.width,
        height: info.height,
    });

    if (!bounds) {
        throw new Error('Operation icon capture has no visible pixels.');
    }

    const targetWidth = Math.max(
        1,
        Math.round(info.width * (1 - normalizedIconPaddingRatio * 2)),
    );
    const targetHeight = Math.max(
        1,
        Math.round(info.height * (1 - normalizedIconPaddingRatio * 2)),
    );
    const scale = Math.min(
        targetWidth / bounds.width,
        targetHeight / bounds.height,
    );
    const resizedWidth = Math.max(1, Math.round(bounds.width * scale));
    const resizedHeight = Math.max(1, Math.round(bounds.height * scale));
    const left = Math.round((info.width - resizedWidth) / 2);
    const top = Math.round((info.height - resizedHeight) / 2);

    const cropped = await sharp(buffer)
        .ensureAlpha()
        .extract(bounds)
        .resize({
            width: resizedWidth,
            height: resizedHeight,
            fit: 'fill',
        })
        .png()
        .toBuffer();

    return sharp({
        create: {
            width: info.width,
            height: info.height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .composite([{ input: cropped, left, top }])
        .webp({ quality: 90 })
        .toBuffer();
}

async function saveWebp(buffer: Buffer, path: string) {
    const webp = await normalizeOperationIconBuffer(buffer);
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
