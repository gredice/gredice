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

test('season slider changes the date when clicked and dragged', async ({
    mount,
    page,
}) => {
    await mount(<SeasonDateControlFixture />);
    const slider = page.getByRole('slider', { name: 'Day of year' });
    const track = slider.locator('xpath=../..');
    const bounds = await track.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) return;

    const y = bounds.y + bounds.height / 2;
    await page.mouse.click(bounds.x + bounds.width * 0.8, y);
    await expect(slider).toHaveAttribute('aria-valuenow', '293');
    await expect(page.locator('output').first()).toContainText('19. 10. 2024.');
    await page.mouse.move(bounds.x + bounds.width * 0.8, y);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.2, y, { steps: 8 });
    await page.mouse.up();
    await expect(slider).toHaveAttribute('aria-valuenow', '74');
    await expect(page.locator('output').first()).toContainText('14. 03. 2024.');
});

test('season control stays hidden without debug flag', async ({
    mount,
    page,
}) => {
    await mount(<SeasonDateControlFixture enabled={false} />);
    await expect(page.getByRole('slider')).toHaveCount(0);
});
