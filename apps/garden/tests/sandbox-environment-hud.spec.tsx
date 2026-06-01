import { expect, test } from '@playwright/experimental-ct-react';
import { SandboxEnvironmentHudStory } from './SandboxEnvironmentHudStory';

test('sandbox environment HUD applies weather presets', async ({
    mount,
    page,
}) => {
    await mount(<SandboxEnvironmentHudStory />);

    await page.getByTitle('Uvjeti u vrtu').click();
    await page.getByRole('button', { name: 'Snijeg' }).click();

    await expect(page.getByTestId('sandbox-weather-value')).toContainText(
        '"snowy":1',
    );
    await expect(page.getByTestId('sandbox-weather-value')).toContainText(
        '"snowAccumulation":30',
    );
});

test('sandbox environment HUD can scrub time and change date', async ({
    mount,
    page,
}) => {
    await mount(<SandboxEnvironmentHudStory />);

    const initialTimeOfDay = await page
        .getByTestId('sandbox-timeofday-value')
        .textContent();

    await page.getByTitle('Doba dana').click();

    const visualization = page.locator('[data-sandbox-time-visualization]');
    await expect(visualization).toBeVisible();

    const box = await visualization.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
        return;
    }

    await page.mouse.move(box.x + box.width * 0.84, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.up();

    await expect
        .poll(() => page.getByTestId('sandbox-timeofday-value').textContent())
        .not.toBe(initialTimeOfDay);

    await page.getByLabel('Datum').fill('2026-12-21');
    await expect(page.getByTestId('sandbox-date-value')).toHaveText(
        '2026-12-21',
    );
});
