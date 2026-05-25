import { resolve } from 'node:path';
import { test } from '@playwright/experimental-ct-react';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { MAX_PLANT_GENERATION } from '../../../packages/game/src/generators/plant/lib/plant-definition-types';
import { plantTypes } from '../../../packages/game/src/generators/plant/lib/plant-presets';
import type { PlantViewerProps } from '../../../packages/game/src/viewers/PlantViewer';
import { PlantSnapshotViewer } from './PlantSnapshotViewer';

test.use({
    deviceScaleFactor: 1,
    viewport: { width: 360, height: 360 },
});

test.setTimeout(30_000);

const groundAssetNames = [
    'BlockGround',
    'BlockGroundAngle',
    'BlockGrass',
    'BlockGrassAngle',
    'BlockSand',
    'BlockSandAngle',
    'BlockTerrainCorner',
];

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const assetName of groundAssetNames) {
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

type PlantType = PlantViewerProps['plantType'];

const PLANT_SNAPSHOT_STAGES = [
    {
        name: 'seedling',
        generation: MAX_PLANT_GENERATION * 0.25,
    },
    {
        name: 'growing',
        generation: MAX_PLANT_GENERATION * 0.6,
    },
    {
        name: 'mature',
        generation: MAX_PLANT_GENERATION * 0.92,
    },
];

function isPlantType(value: string): value is PlantType {
    return Object.hasOwn(plantTypes, value);
}

const plantTypesWithSnapshots = Object.keys(plantTypes)
    .filter(isPlantType)
    .sort((left, right) =>
        plantTypes[left].name.localeCompare(plantTypes[right].name),
    );

const tallPlantTypes = new Set<PlantType>([
    'figtree',
    'olivetree',
    'youngappletree',
]);

function getSnapshotView(plantType: PlantType): {
    orbitTarget: [number, number, number];
    zoom: number;
} {
    return tallPlantTypes.has(plantType)
        ? {
              orbitTarget: [0, 1.15, 0],
              zoom: 95,
          }
        : {
              orbitTarget: [0, 0.75, 0],
              zoom: 140,
          };
}

test.describe('plant screenshots', () => {
    for (const plantType of plantTypesWithSnapshots) {
        for (const stage of PLANT_SNAPSHOT_STAGES) {
            test(`${plantTypes[plantType].name} ${stage.name}`, async ({
                mount,
                page,
            }) => {
                page.on('console', (message) => {
                    if (message.type() === 'error') {
                        console.error('Browser console error:', message.text());
                    }
                });
                page.on('pageerror', (error) => {
                    console.error('Browser page error:', error.message);
                });
                console.info(
                    'Taking plant screenshot of',
                    plantTypes[plantType].name,
                    `(${stage.name})`,
                );
                const view = getSnapshotView(plantType);
                const component = await mount(
                    <NuqsTestingAdapter>
                        <div style={{ width: 320, height: 320 }}>
                            <style>
                                {`
                                    .plant-snapshot-canvas {
                                        display: block;
                                        width: 320px;
                                        height: 320px;
                                    }
                                `}
                            </style>
                            <PlantSnapshotViewer
                                plantType={plantType}
                                generation={stage.generation}
                                seed={`snapshot-${plantType}`}
                                className="plant-snapshot-canvas"
                                animate={false}
                                includeEnvironment={false}
                                lightingPreset="snapshot"
                                zoom={view.zoom}
                                orbitTarget={view.orbitTarget}
                            />
                        </div>
                    </NuqsTestingAdapter>,
                );

                await page.locator('canvas').waitFor({ state: 'visible' });
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(750);

                await component.screenshot({
                    omitBackground: true,
                    path: `./public/assets/plants/${plantType}_${stage.name}.png`,
                    animations: 'disabled',
                });
            });
        }
    }
});
