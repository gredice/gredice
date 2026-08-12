import { expect, test } from '@playwright/experimental-ct-react';
import { SolarEclipseVisualFixture } from './SolarEclipseVisualFixture';

const webglSnapshotOptions = { maxDiffPixelRatio: 0.003 };
// SwiftShader rasterizes the high-contrast celestial silhouettes slightly
// differently across macOS and Linux. Keep this allowance scoped to those
// snapshots; the environment-lighting comparison remains at the stricter limit.
const celestialSnapshotOptions = { maxDiffPixelRatio: 0.006 };

async function readLightIntensities(fixture: {
    getAttribute: (name: string) => Promise<string | null>;
}) {
    const ambient = Number(
        await fixture.getAttribute('data-ambient-light-intensity'),
    );
    const directional = Number(
        await fixture.getAttribute('data-directional-light-intensity'),
    );
    const hemisphere = Number(
        await fixture.getAttribute('data-hemisphere-light-intensity'),
    );

    expect(ambient).toBeGreaterThan(0);
    expect(directional).toBeGreaterThan(0);
    expect(hemisphere).toBeGreaterThan(0);
    return { ambient, directional, hemisphere };
}

async function inspectCanvasAlpha(canvas: HTMLCanvasElement) {
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
            if (result) resolve(result);
            else reject(new Error('Could not encode eclipse canvas.'));
        }, 'image/png');
    });
    const bitmap = await createImageBitmap(blob);

    try {
        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = 60;
        sampleCanvas.height = 32;
        const context = sampleCanvas.getContext('2d', {
            willReadFrequently: true,
        });
        if (!context) throw new Error('Canvas alpha sampler is unavailable.');
        context.drawImage(bitmap, 0, 0, 60, 32);
        const pixels = context.getImageData(0, 0, 60, 32).data;
        let opaquePixels = 0;
        let transparentPixels = 0;

        for (let index = 3; index < pixels.length; index += 4) {
            if (pixels[index] === 0) transparentPixels += 1;
            if (pixels[index] === 255) opaquePixels += 1;
        }

        return { opaquePixels, transparentPixels, type: blob.type };
    } finally {
        bitmap.close();
    }
}

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
    expect(png).toMatchSnapshot(
        'solar-eclipse-croatia-2026.png',
        celestialSnapshotOptions,
    );
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
        <SolarEclipseVisualFixture
            lightingProbe
            time="2030-06-01T05:10:24.000Z"
        />,
    );
    await expect(eclipseFixture).toHaveAttribute('data-render-ready', 'true');
    await expect(eclipseFixture).toHaveAttribute(
        'data-eclipse-obscuration',
        '0.696',
    );
    const eclipseLights = await readLightIntensities(eclipseFixture);

    const eclipseCanvas = eclipseFixture.locator('canvas');
    const eclipsePng = await eclipseCanvas.screenshot();
    expect(eclipsePng).toMatchSnapshot(
        'solar-eclipse-2030.png',
        webglSnapshotOptions,
    );

    await eclipseFixture.unmount();
    const clearFixture = await mount(
        <SolarEclipseVisualFixture
            lightingProbe
            time="2030-05-31T05:10:24.000Z"
        />,
    );
    await expect(clearFixture).toHaveAttribute('data-render-ready', 'true');
    await expect(clearFixture).toHaveAttribute(
        'data-eclipse-obscuration',
        '0.000',
    );
    const clearLights = await readLightIntensities(clearFixture);
    expect(eclipseLights.ambient).toBeLessThan(clearLights.ambient * 0.55);
    expect(eclipseLights.hemisphere).toBeLessThan(
        clearLights.hemisphere * 0.55,
    );
    expect(eclipseLights.directional).toBeLessThan(
        clearLights.directional * 0.4,
    );
    const clearPng = await clearFixture.locator('canvas').screenshot();
    expect(clearPng).toMatchSnapshot(
        'solar-eclipse-clear-day.png',
        webglSnapshotOptions,
    );

    await clearFixture.unmount();
    const forcedDayFixture = await mount(
        <SolarEclipseVisualFixture
            dayNightCycleDisabled
            lightingProbe
            time="2030-06-01T05:10:24.000Z"
        />,
    );
    await expect(forcedDayFixture).toHaveAttribute('data-render-ready', 'true');
    await expect(forcedDayFixture).toHaveAttribute(
        'data-eclipse-obscuration',
        '0.000',
    );
    const forcedDayPng = await forcedDayFixture.locator('canvas').screenshot();
    expect(forcedDayPng).toMatchSnapshot(
        'solar-eclipse-forced-day.png',
        webglSnapshotOptions,
    );
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
    expect(png).toMatchSnapshot(
        'solar-eclipse-foreground-occlusion.png',
        celestialSnapshotOptions,
    );
});

test('preserves transparent capture pixels while dimming an eclipse scene', async ({
    mount,
}) => {
    const fixture = await mount(
        <SolarEclipseVisualFixture
            lightingProbe
            noBackground
            time="2030-06-01T05:10:24.000Z"
        />,
    );
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');
    await expect(fixture).toHaveAttribute('data-eclipse-obscuration', '0.696');

    const alpha = await fixture.locator('canvas').evaluate(inspectCanvasAlpha);
    expect(alpha.type).toBe('image/png');
    expect(alpha.transparentPixels).toBeGreaterThan(60 * 32 * 0.25);
    expect(alpha.opaquePixels).toBeGreaterThan(0);
});
