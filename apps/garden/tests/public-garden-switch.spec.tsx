import { expect, test } from '@playwright/experimental-ct-react';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';
import { PublicGardenSwitchFixture } from './PublicGardenSwitchFixture';

test('switches structure plans and collision while preserving one R3F canvas', async ({
    mount,
    page,
}) => {
    test.setTimeout(45_000);
    await page.route(
        '**/api/gredice/api/directories/entities/block**',
        (route) => route.fulfill({ json: getLocalSandboxBlockData() }),
    );

    const fixture = await mount(<PublicGardenSwitchFixture />);
    const canvas = fixture.locator('canvas');
    const structureScene = fixture.locator(
        '[data-garden-structure-rendered-count]',
    );
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toBeVisible({ timeout: 35_000 });
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-rendered-count',
        '1',
    );
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-diagnostic-status',
        'ready',
    );
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-first-id',
        'structure-1',
    );
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-collision-status',
        'ready',
    );
    await canvas.evaluate((element) => {
        Reflect.set(window, '__gredicePublicGardenCanvas', element);
    });

    await fixture.getByRole('button', { name: 'Promijeni vrt' }).click();
    await expect(fixture).toHaveAttribute('data-garden-id', '2');
    await expect(canvas).toHaveCount(1);
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-rendered-count',
        '1',
    );
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-diagnostic-status',
        'ready',
    );
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-first-id',
        'structure-2',
    );
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-collision-status',
        'ready',
    );
    await expect
        .poll(() =>
            canvas.evaluate(
                (element) =>
                    Reflect.get(window, '__gredicePublicGardenCanvas') ===
                    element,
            ),
        )
        .toBe(true);
});
