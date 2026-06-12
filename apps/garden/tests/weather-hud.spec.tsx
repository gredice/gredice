import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import { WeatherHudStory } from './WeatherHudStory';

const DESKTOP_VIEWPORT = { width: 770, height: 610 };
const MOBILE_VIEWPORT = { width: 320, height: 568 };

async function expectWeatherTimeVisualizationWithinViewport(
    page: Page,
    viewport: { width: number; height: number },
) {
    await expect(page.getByTitle('Doba dana')).toHaveCount(0);
    await page.getByTitle('Trenutno vrijeme').click();

    const popover = page.locator('[data-weather-now-details="true"]');
    await expect(popover).toBeVisible();
    await expect(
        page.locator('[data-time-of-day-details="true"]'),
    ).toBeVisible();

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

test('weather popover includes time of day on desktop', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await mount(<WeatherHudStory />);

    await expectWeatherTimeVisualizationWithinViewport(page, DESKTOP_VIEWPORT);

    const popoverBox = await page
        .locator('[data-weather-now-details="true"]')
        .boundingBox();
    expect(popoverBox?.width ?? 0).toBeGreaterThan(360);
});

test('weather popover time of day fits on narrow mobile viewports', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await mount(<WeatherHudStory />);

    await expectWeatherTimeVisualizationWithinViewport(page, MOBILE_VIEWPORT);

    const popoverBox = await page
        .locator('[data-weather-now-details="true"]')
        .boundingBox();
    expect(popoverBox?.width ?? 0).toBeLessThanOrEqual(
        MOBILE_VIEWPORT.width - 16 + 1,
    );
});

test('weather warnings are grouped and scroll within the mobile popover', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await mount(<WeatherHudStory withAlerts />);

    await page.getByTitle('Trenutno vrijeme').click();

    const details = page.locator('[data-weather-now-details="true"]');
    await expect(details).toBeVisible();
    await expect(
        page.getByRole('button', {
            name: /Žuto upozorenje za grmljavinsku oluju.*2 razdoblja/,
        }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', {
            name: /Narančasto upozorenje za kišu.*1 razdoblje/,
        }),
    ).toBeVisible();
    await expect(page.getByText('Udar vjetra u srijedu')).toBeVisible();
    await expect(page.getByText('Udar vjetra u četvrtak')).toBeVisible();
    await expect(page.getByText('Obilna kiša u petak.')).toBeHidden();

    const detailsBox = await details.boundingBox();
    expect(detailsBox).not.toBeNull();
    expect(detailsBox?.height ?? 0).toBeLessThanOrEqual(
        MOBILE_VIEWPORT.height - 48,
    );

    const scrollStats = await page
        .locator('[data-weather-now-scroll="true"]')
        .evaluate((element) => ({
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
        }));
    expect(scrollStats.scrollHeight).toBeGreaterThan(scrollStats.clientHeight);
});
