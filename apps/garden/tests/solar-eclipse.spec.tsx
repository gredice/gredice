import { expect, test } from '@playwright/experimental-ct-react';
import { SolarEclipseVisualFixture } from './SolarEclipseVisualFixture';

test('renders the 2026 Croatian partial eclipse before local sunset', async ({
    mount,
    page,
}) => {
    const browserErrors: string[] = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));

    const fixture = await mount(
        <SolarEclipseVisualFixture time="2026-08-12T17:55:00.000Z" />,
    );
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');
    await expect(fixture).toHaveAttribute('data-eclipse-obscuration', '0.478');

    const png = await fixture.locator('canvas').screenshot();
    expect(png).toMatchSnapshot('solar-eclipse-croatia-2026.png', {
        maxDiffPixelRatio: 0.001,
    });
    expect(browserErrors).toEqual([]);
});

test('renders a location-aware future eclipse and keeps forced-day mode clear', async ({
    mount,
    page,
}) => {
    const browserErrors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            browserErrors.push(message.text());
        }
    });
    page.on('pageerror', (error) => {
        browserErrors.push(error.message);
    });

    const eclipseFixture = await mount(
        <SolarEclipseVisualFixture time="2030-06-01T05:10:24.000Z" />,
    );
    await expect(eclipseFixture).toHaveAttribute('data-render-ready', 'true');
    await expect(eclipseFixture).toHaveAttribute(
        'data-eclipse-obscuration',
        '0.696',
    );

    const eclipseCanvas = eclipseFixture.locator('canvas');
    const eclipsePng = await eclipseCanvas.screenshot();
    expect(eclipsePng).toMatchSnapshot('solar-eclipse-2030.png', {
        maxDiffPixelRatio: 0.001,
    });

    await eclipseFixture.unmount();
    const clearFixture = await mount(
        <SolarEclipseVisualFixture time="2030-05-31T05:10:24.000Z" />,
    );
    await expect(clearFixture).toHaveAttribute('data-render-ready', 'true');
    await expect(clearFixture).toHaveAttribute(
        'data-eclipse-obscuration',
        '0.000',
    );
    const clearPng = await clearFixture.locator('canvas').screenshot();
    expect(clearPng).toMatchSnapshot('solar-eclipse-clear-day.png', {
        maxDiffPixelRatio: 0.001,
    });

    await clearFixture.unmount();
    const forcedDayFixture = await mount(
        <SolarEclipseVisualFixture
            dayNightCycleDisabled
            time="2030-06-01T05:10:24.000Z"
        />,
    );
    await expect(forcedDayFixture).toHaveAttribute('data-render-ready', 'true');
    await expect(forcedDayFixture).toHaveAttribute(
        'data-eclipse-obscuration',
        '0.000',
    );
    const forcedDayPng = await forcedDayFixture.locator('canvas').screenshot();
    expect(forcedDayPng).toMatchSnapshot('solar-eclipse-forced-day.png', {
        maxDiffPixelRatio: 0.001,
    });
    expect(browserErrors).toEqual([]);
});

test('keeps foreground geometry in front of the lunar occluder', async ({
    mount,
}) => {
    const fixture = await mount(
        <SolarEclipseVisualFixture
            foregroundOcclusionProbe
            time="2026-08-12T17:55:00.000Z"
        />,
    );
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');

    const png = await fixture.locator('canvas').screenshot();
    expect(png).toMatchSnapshot('solar-eclipse-foreground-occlusion.png', {
        maxDiffPixelRatio: 0.001,
    });
});
