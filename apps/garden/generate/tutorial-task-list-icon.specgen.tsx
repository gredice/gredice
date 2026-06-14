import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from '@playwright/experimental-ct-react';
import sharp from 'sharp';
import { allGameAssetNames } from '../../../packages/game/src/data/models';
import type { OperationCoverRecipe } from '../../../packages/game/src/viewers/OperationCoverSnapshotViewer';
import { OperationCoverSnapshotViewer } from './OperationCoverSnapshotViewer';

const SNAPSHOT_SIZE = 192;
const SNAPSHOT_DEVICE_SCALE_FACTOR = 4;
const OUTPUT_PATH = './public/assets/hud/tutorial-task-list.png';
const gameAssetBaseUrl =
    process.env.GAME_ASSET_BASE_URL ?? 'https://vrt.gredice.com';

async function saveIconPng(buffer: Buffer, path: string) {
    const { data, info } = await sharp(buffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const channels = 4;
    const background = [data[0], data[1], data[2]];
    const visited = new Uint8Array(info.width * info.height);
    const queue: number[] = [];
    const backgroundThreshold = 30;

    function enqueue(x: number, y: number) {
        if (x < 0 || x >= info.width || y < 0 || y >= info.height) {
            return;
        }

        const pixel = y * info.width + x;
        if (visited[pixel]) {
            return;
        }

        const offset = pixel * channels;
        const red = data[offset] - background[0];
        const green = data[offset + 1] - background[1];
        const blue = data[offset + 2] - background[2];
        const distance = Math.sqrt(red * red + green * green + blue * blue);

        if (distance > backgroundThreshold) {
            return;
        }

        visited[pixel] = 1;
        queue.push(pixel);
    }

    for (let x = 0; x < info.width; x += 1) {
        enqueue(x, 0);
        enqueue(x, info.height - 1);
    }

    for (let y = 1; y < info.height - 1; y += 1) {
        enqueue(0, y);
        enqueue(info.width - 1, y);
    }

    for (let index = 0; index < queue.length; index += 1) {
        const pixel = queue[index];
        const x = pixel % info.width;
        const y = Math.floor(pixel / info.width);

        enqueue(x + 1, y);
        enqueue(x - 1, y);
        enqueue(x, y + 1);
        enqueue(x, y - 1);
    }

    let minX = info.width;
    let minY = info.height;
    let maxX = 0;
    let maxY = 0;

    for (let pixel = 0; pixel < visited.length; pixel += 1) {
        const offset = pixel * channels;
        if (visited[pixel]) {
            data[offset] = 0;
            data[offset + 1] = 0;
            data[offset + 2] = 0;
            data[offset + 3] = 0;
            continue;
        }

        if (data[offset + 3] <= 8) {
            continue;
        }

        const x = pixel % info.width;
        const y = Math.floor(pixel / info.width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }

    if (minX > maxX || minY > maxY) {
        throw new Error('Generated tutorial task list icon appears blank.');
    }

    const contentWidth = maxX - minX + 1;
    const contentHeight = maxY - minY + 1;
    const padding = Math.ceil(Math.max(contentWidth, contentHeight) * 0.08);
    const squareSize = Math.max(contentWidth, contentHeight) + padding * 2;
    const square = Buffer.alloc(squareSize * squareSize * channels);
    const offsetX = Math.floor((squareSize - contentWidth) / 2);
    const offsetY = Math.floor((squareSize - contentHeight) / 2);

    for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
            const sourceOffset = (y * info.width + x) * channels;
            const targetX = x - minX + offsetX;
            const targetY = y - minY + offsetY;
            const targetOffset = (targetY * squareSize + targetX) * channels;

            data.copy(square, targetOffset, sourceOffset, sourceOffset + 4);
        }
    }

    await sharp(square, {
        raw: {
            channels,
            height: squareSize,
            width: squareSize,
        },
    })
        .resize(SNAPSHOT_SIZE * SNAPSHOT_DEVICE_SCALE_FACTOR)
        .png()
        .toFile(path);
}

const tutorialTaskListRecipe = {
    operationId: 'tutorial-task-list',
    operationLabel: 'Tutorial task list',
    outputFileName: 'tutorial-task-list.webp',
    camera: {
        position: [0.84, 1.08, 4.7],
        target: [0.5, 0.46, 0.48],
        zoom: 215,
    },
    assets: [
        {
            assetName: 'FieldworkClipboard',
            position: [0.5, 0.22, 0.44],
            rotation: [0.88, -0.04, -0.08],
            scale: 0.36,
            castShadow: true,
            receiveShadow: true,
        },
    ],
    lighting: {
        ambientIntensity: 1.1,
        fillIntensity: 0.32,
        fillPosition: [-2.4, 2.4, 3.8],
        keyIntensity: 3.65,
        keyPosition: [2.6, 3.2, 5.4],
        shadowCameraSize: 1.35,
        shadowIntensity: 0.78,
        shadowMapSize: 2048,
        shadowNormalBias: 0.004,
        shadowRadius: 0.9,
        shadows: true,
    },
    showBackground: false,
} satisfies OperationCoverRecipe;

test.use({
    deviceScaleFactor: SNAPSHOT_DEVICE_SCALE_FACTOR,
    viewport: { width: SNAPSHOT_SIZE, height: SNAPSHOT_SIZE },
});

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const assetName of allGameAssetNames) {
        await page.route(
            `**/assets/models/${assetName}.glb*`,
            async (route) => {
                const gameAssetsModelPath = resolve(
                    `./public/assets/models/${assetName}.glb`,
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

test('tutorial task list icon', async ({ mount, page }) => {
    page.on('pageerror', (error) => {
        console.error('Browser page error:', error.message);
    });

    await mkdir('./public/assets/hud', { recursive: true });

    const component = await mount(
        <div
            style={{
                height: SNAPSHOT_SIZE,
                width: SNAPSHOT_SIZE,
            }}
        >
            <OperationCoverSnapshotViewer
                appBaseUrl={gameAssetBaseUrl}
                deviceScaleFactor={SNAPSHOT_DEVICE_SCALE_FACTOR}
                recipe={tutorialTaskListRecipe}
                style={{
                    height: SNAPSHOT_SIZE,
                    width: SNAPSHOT_SIZE,
                }}
            />
        </div>,
    );

    const canvas = component.locator('canvas').first();
    await canvas.waitFor({ state: 'visible' });
    await page.waitForTimeout(1000);

    const buffer = await canvas.screenshot({
        animations: 'disabled',
        omitBackground: true,
    });

    await saveIconPng(buffer, OUTPUT_PATH);
});
