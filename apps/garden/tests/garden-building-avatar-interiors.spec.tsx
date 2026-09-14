import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';
import { GardenBuildingAvatarInteriorsFixture } from './GardenBuildingAvatarInteriorsFixture';
import { GardenStructureCollectionVisibilityFixture } from './GardenStructureCollectionVisibilityFixture';
import { gardenBuildingAvatarDoorwayFixture } from './gardenBuildingAvatarInteriorsFixtureContract';
import { PublicGardenSwitchFixture } from './PublicGardenSwitchFixture';

async function installBlockDataRoute(page: Page) {
    await page.route(
        '**/api/gredice/api/directories/entities/block**',
        (route) => route.fulfill({ json: getLocalSandboxBlockData() }),
    );
}

async function rotateLockedAvatarCamera(canvas: Locator, movementX: number) {
    await canvas.evaluate((element, deltaX) => {
        Object.defineProperty(document, 'pointerLockElement', {
            configurable: true,
            value: element,
        });
        const move = new MouseEvent('mousemove', { bubbles: true });
        Object.defineProperties(move, {
            movementX: { value: deltaX },
            movementY: { value: 0 },
        });
        document.dispatchEvent(move);
        Reflect.deleteProperty(document, 'pointerLockElement');
    }, movementX);
}

async function prepareStructureAvatarScene({
    activateWithPrompt = true,
    canvasKey,
    expectedStructureId,
    fixture,
    page,
    verifyCameraOrbit = false,
}: {
    activateWithPrompt?: boolean;
    canvasKey: string;
    expectedStructureId: string;
    fixture: Locator;
    page: Page;
    verifyCameraOrbit?: boolean;
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
    if (verifyCameraOrbit) {
        const initialYaw = await structureScene.getAttribute(
            'data-garden-avatar-debug-yaw',
        );
        expect(initialYaw).not.toBeNull();
        const initialYawNumber = Number(initialYaw);
        await rotateLockedAvatarCamera(canvas, 270);
        await page.waitForTimeout(900);
        await expect
            .poll(() =>
                structureScene.getAttribute('data-garden-avatar-debug-yaw'),
            )
            .not.toBe(initialYaw);
        await expect(structureScene).toHaveAttribute(
            'data-garden-structure-hidden-edge-count',
            /[1-9]\d*/u,
            { timeout: 2_000 },
        );
        await rotateLockedAvatarCamera(canvas, -270);
        await expect
            .poll(async () =>
                Math.abs(
                    Number(
                        await structureScene.getAttribute(
                            'data-garden-avatar-debug-yaw',
                        ),
                    ) - initialYawNumber,
                ),
            )
            .toBeLessThan(0.001);
    }

    return { canvas, structureScene };
}

async function moveAvatarUntil(page: Page, assertion: () => Promise<void>) {
    await page.keyboard.down('s');
    try {
        await assertion();
    } finally {
        await page.keyboard.up('s');
    }
}

async function expectPersistentCanvas(canvas: Locator, canvasKey: string) {
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

async function verifyFootprintExitWithPersistentCanvas({
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
    const { canvas, structureScene } = await prepareStructureAvatarScene({
        activateWithPrompt,
        canvasKey,
        expectedStructureId,
        fixture,
        page,
    });
    await moveAvatarUntil(page, () =>
        expect(structureScene).toHaveAttribute(
            'data-garden-structure-interior-id',
            'outside',
            { timeout: 8_000 },
        ),
    );
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-hidden-instance-count',
        '0',
    );
    await expectPersistentCanvas(canvas, canvasKey);
}

test('owned avatar crosses the open room doorway into the covered porch without replacing the canvas', async ({
    mount,
    page,
}) => {
    test.setTimeout(45_000);
    await installBlockDataRoute(page);
    const fixture = await mount(<GardenBuildingAvatarInteriorsFixture />);
    const structureScene = fixture.locator(
        '[data-garden-structure-interior-id]',
    );
    await expect(structureScene).toHaveAttribute(
        'data-garden-avatar-debug-x',
        '1',
    );
    await expect(structureScene).toHaveAttribute(
        'data-garden-avatar-debug-z',
        gardenBuildingAvatarDoorwayFixture.roomSpawnZ.toString(),
    );

    const canvasKey = '__grediceOwnedDoorwayCanvas';
    const { canvas } = await prepareStructureAvatarScene({
        activateWithPrompt: false,
        canvasKey,
        expectedStructureId: 'owned-interior-house',
        fixture,
        page,
        verifyCameraOrbit: true,
    });
    await moveAvatarUntil(page, () =>
        expect
            .poll(
                async () =>
                    Number(
                        await structureScene.getAttribute(
                            'data-garden-avatar-debug-z',
                        ),
                    ),
                { timeout: 8_000 },
            )
            .toBeGreaterThan(gardenBuildingAvatarDoorwayFixture.portalZ),
    );
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-interior-id',
        'owned-interior-house',
    );
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-hidden-instance-count',
        /[1-9]\d*/u,
    );
    await expectPersistentCanvas(canvas, canvasKey);
});

test('requires both rollout flags for avatar interior semantics while preserving the saved shell', async ({
    mount,
    page,
}) => {
    await installBlockDataRoute(page);
    const fixture = await mount(
        <GardenBuildingAvatarInteriorsFixture buildingSystemEnabled={false} />,
    );
    const structureScene = fixture.locator(
        '[data-garden-structure-interior-id]',
    );

    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-rendered-count',
        '1',
    );
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-collision-status',
        'missing',
    );
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-interior-id',
        'outside',
    );
    await expect(structureScene).toHaveAttribute(
        'data-garden-structure-hidden-instance-count',
        '0',
    );
});

test('owned avatar exits the covered porch footprint without replacing the canvas', async ({
    mount,
    page,
}) => {
    test.setTimeout(45_000);
    await installBlockDataRoute(page);
    const fixture = await mount(
        <GardenBuildingAvatarInteriorsFixture
            initialSpawnZ={gardenBuildingAvatarDoorwayFixture.porchSpawnZ}
        />,
    );

    await verifyFootprintExitWithPersistentCanvas({
        activateWithPrompt: false,
        canvasKey: '__grediceOwnedFootprintExitCanvas',
        expectedStructureId: 'owned-interior-house',
        fixture,
        page,
    });
});

test('public avatar exits the covered porch with the same cutaway contract', async ({
    mount,
    page,
}) => {
    test.setTimeout(45_000);
    await installBlockDataRoute(page);
    const fixture = await mount(<PublicGardenSwitchFixture />);

    await verifyFootprintExitWithPersistentCanvas({
        canvasKey: '__gredicePublicFootprintExitCanvas',
        expectedStructureId: 'structure-1',
        fixture,
        page,
    });
});

test('removes hidden roof and wall IDs from the rendered fallback meshes', async ({
    mount,
}) => {
    const fixture = await mount(<GardenStructureCollectionVisibilityFixture />);
    const result = fixture.getByTestId('garden-structure-visibility-result');
    const roofBatchCount = Number(
        await result.getAttribute('data-roof-batch-count'),
    );
    const wallBatchCount = Number(
        await result.getAttribute('data-wall-batch-count'),
    );
    expect(roofBatchCount).toBeGreaterThan(1);
    expect(wallBatchCount).toBeGreaterThan(1);

    await expect(result).toHaveText(
        JSON.stringify({
            roof: {
                count: roofBatchCount,
                semanticFallback: true,
                visible: true,
            },
            wall: {
                count: wallBatchCount,
                semanticFallback: true,
                visible: true,
            },
        }),
    );

    await fixture
        .getByRole('button', {
            name: 'Hide cutaway instances',
        })
        .click();
    await expect(result).toHaveText(
        JSON.stringify({
            roof: {
                count: roofBatchCount - 1,
                semanticFallback: true,
                visible: true,
            },
            wall: {
                count: wallBatchCount - 1,
                semanticFallback: true,
                visible: true,
            },
        }),
    );

    await fixture
        .getByRole('button', {
            name: 'Hide target batches',
        })
        .click();
    await expect(result).toHaveText(
        JSON.stringify({
            roof: {
                count: 0,
                semanticFallback: true,
                visible: false,
            },
            wall: {
                count: 0,
                semanticFallback: true,
                visible: false,
            },
        }),
    );
});
