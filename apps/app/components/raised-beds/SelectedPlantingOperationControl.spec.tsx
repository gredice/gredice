import { expect, test } from '@playwright/experimental-ct-react';
import { SelectedPlantingOperationControlHarness } from '../../playwright/SelectedPlantingOperationControlHarness';

test('creates a task with the exact planting identity and links to it', async ({
    mount,
    page,
}) => {
    await mount(<SelectedPlantingOperationControlHarness />);
    await page.getByRole('button', { name: 'Dodaj radnju' }).click();
    await page.getByRole('button', { name: 'Kreiraj' }).click();
    await expect(
        page.getByRole('link', { name: 'Radnja #101' }),
    ).toHaveAttribute('href', '/admin/operations/101');
    const call = await page.evaluate(
        () => document.documentElement.dataset.selectedPlantingOperation,
    );
    expect(JSON.parse(call ?? 'null')).toEqual([
        {
            kind: 'selected',
            plantingId: 20,
            expectedPlantSortId: 50,
            expectedLifecycleVersionEventId: 3,
        },
        593,
    ]);
});

test('refreshing the crop and its choices resets the pending operation selection', async ({
    mount,
    page,
}) => {
    await mount(<SelectedPlantingOperationControlHarness recoverable />);
    await page.getByRole('button', { name: 'Dodaj radnju' }).click();
    await expect(page.getByRole('combobox')).toContainText('Uklanjanje');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Oporavi sadnju' }).click();
    await page.getByRole('button', { name: 'Dodaj radnju' }).click();
    await expect(page.getByRole('combobox')).toContainText('Presađivanje');
    await page.getByRole('button', { name: 'Kreiraj' }).click();
    await expect(page.getByRole('link', { name: 'Radnja #101' })).toBeVisible();
    const call = await page.evaluate(
        () => document.documentElement.dataset.selectedPlantingOperation,
    );
    expect(JSON.parse(call ?? 'null')).toEqual([
        {
            kind: 'selected',
            plantingId: 20,
            expectedPlantSortId: 50,
            expectedLifecycleVersionEventId: 4,
        },
        593,
    ]);
});
