import { expect, test } from '@playwright/experimental-ct-react';
import { TimeDisplayStory } from './TimeDisplayStory';

test('time display visualization is read-only without debug', async ({
    mount,
    page,
}) => {
    await mount(<TimeDisplayStory />);

    await expect(page.getByRole('img', { name: 'Doba dana' })).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Doba dana' })).toHaveCount(
        0,
    );

    const initialTimeOfDay = await page
        .getByTestId('time-display-timeofday')
        .textContent();
    const visualization = page.locator('[data-time-of-day-visualization]');
    const box = await visualization.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
        return;
    }

    await page.mouse.click(box.x + box.width * 0.84, box.y + box.height * 0.5);
    await expect(page.getByTestId('time-display-timeofday')).toHaveText(
        initialTimeOfDay ?? '',
    );
});

test('time display visualization scrubs time when debug is enabled', async ({
    mount,
    page,
}) => {
    await mount(<TimeDisplayStory debug />);

    const initialTimeOfDay = await page
        .getByTestId('time-display-timeofday')
        .textContent();
    const visualization = page.getByRole('slider', { name: 'Doba dana' });
    await expect(visualization).toBeVisible();

    const box = await visualization.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
        return;
    }

    await page.mouse.click(box.x + box.width * 0.84, box.y + box.height * 0.5);
    await expect
        .poll(() => page.getByTestId('time-display-timeofday').textContent())
        .not.toBe(initialTimeOfDay);
});
