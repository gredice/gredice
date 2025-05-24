/* eslint-disable @next/next/no-img-element */
import { BlockData } from '@gredice/client';
import { EntityViewer } from '@gredice/game';
import { test } from '@playwright/experimental-ct-react';
import { readFileSync } from 'fs';

test.use({ deviceScaleFactor: 2, viewport: { width: 320 / 2, height: 320 } });

test.describe('block screenshots', async () => {
    const entities = JSON.parse(readFileSync('./generate/test-cases.json', 'utf8')) as BlockData[];
    for (const entity of entities) {
        test(entity.information.name, async ({ mount }) => {
            console.log('Taking screenshot of', entity.information.name, entity.attributes.height > 1.5 ? '(zoomed)' : '(normal)');
            const component = await mount(
                <EntityViewer
                    className='size-80'
                    zoom={entity.attributes.height > 1.5 ? 60 : undefined}
                    itemPosition={entity.attributes.height > 1.5 ? [1.25, 0, 1.25] : undefined}
                    entityName={entity.information.name}
                    appBaseUrl='https://vrt.gredice.com' />
            );
            await new Promise(resolve => setTimeout(resolve, 2000));
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
                <img src="https://www.gredice.com/assets/blocks/Block_Grass.png" alt="Block_Grass" width={320 / 2} height={320 / 2}
                    style={{ marginLeft: -8 }} />
                <img src="https://www.gredice.com/assets/blocks/Block_Ground.png" alt="Block_Ground" width={320 / 2} height={320 / 2}
                    style={{ position: 'fixed', top: -40, left: 0 }} />
            </div>
        );
        await new Promise(resolve => setTimeout(resolve, 5000));
        await component.screenshot({
            omitBackground: true,
            path: `./public/assets/blocks/Block_Icon_GroundOverGrass.png`,
        });
    });
});
