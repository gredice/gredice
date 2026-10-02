import { expect, test } from '@playwright/experimental-ct-react';
import {
    GardenBoxStoreHookStory,
    InventoryHudBackpackOpenStory,
    InventoryHudClosedStory,
    InventoryHudGardenBoxesOpenStory,
    InventoryHudStoredPacksStory,
    InventoryHudTriggerlessStory,
} from './InventoryHudStory';

test('inventory requests responsive plant thumbnails at their rendered size', async ({
    mount,
    page,
}) => {
    await mount(<InventoryHudBackpackOpenStory />);

    const plantImage = page.getByRole('img', { name: 'Cherry rajčica' });

    await expect(plantImage).toHaveAttribute(
        'sizes',
        '(max-width: 767px) calc((100vw - 5.5rem) / 6), 68px',
    );
    expect(
        await plantImage.evaluate(
            (image) => image.getBoundingClientRect().width,
        ),
    ).toBeGreaterThan(64);
});

test('inventory HUD badge counts backpack items without garden box contents', async ({
    mount,
    page,
}) => {
    await mount(<InventoryHudClosedStory />);

    const inventoryButton = page.locator('button[title="Inventar"]');
    const inventoryIcon = inventoryButton.locator(
        '[data-inventory-trigger-icon]',
    );
    const inventoryHudShell = page.locator('[data-inventory-hud-shell]');

    await expect(inventoryButton).toBeVisible();
    await expect(inventoryHudShell).toHaveCSS('width', '48px');
    await expect(inventoryHudShell).toHaveCSS('height', '48px');
    await expect(inventoryHudShell).toHaveClass(/rounded-full/u);
    await expect(inventoryIcon).toHaveAttribute(
        'src',
        '/assets/hud/inventory-backpack.webp',
    );
    await expect(inventoryIcon).toHaveClass(/-translate-y-2\.5/u);
    const inventoryBadge = inventoryButton.getByText('3', { exact: true });
    await expect(inventoryBadge).toBeVisible();
    await expect(inventoryBadge).toHaveClass(/pointer-events-none/u);
    await expect(inventoryButton.getByText('32', { exact: true })).toHaveCount(
        0,
    );
    await expect(inventoryButton.getByText('29', { exact: true })).toHaveCount(
        0,
    );
});

test('inventory can open directly on garden boxes tab', async ({
    mount,
    page,
}) => {
    await mount(<InventoryHudGardenBoxesOpenStory />);

    const inventoryDialog = page.getByRole('dialog');
    const modalIcon = inventoryDialog.locator('[data-inventory-modal-icon]');

    await expect(inventoryDialog).toBeVisible();
    await expect(modalIcon).toHaveAttribute(
        'src',
        '/assets/hud/inventory-backpack.webp',
    );
    await modalIcon.evaluate(async (artwork) => {
        const image = new Image();
        image.src = artwork.getAttribute('src') ?? '';
        await image.decode();
    });
    const backpackTab = page.getByRole('tab', { name: /^Ruksak\b/u });
    const backpackArtwork = backpackTab.locator('svg image');
    await expect(backpackArtwork).toHaveAttribute('href', /backpack.*\.webp/u);
    await backpackArtwork.evaluate(async (artwork) => {
        const image = new Image();
        image.src = artwork.getAttribute('href') ?? '';
        await image.decode();
    });
    await expect(
        page.getByRole('tab', { name: /Kutije\s+1/u }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Vrtna kutija 1')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Bucket' })).toBeVisible();
    await expect(page.getByText(/Predmeti u ruksaku koje možeš/u)).toBeHidden();
});

test('garden box block item can be placed back into the garden', async ({
    mount,
    page,
}) => {
    let placeRequestCount = 0;
    await page.route(
        /\/api(?:\/gredice)?\/inventory\/garden-boxes\/1\/garden-box-1\/items\/block\/1\/place$/u,
        async (route) => {
            placeRequestCount += 1;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'placed-block-1',
                    position: { x: 0, y: 0 },
                    item: {
                        amount: 1,
                        entityId: '1',
                        entityTypeName: 'block',
                    },
                }),
            });
        },
    );

    await mount(<InventoryHudGardenBoxesOpenStory />);

    await page
        .locator('button', { has: page.getByRole('img', { name: 'Bucket' }) })
        .click();

    await expect(page.getByRole('dialog', { name: 'Bucket' })).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Dodaj u vrt' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Dodaj u vrt' }).click();

    await expect.poll(() => placeRequestCount).toBe(1);
    await expect(page.getByRole('dialog', { name: 'Bucket' })).toBeHidden();
});

test('inventory opens without a HUD shell for avatar garden box interactions', async ({
    mount,
    page,
}) => {
    await mount(<InventoryHudTriggerlessStory />);

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Vrtna kutija 1')).toBeVisible();
    await expect(page.locator('[data-inventory-hud-shell]')).toHaveCount(0);
    await expect(page.locator('button[title="Inventar"]')).toHaveCount(0);
});

test('exact stored units stay separate from ordinary blocks and retain retry identity after a lost response', async ({
    mount,
    page,
}) => {
    const operations: string[] = [];
    let placed = false;
    const purchaseId = '12345678-1234-4234-8234-123456789012';
    await page.route(
        '**/api/accounts/current/garden-packs/**/retrieve',
        async (route) => {
            const request = route.request().postDataJSON();
            operations.push(request.operationId);
            expect(route.request().url()).toContain(
                `${purchaseId}/units/bucket/1/retrieve`,
            );
            expect(request.gardenBoxBlockId).toBe('garden-box-1');
            if (operations.length === 1) {
                await route.abort('failed');
                return;
            }
            placed = true;
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    blockId: 'stored-block-1',
                    variant: null,
                    position: { x: 0, y: 0 },
                }),
            });
        },
    );
    await page.route('**/api/inventory', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                items: [],
                gardenBoxes: [
                    {
                        blockId: 'garden-box-1',
                        gardenId: 1,
                        gardenName: 'Test garden',
                        items: [
                            {
                                entityId: '1',
                                entityTypeName: 'block',
                                amount: 1,
                                name: 'Bucket',
                            },
                            ...(placed ? [2] : [1, 2]).map((unitOrdinal) => ({
                                entityId: '1',
                                entityTypeName: 'block',
                                amount: 1,
                                name: 'Bucket',
                                packUnit: {
                                    purchaseId,
                                    lineId: 'bucket',
                                    unitOrdinal,
                                },
                                blockId: `stored-block-${unitOrdinal}`,
                                variant: null,
                            })),
                        ],
                    },
                ],
            }),
        }),
    );
    await mount(<InventoryHudStoredPacksStory />);
    await expect(page.locator('[data-stored-pack-unit]')).toHaveCount(2);
    await expect(page.getByText('1/6 vrsta · 3/60 blokova')).toBeVisible();
    await page
        .locator(`[data-stored-pack-unit="${purchaseId}:bucket:1"]`)
        .click();
    await page
        .getByRole('button', { name: 'Dodaj u vrt', exact: true })
        .click();
    await expect(
        page.getByText(/Failed to fetch|NetworkError|Load failed/u),
    ).toBeVisible();
    await expect(page.locator('[data-stored-pack-unit]')).toHaveCount(2);
    await page
        .getByRole('button', { name: 'Dodaj u vrt', exact: true })
        .click();
    await expect(
        page.locator(`[data-stored-pack-unit="${purchaseId}:bucket:1"]`),
    ).toHaveCount(0);
    await expect(
        page.locator(`[data-stored-pack-unit="${purchaseId}:bucket:2"]`),
    ).toHaveCount(1);
    expect(operations).toHaveLength(2);
    expect(operations[1]).toBe(operations[0]);
});

test('store hook retains an exact command after a lost response and clears it after a definitive rejection', async ({
    mount,
    page,
}) => {
    const operations: string[] = [];
    await page.route('**/store-in-garden-box', async (route) => {
        const request = route.request().postDataJSON();
        operations.push(request.operationId);
        expect(request.sourcePosition).toEqual({ x: 0, z: 0 });
        expect(request.blockIndex).toBe(1);
        if (operations.length === 1) await route.abort('failed');
        else
            await route.fulfill({
                status: 409,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Changed source' }),
            });
    });
    await page.route('**/api/inventory', (route) => route.abort());
    await mount(<GardenBoxStoreHookStory />);
    await page
        .getByRole('button', { name: 'Store exact fixture block' })
        .click();
    await expect(page.getByTestId('store-error')).toContainText(
        /Failed to fetch|NetworkError|Load failed/,
    );
    await page
        .getByRole('button', { name: 'Store exact fixture block' })
        .click();
    await expect(page.getByTestId('store-error')).toContainText(
        'Changed source',
    );
    expect(operations[1]).toBe(operations[0]);
    await page
        .getByRole('button', { name: 'Store exact fixture block' })
        .click();
    await expect.poll(() => operations.length).toBe(3);
    expect(operations[2]).not.toBe(operations[1]);
});
for (const scope of ['account', 'garden']) {
    test(`store hook rejects ${scope} changes during optimistic mutation before sending`, async ({
        mount,
        page,
    }) => {
        let requests = 0;
        await page.route('**/store-in-garden-box', async (route) => {
            requests++;
            await route.abort();
        });
        await mount(<GardenBoxStoreHookStory />);
        await page
            .getByRole('button', { name: `Store and switch ${scope}` })
            .click();
        await expect(page.getByTestId('store-error')).toContainText(
            'promijenio se',
        );
        expect(requests).toBe(0);
    });
}
