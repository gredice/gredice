import { expect, test } from '@playwright/experimental-ct-react';
import { GardenTabStory } from './GardenTabStory';

test.describe('Garden tab', () => {
    test('disables garden deletion while raised beds are active', async ({
        mount,
        page,
    }) => {
        await mount(<GardenTabStory activeRaisedBedCount={2} />);

        await expect(page.getByText('Brisanje vrta')).toBeVisible();
        await expect(
            page.getByText(
                'Vrt ima 2 aktivnih gredica. Prvo napusti aktivne gredice, zatim obriši vrt.',
            ),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Obriši vrt' }),
        ).toBeDisabled();
    });

    test('requires typed confirmation before deleting a garden', async ({
        mount,
        page,
    }) => {
        const deleteRequests: string[] = [];
        await page.route('**/api/gredice/api/gardens/1', async (route) => {
            if (route.request().method() === 'DELETE') {
                deleteRequests.push(route.request().url());
                await route.fulfill({
                    contentType: 'application/json',
                    status: 200,
                    body: JSON.stringify({ success: true, complete: true }),
                });
                return;
            }

            await route.fallback();
        });

        await mount(<GardenTabStory activeRaisedBedCount={0} />);

        await page.getByRole('button', { name: 'Obriši vrt' }).click();
        const dialog = page.getByRole('alertdialog', {
            name: 'Brisanje vrta',
        });
        await expect(dialog).toBeVisible();
        await expect(
            dialog.getByRole('button', { name: 'Obriši vrt' }),
        ).toBeDisabled();
        expect(deleteRequests).toHaveLength(0);

        await dialog.getByLabel('Upiši "Test" za potvrdu').fill('Test');
        await dialog.getByRole('button', { name: 'Obriši vrt' }).click();

        await expect.poll(() => deleteRequests.length).toBe(1);
    });

    test('retries incomplete sandbox garden deletion until complete', async ({
        mount,
        page,
    }) => {
        let deleteRequestCount = 0;
        await page.route('**/api/gredice/api/gardens/1', async (route) => {
            if (route.request().method() === 'DELETE') {
                deleteRequestCount += 1;
                await route.fulfill({
                    contentType: 'application/json',
                    status: deleteRequestCount === 1 ? 202 : 200,
                    body: JSON.stringify({
                        success: true,
                        complete: deleteRequestCount !== 1,
                    }),
                });
                return;
            }

            await route.fallback();
        });

        await mount(<GardenTabStory activeRaisedBedCount={0} isSandbox />);

        await page.getByRole('button', { name: 'Obriši vrt' }).click();
        const dialog = page.getByRole('alertdialog', {
            name: 'Brisanje vrta',
        });
        await dialog.getByLabel('Upiši "Test" za potvrdu').fill('Test');
        await dialog.getByRole('button', { name: 'Obriši vrt' }).click();

        await expect.poll(() => deleteRequestCount).toBe(2);
    });

    test('shows blocked delete errors returned by the API', async ({
        mount,
        page,
    }) => {
        await page.route('**/api/gredice/api/gardens/1', async (route) => {
            if (route.request().method() === 'DELETE') {
                await route.fulfill({
                    contentType: 'application/json',
                    status: 409,
                    body: JSON.stringify({
                        error: 'Garden cannot be deleted while it has active raised beds',
                        activeRaisedBedCount: 1,
                    }),
                });
                return;
            }

            await route.fallback();
        });

        await mount(<GardenTabStory activeRaisedBedCount={0} />);

        await page.getByRole('button', { name: 'Obriši vrt' }).click();
        const dialog = page.getByRole('alertdialog', {
            name: 'Brisanje vrta',
        });
        await dialog.getByLabel('Upiši "Test" za potvrdu').fill('Test');
        await dialog.getByRole('button', { name: 'Obriši vrt' }).click();

        await expect(
            page.getByText('Prije brisanja vrta napusti 1 aktivnu gredicu.'),
        ).toBeVisible();
    });
});
