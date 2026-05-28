import { expect, test } from '@playwright/experimental-ct-react';
import { ItemsHudAlignmentStory } from './ItemsHudStory';

const TABLET_VIEWPORT = { width: 820, height: 1180 };
const SHORT_MOBILE_VIEWPORT = { width: 414, height: 600 };

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

test('pots are listed under the decoration picker', async ({ mount, page }) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    await expect(page.getByRole('button', { name: 'Tegle' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Dekoracija' }).click();

    await expect(
        page.getByRole('button', { name: 'PotLowBowl' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'PotWideLippedCup' }),
    ).toBeVisible();
});

test('item picker price buttons use the soft surface', async ({
    mount,
    page,
}) => {
    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();

    const priceButton = page
        .locator('button')
        .filter({ hasText: '10' })
        .first();
    await expect(priceButton).toBeVisible();
    await expect(priceButton).toHaveClass(/bg-primary\/10/u);
});

test('item details place button keeps the soft color treatment', async ({
    mount,
    page,
}) => {
    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();
    await page.getByRole('button', { name: 'Stool' }).click();

    const placeButton = page.getByRole('button', { name: /Postavi.*10/u });
    await expect(placeButton).toBeVisible();
    await expect(placeButton).toHaveClass(/bg-primary\/10/u);

    const pricePill = placeButton.locator('div').filter({ hasText: '10' });
    await expect(pricePill).toHaveClass(/bg-primary\/15/u);
});

test('decoration picker scrolls when the viewport is too short for all items', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(SHORT_MOBILE_VIEWPORT);
    await mount(<ItemsHudAlignmentStory />);

    await page.getByRole('button', { name: 'Dekoracija' }).click();

    const firstItem = page.getByRole('button', { name: 'PotLowBowl' });
    const lastItem = page.getByRole('button', { name: 'MulchWood' });

    await expect(firstItem).toBeVisible();

    const scrollArea = page.locator('[data-items-picker-scroll]');
    const popoverBox = await scrollArea.boundingBox();
    expect(popoverBox).not.toBeNull();
    expect(
        (popoverBox?.y ?? 0) + (popoverBox?.height ?? 0),
    ).toBeLessThanOrEqual(SHORT_MOBILE_VIEWPORT.height + 1);

    const scrollState = await scrollArea.evaluate((node) => ({
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
    }));
    expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);

    await expect(lastItem).not.toBeInViewport();
    await lastItem.scrollIntoViewIfNeeded();
    await expect(lastItem).toBeInViewport();
});
