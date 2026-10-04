import { test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import sharp from 'sharp';
import { MAX_PLANT_GENERATION } from '../../../packages/game/src/generators/plant/lib/plant-definition-types';
import { plantTypes } from '../../../packages/game/src/generators/plant/lib/plant-presets';
import type { PlantViewerProps } from '../../../packages/game/src/viewers/PlantViewer';
import { PlantSnapshotViewer } from './PlantSnapshotViewer';

test.use({
    deviceScaleFactor: 1,
    viewport: { width: 552, height: 552 },
});

test.setTimeout(30_000);

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
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

const snapshotRenderSize = 512;
const snapshotOutputSize = 320;
const snapshotContentSize = 256;
const snapshotPadding = (snapshotOutputSize - snapshotContentSize) / 2;
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

async function captureTransparentCanvas(canvas: Locator) {
    const dataUrl = await canvas.evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement)) {
            throw new TypeError('Plant snapshot expected a canvas element');
        }

        return element.toDataURL('image/png');
    });
    const encoded = dataUrl.split(',')[1];
    if (!encoded) {
        throw new Error('Plant snapshot canvas did not return PNG data');
    }

    return Buffer.from(encoded, 'base64');
}

async function writePlantSnapshot(snapshot: Buffer, path: string) {
    await sharp(snapshot)
        .trim({ background: transparent })
        .resize({
            width: snapshotContentSize,
            height: snapshotContentSize,
            fit: 'contain',
            background: transparent,
        })
        .extend({
            top: snapshotPadding,
            right: snapshotPadding,
            bottom: snapshotPadding,
            left: snapshotPadding,
            background: transparent,
        })
        .png()
        .toFile(path);
}

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
              zoom: 150,
          }
        : {
              orbitTarget: [0, 0.75, 0],
              zoom: 220,
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
                        <div
                            style={{
                                width: snapshotRenderSize,
                                height: snapshotRenderSize,
                            }}
                        >
                            <style>
                                {`
                                    html, body, #root {
                                        background: transparent !important;
                                    }
                                    .plant-snapshot-canvas {
                                        display: block;
                                        width: ${snapshotRenderSize}px;
                                        height: ${snapshotRenderSize}px;
                                        background: transparent;
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
                                orbitTarget={view.orbitTarget}
                                zoom={view.zoom}
                            />
                        </div>
                    </NuqsTestingAdapter>,
                );

                const canvas = component.locator('canvas').first();
                await canvas.waitFor({ state: 'visible' });
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(750);

                const snapshot = await captureTransparentCanvas(canvas);
                await writePlantSnapshot(
                    snapshot,
                    `./public/assets/plants/${plantType}_${stage.name}.png`,
                );
            });
        }
    }
});
