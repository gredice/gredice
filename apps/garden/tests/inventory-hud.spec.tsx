import { expect, test } from '@playwright/experimental-ct-react';
import { InventoryHudGardenBoxesOpenStory } from './InventoryHudStory';

test('inventory can open directly on garden boxes tab', async ({
    mount,
    page,
}) => {
    await mount(<InventoryHudGardenBoxesOpenStory />);

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
        page.getByRole('tab', { name: /Kutije\s+1/u }),
    ).toHaveAttribute('data-state', 'active');
    await expect(page.getByText('Vrtna kutija 1')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Bucket' })).toBeVisible();
    await expect(page.getByText(/Predmeti u ruksaku koje možeš/u)).toBeHidden();
});

test('garden box block item can be placed back into the garden', async ({
    mount,
    page,
}) => {
    let placeRequestCount = 0;
    await page.route('**/api/gredice/**', async (route) => {
        const url = new URL(route.request().url());
        const method = route.request().method();

        if (
            method === 'POST' &&
            url.pathname.endsWith(
                '/api/inventory/garden-boxes/1/garden-box-1/items/block/1/place',
            )
        ) {
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
            return;
        }

        if (method === 'GET' && url.pathname.endsWith('/api/inventory')) {
            await route.fulfill({
                status: 200,
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
                                    amount: 1,
                                    entityId: '1',
                                    entityTypeName: 'block',
                                    name: 'Bucket',
                                },
                            ],
                        },
                    ],
                }),
            });
            return;
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({}),
        });
    });

    await mount(<InventoryHudGardenBoxesOpenStory />);

    await page.getByRole('button', { name: 'Bucket' }).click();

    await expect(page.getByText(/Dodaj ovaj blok natrag u vrt/u)).toBeVisible();
    await expect(page.getByText(/bez trošenja suncokreta/u)).toBeVisible();

    await page.getByRole('button', { name: 'Dodaj u vrt' }).click();

    await expect.poll(() => placeRequestCount).toBe(1);
    await expect(page.getByRole('dialog', { name: 'Bucket' })).toBeHidden();
});
