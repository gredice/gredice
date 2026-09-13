import { expect, test } from '@playwright/experimental-ct-react';
import { PlantStateRequestForm } from './[raisedBedId]/PlantStateRequestForm';

test('status chip opens, closes and submits the original bed and field identity', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const component = await mount(
        <div style={{ width: 90 }}>
            <PlantStateRequestForm
                raisedBedId={498}
                positionIndex={11}
                currentStatus="sowed"
            />
        </div>,
    );
    const chip = component.getByRole('button', {
        name: /Promijeni stanje biljke/,
    });
    await chip.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await chip.click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await chip.focus();
    await page.keyboard.press('Enter');
    await page
        .getByRole('button', {
            name: 'Zatraži promjenu u Proklijala',
            exact: true,
        })
        .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(
        await page.evaluate(() => window.plantStateTest?.submission),
    ).toEqual({ raisedBedId: '498', positionIndex: '11', status: 'sprouted' });
    expect(
        await chip
            .locator('[data-plant-status-icon]')
            .evaluate((element) => element.getBoundingClientRect().width),
    ).toBeGreaterThanOrEqual(20);
});

test('keeps errors visible in the picker and pending requests disabled', async ({
    mount,
    page,
}) => {
    await page.evaluate(() => {
        window.plantStateTest = { fail: true };
    });
    const component = await mount(
        <PlantStateRequestForm
            raisedBedId={498}
            positionIndex={11}
            currentStatus="sowed"
        />,
    );
    await page.getByRole('button', { name: /Promijeni stanje biljke/ }).click();
    await page
        .getByRole('button', {
            name: 'Zatraži promjenu u Proklijala',
            exact: true,
        })
        .click();
    await expect(
        page.getByText('Promjena nije spremljena. Pokušajte ponovno.'),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await component.update(
        <PlantStateRequestForm
            raisedBedId={498}
            positionIndex={11}
            currentStatus="sowed"
            pendingRequestedStatus="sprouted"
        />,
    );
    await expect(
        page.getByRole('button', { name: 'Posijana', exact: true }),
    ).toBeDisabled();
    await expect(page.getByText('Čeka: Proklijala')).toBeVisible();
});

test('long status chips stay inside a narrow mobile field', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await mount(
        <div style={{ width: 78 }}>
            <PlantStateRequestForm
                raisedBedId={498}
                positionIndex={1}
                currentStatus="ready"
            />
        </div>,
    );
    const chip = page.getByRole('button', { name: /Promijeni stanje biljke/ });
    expect(
        await chip.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
        ),
    ).toBe(true);
});
