import { expect, test } from '@playwright/experimental-ct-react';
import { OperationTaskAdminEditHarness } from '../../../playwright/OperationTaskAdminEditHarness';

for (const status of [
    'new',
    'planned',
    'pendingVerification',
    'completed',
    'blocked',
    'failed',
    'canceled',
] as const) {
    test(`editing is available for ${status} tasks`, async ({
        mount,
        page,
    }) => {
        await mount(<OperationTaskAdminEditHarness status={status} />);
        const trigger = page.getByRole('button', {
            name: 'Uredi zadatak radnje',
        });
        await expect(trigger).toHaveText('');
        await trigger.click();
        await expect(page.getByLabel('Datum radnje')).toBeEditable();
        await expect(
            page.getByRole('switch', { name: 'Potvrđena radnja' }),
        ).toBeEnabled();
        await expect(
            page.getByRole('checkbox', { name: 'Ivan' }),
        ).toBeEnabled();
    });
}

test('saves approval, assignees, dates, and preserved precision for a verified task', async ({
    mount,
    page,
}) => {
    await mount(<OperationTaskAdminEditHarness />);
    await page.getByRole('button', { name: 'Uredi zadatak radnje' }).click();
    await page.getByRole('switch', { name: 'Potvrđena radnja' }).click();
    await page.getByRole('checkbox', { name: 'Vesna' }).uncheck();
    await page.getByRole('checkbox', { name: 'Ivan' }).check();
    await page.getByLabel('Datum završetka').fill('2026-10-02T08:30');
    await page.getByLabel('Napomena korisnika').fill('Ujutro');
    await page.getByRole('button', { name: 'Spremi izmjene' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    const saved = await page.evaluate(() =>
        JSON.parse(document.documentElement.dataset.savedAdminTask ?? 'null'),
    );
    expect(saved[0]).toBe(5479);
    expect(saved[1]).toBe(42);
    expect(saved[2]).toMatchObject({
        status: 'completed',
        isAccepted: false,
        assignedUserIds: ['ivan'],
        timestamp: '2026-09-29T08:15:30.123Z',
        requestNote: 'Ujutro',
    });
    expect(saved[2].completedAt).toBe('2026-10-02T08:30:00.000Z');
});

test('a concurrent edit preserves the draft and locks save until the editor is reopened', async ({
    mount,
    page,
}) => {
    await mount(<OperationTaskAdminEditHarness />);
    await page.getByRole('button', { name: 'Uredi zadatak radnje' }).click();
    await page.getByLabel('Napomena korisnika').fill('Sačuvaj unos');
    await page.evaluate(() => {
        document.documentElement.dataset.adminTaskConflict = 'true';
    });
    await page.getByRole('button', { name: 'Spremi izmjene' }).click();
    await expect(page.getByRole('alert')).toContainText('u međuvremenu');
    await expect(page.getByLabel('Napomena korisnika')).toHaveValue(
        'Sačuvaj unos',
    );
    await expect(
        page.getByRole('button', { name: 'Spremi izmjene' }),
    ).toBeDisabled();
});

test('a save failure preserves inputs and allows retry', async ({
    mount,
    page,
}) => {
    await mount(<OperationTaskAdminEditHarness />);
    await page.getByRole('button', { name: 'Uredi zadatak radnje' }).click();
    await page.getByLabel('Napomena korisnika').fill('Nacrt');
    await page.evaluate(() => {
        document.documentElement.dataset.adminTaskFailure = 'true';
    });
    await page.getByRole('button', { name: 'Spremi izmjene' }).click();
    await expect(page.getByRole('alert')).toContainText('Pokušaj ponovno');
    await expect(page.getByLabel('Napomena korisnika')).toHaveValue('Nacrt');
    await expect(
        page.getByRole('button', { name: 'Spremi izmjene' }),
    ).toBeEnabled();
});

for (const width of [390, 768, 1440]) {
    test(`task editor fits a ${width}px viewport`, async ({ mount, page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await mount(<OperationTaskAdminEditHarness />);
        await page
            .getByRole('button', { name: 'Uredi zadatak radnje' })
            .click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        const box = await dialog.boundingBox();
        expect(box?.width).toBeLessThanOrEqual(width);
        expect(
            await dialog.evaluate(
                (element) => element.scrollWidth <= element.clientWidth,
            ),
        ).toBe(true);
        await page
            .getByRole('button', { name: 'Spremi izmjene' })
            .scrollIntoViewIfNeeded();
        await expect(
            page.getByRole('button', { name: 'Spremi izmjene' }),
        ).toBeInViewport();
        await page.screenshot({
            path: `/tmp/gredice-operation-editor-${width}.png`,
            fullPage: true,
        });
    });
}
