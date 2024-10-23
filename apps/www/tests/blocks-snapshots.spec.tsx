import { EntityViewer } from '@gredice/game';
import { test } from '@playwright/experimental-ct-react';
import { entities } from '../../../packages/game/src/data/entities';

test.use({ deviceScaleFactor: 2, viewport: { width: 320 / 2, height: 320 } });

test.describe('block screenshots', () => {
    const entityNamesArray = Object.keys(entities);
    for (const entityName of entityNamesArray) {
        const entity = entities[entityName as keyof typeof entities];
        test(entity.name, async ({ mount }) => {
            const component = await mount(<EntityViewer className='size-80' entityName={entity.name} appBaseUrl='https://vrt.gredice.com' />);
            await new Promise(resolve => setTimeout(resolve, 500));
            await component.screenshot({
                omitBackground: true,
                path: `./public/assets/blocks/${entity.name}.png`,
                timeout: 2000,
            });
        });
    }
});
