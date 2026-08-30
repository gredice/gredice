import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';
import { GardenBuildingAvatarInteriorsFixture } from './GardenBuildingAvatarInteriorsFixture';
import { PublicGardenSwitchFixture } from './PublicGardenSwitchFixture';

async function installBlockDataRoute(page: Page) {
    await page.route(
        '**/api/gredice/api/directories/entities/block**',
        (route) => route.fulfill({ json: getLocalSandboxBlockData() }),
    );
}

async function verifyEntryExitWithPersistentCanvas({
    activateWithPrompt = true,
    canvasKey,
    expectedStructureId,
    fixture,
    page,
}: {
    activateWithPrompt?: boolean;
    canvasKey: string;
    expectedStructureId: string;
    fixture: Locator;
    page: Page;
}) {
    const canvas = fixture.locator('canvas');
    const structureScene = fixture.locator(
        '[data-garden-structure-interior-id]',
    );
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toBeVisible({ timeout: 35_000 });
    await canvas.evaluate(
        (element, key) => Reflect.set(window, key, element),
        canvasKey,
    );

    if (activateWithPrompt) {
        await expect(structureScene).toHaveAttribute(
            'data-garden-structure-interior-id',
            'outside',
        );
        await fixture.getByRole('button', { name: 'Prošetaj vrtom' }).click();
    }
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-interior-id',
        expectedStructureId,
    );
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-hidden-instance-count',
        /[1-9]\d*/u,
    );

    await page.keyboard.down('s');
    await page.waitForTimeout(1_400);
    await page.keyboard.up('s');
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-interior-id',
        'outside',
    );
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-hidden-instance-count',
        '0',
    );
    await expect(canvas).toHaveCount(1);
    await expect
        .poll(() =>
            canvas.evaluate(
                (element, key) => Reflect.get(window, key) === element,
                canvasKey,
            ),
        )
        .toBe(true);
}

test('owned avatar enters and exits one semantic structure without replacing the canvas', async ({
    mount,
    page,
}) => {
    test.setTimeout(45_000);
    await installBlockDataRoute(page);
    const fixture = await mount(<GardenBuildingAvatarInteriorsFixture />);

    await verifyEntryExitWithPersistentCanvas({
        activateWithPrompt: false,
        canvasKey: '__grediceOwnedInteriorCanvas',
        expectedStructureId: 'owned-interior-house',
        fixture,
        page,
    });
});

test('public avatar uses the same entry and exit cutaway contract', async ({
    mount,
    page,
}) => {
    test.setTimeout(45_000);
    await installBlockDataRoute(page);
    const fixture = await mount(<PublicGardenSwitchFixture />);

    await verifyEntryExitWithPersistentCanvas({
        canvasKey: '__gredicePublicInteriorCanvas',
        expectedStructureId: 'structure-1',
        fixture,
        page,
    });
});
