import { expect, test } from '@playwright/experimental-ct-react';
import { AdminDashboardHarness } from '../playwright/AdminDashboardHarness';

for (const width of [1280, 390]) {
    test(`page-level period controls and grouped statistics at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const dashboard = await mount(<AdminDashboardHarness custom />);
        const controls = dashboard
            .getByTestId('admin-page-header-slot')
            .getByRole('group', {
                name: 'Period nadzorne ploče',
            });
        await expect(
            controls.getByRole('combobox', { name: 'Odaberi period' }),
        ).toBeVisible();
        const controlsBox = await controls.boundingBox();
        const headingBox = await dashboard
            .getByRole('heading', { name: 'Računi i korisnici' })
            .boundingBox();
        expect(
            controlsBox &&
                headingBox &&
                controlsBox.y + controlsBox.height <= headingBox.y,
        ).toBeTruthy();
        await expect(controls.getByLabel('Od', { exact: true })).toHaveValue(
            '2026-10-01',
        );
        await controls.getByLabel('Do', { exact: true }).fill('2026-09-30');
        await expect(
            controls.getByRole('button', { name: 'Primijeni' }),
        ).toBeDisabled();
        await expect(
            controls.getByText('Datum početka mora biti prije datuma kraja.'),
        ).toBeVisible();
        await controls.getByLabel('Do', { exact: true }).fill('2026-10-30');
        await controls.getByRole('button', { name: 'Primijeni' }).click();
        await expect(page).toHaveURL(
            /period=custom&from=2026-10-01&to=2026-10-30/,
        );
        for (const caption of [
            'Registracije korisnika u odabranom periodu',
            'Trajanje radnji u odabranom periodu',
            'Zarađeni i potrošeni suncokreti u odabranom periodu',
        ]) {
            const table = dashboard.getByRole('table', {
                name: caption,
                includeHidden: true,
            });
            await table
                .locator('xpath=ancestor::details')
                .locator('summary')
                .click();
            await expect(table.locator('tbody tr')).toHaveCount(6);
            await expect(table.locator('tbody tr').first()).toContainText(
                '1. 10.',
            );
            await expect(table.locator('tbody tr').last()).toContainText(
                '30. 10.',
            );
        }
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBeTruthy();
    });
}

test('preset period picker shares the breadcrumb header row', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const dashboard = await mount(<AdminDashboardHarness days={7} />);
    const header = dashboard.getByTestId('admin-page-header-slot');
    const select = header.getByRole('combobox', { name: 'Odaberi period' });
    await expect(select).toBeVisible();
    const headerBox = await header.boundingBox();
    const selectBox = await select.boundingBox();
    expect(
        headerBox && selectBox && headerBox.height <= selectBox.height + 8,
    ).toBeTruthy();
});

test('single-day statistics render one daily row', async ({ mount }) => {
    const dashboard = await mount(<AdminDashboardHarness days={1} />);
    const table = dashboard.getByRole('table', {
        name: 'Registracije korisnika u odabranom periodu',
        includeHidden: true,
    });
    await table.locator('xpath=ancestor::details').locator('summary').click();
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table.locator('tbody td')).toHaveText('1');
});
