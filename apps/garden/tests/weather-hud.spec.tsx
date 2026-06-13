import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import { TimeOfDayVisualization } from '../../../packages/game/src/hud/components/TimeOfDayVisualization';
import { WeatherHudStory } from './WeatherHudStory';

const DESKTOP_VIEWPORT = { width: 770, height: 610 };
const MOBILE_VIEWPORT = { width: 320, height: 568 };
const LAYOUT_EDGE_TOLERANCE_PX = 8;
const MARKER_EDGE_TOLERANCE_PX = 2;

async function expectWeatherTimeVisualizationWithinViewport(
    page: Page,
    viewport: { width: number; height: number },
) {
    await expect(page.getByTitle('Doba dana')).toHaveCount(0);
    await page.getByTitle('Trenutno vrijeme').click();

    const popover = page.locator('[data-weather-now-details="true"]');
    const timeOfDayDetails = page.locator('[data-time-of-day-details="true"]');
    await expect(popover).toBeVisible();
    await expect(timeOfDayDetails).toBeVisible();

    const popoverBox = await popover.boundingBox();
    const timeOfDayDetailsBox = await timeOfDayDetails.boundingBox();
    expect(popoverBox).not.toBeNull();
    expect(timeOfDayDetailsBox).not.toBeNull();
    expect(popoverBox?.x ?? 0).toBeGreaterThanOrEqual(0);
    expect((popoverBox?.x ?? 0) + (popoverBox?.width ?? 0)).toBeLessThanOrEqual(
        viewport.width,
    );
    expect(timeOfDayDetailsBox?.x ?? 0).toBeGreaterThanOrEqual(
        (popoverBox?.x ?? 0) - LAYOUT_EDGE_TOLERANCE_PX,
    );
    expect(
        (timeOfDayDetailsBox?.x ?? 0) + (timeOfDayDetailsBox?.width ?? 0),
    ).toBeLessThanOrEqual(
        (popoverBox?.x ?? 0) +
            (popoverBox?.width ?? 0) +
            LAYOUT_EDGE_TOLERANCE_PX,
    );

    const visualization = page.locator('[data-time-of-day-visualization]');
    const visualizationBox = await visualization.boundingBox();
    expect(visualizationBox).not.toBeNull();
    expect(
        Math.abs((visualizationBox?.x ?? 0) - (timeOfDayDetailsBox?.x ?? 0)),
    ).toBeLessThanOrEqual(LAYOUT_EDGE_TOLERANCE_PX);
    expect(
        Math.abs(
            (visualizationBox?.width ?? 0) - (timeOfDayDetailsBox?.width ?? 0),
        ),
    ).toBeLessThanOrEqual(LAYOUT_EDGE_TOLERANCE_PX);

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

test('forecast popover scrolls within desktop viewport with time of day', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await mount(<WeatherHudStory />);

    await page.getByTitle('Prognoza vremena').click();
    await page.getByRole('button', { name: 'Sve' }).click();

    const details = page.locator('[data-weather-forecast-details="true"]');
    await expect(details).toBeVisible();
    await expect(
        details.locator('[data-time-of-day-details="true"]'),
    ).toBeVisible();

    const detailsBox = await details.boundingBox();
    expect(detailsBox).not.toBeNull();
    expect(detailsBox?.height ?? 0).toBeLessThanOrEqual(
        DESKTOP_VIEWPORT.height - 48,
    );

    const timeOfDayDetailsBox = await details
        .locator('[data-time-of-day-details="true"]')
        .boundingBox();
    const visualizationBox = await details
        .locator('[data-time-of-day-visualization]')
        .boundingBox();
    expect(timeOfDayDetailsBox).not.toBeNull();
    expect(visualizationBox).not.toBeNull();
    expect(
        Math.abs((visualizationBox?.x ?? 0) - (timeOfDayDetailsBox?.x ?? 0)),
    ).toBeLessThanOrEqual(LAYOUT_EDGE_TOLERANCE_PX);
    expect(
        Math.abs(
            (visualizationBox?.width ?? 0) - (timeOfDayDetailsBox?.width ?? 0),
        ),
    ).toBeLessThanOrEqual(LAYOUT_EDGE_TOLERANCE_PX);

    const scrollStats = await page
        .locator('[data-weather-forecast-scroll="true"]')
        .evaluate((element) => ({
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
        }));
    expect(scrollStats.scrollHeight).toBeGreaterThan(scrollStats.clientHeight);
});

for (const timeOfDay of [0, 1]) {
    test(`compact time of day keeps the endpoint marker inside the clipped band at ${timeOfDay}`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width: 320, height: 180 });

        await mount(
            <div
                className="w-[280px] overflow-hidden"
                data-testid="clipped-band"
            >
                <TimeOfDayVisualization compact timeOfDay={timeOfDay} />
            </div>,
        );

        const bandBox = await page.getByTestId('clipped-band').boundingBox();
        const markerBox = await page
            .locator('[data-time-of-day-marker="true"]')
            .boundingBox();

        expect(bandBox).not.toBeNull();
        expect(markerBox).not.toBeNull();
        expect(markerBox?.x ?? 0).toBeGreaterThanOrEqual(
            (bandBox?.x ?? 0) - MARKER_EDGE_TOLERANCE_PX,
        );
        expect(
            (markerBox?.x ?? 0) + (markerBox?.width ?? 0),
        ).toBeLessThanOrEqual(
            (bandBox?.x ?? 0) +
                (bandBox?.width ?? 0) +
                MARKER_EDGE_TOLERANCE_PX,
        );
    });
}

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
