import { expect, test } from '@playwright/experimental-ct-react';
import { ItemsHudAlignmentStory } from './ItemsHudStory';

const TABLET_VIEWPORT = { width: 820, height: 1180 };

test('edit mode item picker stays centered on tablet layouts', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    const picker = page.locator('[data-items-hud]');
    await expect(picker).toBeVisible();

    const pickerBox = await picker.boundingBox();
    expect(pickerBox).not.toBeNull();

    const pickerCenter = (pickerBox?.x ?? 0) + (pickerBox?.width ?? 0) / 2;
    expect(
        Math.abs(pickerCenter - TABLET_VIEWPORT.width / 2),
    ).toBeLessThanOrEqual(1);
    expect((pickerBox?.x ?? 0) + (pickerBox?.width ?? 0)).toBeLessThanOrEqual(
        TABLET_VIEWPORT.width,
    );
});
