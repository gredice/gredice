import { expect, type Page, test } from '@playwright/experimental-ct-react';
import { GardenTabStory } from './GardenTabStory';

async function openDangerZone(page: Page) {
    await page.getByRole('button', { name: /Zona opasnosti/ }).click();
}

test.describe('Garden tab', () => {
    test('saves the current camera snapshot as the garden home position', async ({
        mount,
        page,
    }) => {
        const patchBodies: unknown[] = [];
        await page.route('**/api/gredice/api/gardens/1', async (route) => {
            if (route.request().method() === 'PATCH') {
                patchBodies.push(route.request().postDataJSON());
                await route.fulfill({
                    contentType: 'application/json',
                    status: 200,
                    body: JSON.stringify({ success: true }),
                });
                return;
            }

            await route.fallback();
        });

        await mount(
            <GardenTabStory
                cameraSnapshot={{
                    position: [12, 80, -18],
                    target: [4, 0, -6],
                    version: 7,
                    zoom: 140,
                }}
            />,
        );

        await page
            .getByRole('button', { name: 'Postavi trenutni prikaz' })
            .click();

        await expect
            .poll(() => patchBodies)
            .toEqual([
                {
                    homeCamera: {
                        position: [12, 80, -18],
                        target: [4, 0, -6],
                        zoom: 140,
                    },
                },
            ]);
        await expect(
            page.getByText('Početni položaj je spremljen.'),
        ).toBeVisible();
    });

    test('keeps destructive actions collapsed under the danger zone by default', async ({
        mount,
        page,
    }) => {
        await mount(<GardenTabStory activeRaisedBedCount={0} />);

        const dangerZoneButton = page.getByRole('button', {
            name: /Zona opasnosti/,
        });
        await expect(dangerZoneButton).toBeVisible();
        await expect(
            page.getByText('Napuštanje gredice', { exact: true }),
        ).toHaveCount(0);
        await expect(
            page.getByText('Brisanje vrta', { exact: true }),
        ).toHaveCount(0);

        await openDangerZone(page);

        await expect(
            page.getByText('Napuštanje gredice', { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByText('Brisanje vrta', { exact: true }),
        ).toBeVisible();
        const deleteButton = page.getByRole('button', {
            name: 'Obriši vrt',
        });
        const [dangerZoneBackground, deleteButtonBackground] =
            await Promise.all([
                dangerZoneButton.evaluate(
                    (element) => getComputedStyle(element).backgroundColor,
                ),
                deleteButton.evaluate(
                    (element) => getComputedStyle(element).backgroundColor,
                ),
            ]);
        expect(deleteButtonBackground).not.toBe(dangerZoneBackground);
        await expect(deleteButton).toHaveCSS('border-top-width', '0px');
        await expect(deleteButton).toHaveCSS('padding-top', '0px');
    });

    test('disables garden deletion while raised beds are active', async ({
        mount,
        page,
    }) => {
        await mount(<GardenTabStory activeRaisedBedCount={2} />);
        await openDangerZone(page);

        await expect(
            page.getByText('Brisanje vrta', { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByText(
                'Vrt ima 2 aktivnih gredica. Prvo napusti aktivne gredice, zatim obriši vrt.',
            ),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Obriši vrt' }),
        ).toBeDisabled();
    });

    test('requires an active raised bed selection and confirmation before abandonment', async ({
        mount,
        page,
    }) => {
        const abandonRequests: string[] = [];
        await page.route(
            '**/api/gredice/api/gardens/1/raised-beds/*/abandon',
            async (route) => {
                if (route.request().method() === 'POST') {
                    abandonRequests.push(route.request().url());
                    await route.fulfill({
                        contentType: 'application/json',
                        status: 201,
                        body: JSON.stringify({ id: 99 }),
                    });
                    return;
                }

                await route.fallback();
            },
        );

        await mount(<GardenTabStory activeRaisedBedCount={2} />);
        await openDangerZone(page);

        const abandonButton = page.getByRole('button', {
            name: 'Napusti gredicu',
        });
        await expect(abandonButton).toBeDisabled();

        await page.getByLabel('Aktivna gredica').click();
        await expect(
            page.getByRole('option', { name: 'Gredica 3' }),
        ).toHaveCount(0);
        await page.getByRole('option', { name: 'Gredica 2' }).click();
        await expect(abandonButton).toBeEnabled();

        await abandonButton.click();
        const dialog = page.getByRole('alertdialog', {
            name: 'Napuštanje gredice',
        });
        await expect(dialog).toBeVisible();
        expect(abandonRequests).toHaveLength(0);

        await dialog.getByRole('button', { name: 'Napusti gredicu' }).click();

        await expect.poll(() => abandonRequests.length).toBe(1);
        expect(abandonRequests[0]).toContain(
            '/gardens/1/raised-beds/2/abandon',
        );
        await expect(
            page.getByText(
                'Postupak napuštanja gredice „Gredica 2” je pokrenut.',
            ),
        ).toBeVisible();
    });

    test('disables raised bed abandonment when the garden has no active beds', async ({
        mount,
        page,
    }) => {
        await mount(<GardenTabStory activeRaisedBedCount={0} />);
        await openDangerZone(page);

        await expect(page.getByLabel('Aktivna gredica')).toBeDisabled();
        await expect(
            page.getByText('Vrt nema aktivnih gredica za napuštanje.'),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Napusti gredicu' }),
        ).toBeDisabled();
    });

    test('shows a recoverable error when raised bed eligibility changes before confirmation', async ({
        mount,
        page,
    }) => {
        await page.route(
            '**/api/gredice/api/gardens/1/raised-beds/*/abandon',
            async (route) => {
                await route.fulfill({
                    contentType: 'application/json',
                    status: 409,
                    body: JSON.stringify({
                        error: 'Only active raised beds can be abandoned',
                    }),
                });
            },
        );

        await mount(<GardenTabStory activeRaisedBedCount={1} />);
        await openDangerZone(page);

        await page.getByLabel('Aktivna gredica').click();
        await page.getByRole('option', { name: 'Gredica 1' }).click();
        await page.getByRole('button', { name: 'Napusti gredicu' }).click();
        await page
            .getByRole('alertdialog', { name: 'Napuštanje gredice' })
            .getByRole('button', { name: 'Napusti gredicu' })
            .click();

        await expect(
            page.getByText(
                'Odabrana gredica više nije aktivna. Osvježi popis i odaberi drugu gredicu.',
            ),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Napusti gredicu' }),
        ).toBeEnabled();
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
        await openDangerZone(page);

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
        await openDangerZone(page);

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
        await openDangerZone(page);

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
