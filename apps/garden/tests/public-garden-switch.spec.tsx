import { expect, test } from '@playwright/experimental-ct-react';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';
import { PublicGardenSwitchFixture } from './PublicGardenSwitchFixture';

test('switches gardens while preserving the one R3F canvas', async ({
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
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toBeVisible({ timeout: 35_000 });
    await canvas.evaluate((element) => {
        Reflect.set(window, '__gredicePublicGardenCanvas', element);
    });

    await fixture.getByRole('button', { name: 'Promijeni vrt' }).click();
    await expect(fixture).toHaveAttribute('data-garden-id', '2');
    await expect(canvas).toHaveCount(1);
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
