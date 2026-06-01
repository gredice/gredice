import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import { WeatherHudTimePopoverStory } from './WeatherHudStory';

const DESKTOP_VIEWPORT = { width: 770, height: 610 };
const MOBILE_VIEWPORT = { width: 320, height: 568 };

async function expectTimePopoverWithinViewport(
    page: Page,
    viewport: { width: number; height: number },
) {
    await page.getByTitle('Doba dana').click();

    const popover = page.locator('[data-time-display="true"]');
    await expect(popover).toBeVisible();

    const popoverBox = await popover.boundingBox();
    expect(popoverBox).not.toBeNull();
    expect(popoverBox?.x ?? 0).toBeGreaterThanOrEqual(0);
    expect((popoverBox?.x ?? 0) + (popoverBox?.width ?? 0)).toBeLessThanOrEqual(
        viewport.width,
    );

    const visualization = page.locator('[data-time-of-day-visualization]');
    const visualizationBox = await visualization.boundingBox();
    expect(visualizationBox).not.toBeNull();
    expect(visualizationBox?.x ?? 0).toBeGreaterThanOrEqual(popoverBox?.x ?? 0);
    expect(
        (visualizationBox?.x ?? 0) + (visualizationBox?.width ?? 0),
    ).toBeLessThanOrEqual((popoverBox?.x ?? 0) + (popoverBox?.width ?? 0));

    const pageWidth = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scrollWidth).toBeLessThanOrEqual(
        pageWidth.clientWidth + 1,
    );
}

test('time popover has enough room on desktop', async ({ mount, page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await mount(<WeatherHudTimePopoverStory />);

    await expectTimePopoverWithinViewport(page, DESKTOP_VIEWPORT);

    const popoverBox = await page
        .locator('[data-time-display="true"]')
        .boundingBox();
    expect(popoverBox?.width ?? 0).toBeGreaterThan(360);
});

test('time popover fits on narrow mobile viewports', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await mount(<WeatherHudTimePopoverStory />);

    await expectTimePopoverWithinViewport(page, MOBILE_VIEWPORT);

    const popoverBox = await page
        .locator('[data-time-display="true"]')
        .boundingBox();
    expect(popoverBox?.width ?? 0).toBeLessThanOrEqual(
        MOBILE_VIEWPORT.width - 16 + 1,
    );
});
