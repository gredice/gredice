import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BlockData } from '@gredice/client';
import { EntityViewer } from '@gredice/game';
import { test } from '@playwright/experimental-ct-react';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { allGameAssetNames } from '../../../packages/game/src/data/models';

test.use({
    deviceScaleFactor: 2,
    viewport: { width: 320 / 2, height: 320 },
});

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const assetName of allGameAssetNames) {
        await page.route(
            `https://vrt.gredice.com/assets/models/${assetName}.glb`,
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
            }) => {
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
                        <NuqsTestingAdapter>
                            <EntityViewer
                                style={{ width: 160, height: 160 }}
                                zoom={zoom}
                                itemPosition={itemPosition}
                                entityName={entity.information.name}
                                appBaseUrl={gameAssetBaseUrl}
                                rotation={rotation}
                            />
                        </NuqsTestingAdapter>
                    </div>,
                );

                // Wait for possible animations to finish
                await new Promise((resolve) => setTimeout(resolve, 1000));
                const canvas = component.locator('canvas').first();
                await canvas.waitFor({ state: 'visible' });

                console.debug('Taking screenshot now...');

                // Save rotation-specific version
                await canvas.screenshot({
                    omitBackground: true,
                    path: `./public/assets/blocks/${entity.information.name}_${rotation + 1}.png`,
                    animations: 'disabled',
                });

                // Save base version (unsuffixed) for the first rotation to maintain backward compatibility
                if (rotation === 0) {
                    await canvas.screenshot({
                        omitBackground: true,
                        path: `./public/assets/blocks/${entity.information.name}.png`,
                        animations: 'disabled',
                    });
                }
            });
        }
    }
});

test.describe('icons', () => {
    test('block ground over grass', async ({ mount }) => {
        const component = await mount(
            <div style={{ position: 'relative' }}>
                {/** biome-ignore lint/performance/noImgElement: Not part of NextJS app */}
                <img
                    src="https://www.gredice.com/assets/blocks/Block_Grass.png"
                    alt="Block_Grass"
                    width={320 / 2}
                    height={320 / 2}
                    style={{ marginLeft: -8 }}
                />
                {/** biome-ignore lint/performance/noImgElement: Not part of NextJS app */}
                <img
                    src="https://www.gredice.com/assets/blocks/Block_Ground.png"
                    alt="Block_Ground"
                    width={320 / 2}
                    height={320 / 2}
                    style={{ position: 'fixed', top: -40, left: 0 }}
                />
            </div>,
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await component.screenshot({
            omitBackground: true,
            path: `./public/assets/blocks/Block_Icon_GroundOverGrass.png`,
        });
    });
});
