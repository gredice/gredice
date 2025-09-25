import { readFileSync } from 'node:fs';
import type { BlockData } from '@gredice/client';
import { EntityViewer } from '@gredice/game';
import { test } from '@playwright/experimental-ct-react';

test.use({ deviceScaleFactor: 2, viewport: { width: 320 / 2, height: 320 } });

type SnapshotView = 'normal' | 'far' | 'closeup';

const CLOSEUP_ENTITIES = new Set<string>([
    // Flowers and other small props look better when zoomed in
    'Tulip',
]);

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
        test(entity.information.name, async ({ mount }) => {
            const view = getSnapshotView(entity);
            const { itemPosition, label, zoom } = getViewOptions(view);
            console.info(
                'Taking screenshot of',
                entity.information.name,
                `(${label})`,
            );
            const component = await mount(
                <EntityViewer
                    className="size-80"
                    zoom={zoom}
                    itemPosition={itemPosition}
                    entityName={entity.information.name}
                    appBaseUrl="https://vrt.gredice.com"
                />,
            );
            await new Promise((resolve) => setTimeout(resolve, 2000));
            await component.screenshot({
                omitBackground: true,
                path: `./public/assets/blocks/${entity.information.name}.png`,
            });
        });
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
