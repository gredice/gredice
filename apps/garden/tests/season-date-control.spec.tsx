import { expect, test } from '@playwright/experimental-ct-react';
import { SeasonDateControlFixture } from './SeasonDateControlFixture';

test('season slider supports keyboard, milestones, external dates and reset', async ({
    mount,
    page,
}) => {
    await mount(<SeasonDateControlFixture />);
    const slider = page.getByRole('slider', { name: 'Day of year' });
    await expect(slider).toHaveAttribute('max', '366');
    await page.getByRole('button', { name: 'Mid autumn' }).click();
    await expect(page.getByText('22. 10. 2024. · mid autumn')).toBeVisible();
    await expect(page.locator('[data-clock]')).toHaveAttribute(
        'data-clock',
        '18:30',
    );
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('23. 10. 2024. · mid autumn')).toBeVisible();
    await page.getByRole('button', { name: 'External leap date' }).click();
    await expect(slider).toHaveAttribute('aria-valuenow', '60');
    await page.getByRole('button', { name: 'Winter start' }).click();
    await expect(page.locator('[data-clock]')).toHaveAttribute(
        'data-clock',
        '22:15',
    );
    await page.getByRole('button', { name: 'Reset time' }).click();
    await expect(page.locator('[data-clock]')).toHaveAttribute(
        'data-clock',
        'live',
    );
});

test('season control stays hidden without debug flag', async ({
    mount,
    page,
}) => {
    await mount(<SeasonDateControlFixture enabled={false} />);
    await expect(page.getByRole('slider')).toHaveCount(0);
});
