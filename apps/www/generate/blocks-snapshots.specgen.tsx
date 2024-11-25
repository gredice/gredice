import { EntityViewer } from '@gredice/game';
import { test } from '@playwright/experimental-ct-react';
import { BlockData } from '../app/blokovi/@types/BlockData';

test.use({ deviceScaleFactor: 2, viewport: { width: 320 / 2, height: 320 } });

test.describe('block screenshots', async () => {
    const entities = await fetch('https://app.gredice.com/api/directories/entities/block').then(res => res.json()) as BlockData[];
    for (const entity of entities) {
        test(entity.information.name, async ({ mount }) => {
            const component = await mount(
                <EntityViewer
                    className='size-80'
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
