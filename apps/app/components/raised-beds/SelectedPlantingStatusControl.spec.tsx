import { expect, test } from '@playwright/experimental-ct-react';
import { SelectedPlantingStatusControlHarness } from '../../playwright/SelectedPlantingStatusControlHarness';

test('saves the exact planting and version with the selected effective date', async ({
    mount,
    page,
}) => {
    await mount(<SelectedPlantingStatusControlHarness />);
    await page.getByRole('button', { name: 'Datum klijanja' }).click();
    await page.getByLabel('Datum stanja', { exact: true }).fill('2026-08-04');
    await page.getByRole('button', { name: 'Spremi', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute(
        'data-selected-planting-update',
        /"plantingId":20/,
    );
    const saved = JSON.parse(
        (await page
            .locator('html')
            .getAttribute('data-selected-planting-update')) ?? '[]',
    );
    expect(saved[0]).toEqual({
        kind: 'selected',
        plantingId: 20,
        expectedPlantSortId: 50,
        expectedLifecycleVersionEventId: 3,
    });
    expect(saved[1]).toBe('sprouted');
    expect(saved[3]).toContain('2026-08-04');
});

test('keeps version conflicts visible and does not pretend the update succeeded', async ({
    mount,
    page,
}) => {
    await page.evaluate(() => {
        document.documentElement.dataset.selectedPlantingUpdateError =
            'Biljka se promijenila. Osvježi stranicu.';
    });
    await mount(<SelectedPlantingStatusControlHarness />);
    await page.getByRole('button', { name: 'Datum klijanja' }).click();
    await page.getByLabel('Datum stanja', { exact: true }).fill('2026-08-04');
    await page.getByRole('button', { name: 'Spremi', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(
        'Biljka se promijenila. Osvježi stranicu.',
    );
    await expect(
        page.getByRole('button', { name: 'Spremi', exact: true }),
    ).toBeVisible();
});

test('new statuses default to today and returning to the current status restores its date', async ({
    mount,
    page,
}) => {
    await page.clock.setFixedTime(new Date('2026-09-08T12:00:00Z'));
    await mount(<SelectedPlantingStatusControlHarness />);
    await page.getByRole('button', { name: 'Datum klijanja' }).click();
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Posijana', exact: true }).click();
    await expect(page.getByLabel('Datum stanja', { exact: true })).toHaveValue(
        '2026-08-02',
    );
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Proklijala', exact: true }).click();
    await expect(page.getByLabel('Datum stanja', { exact: true })).toHaveValue(
        '2026-09-08',
    );
});
