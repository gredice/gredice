import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import sharp from 'sharp';
import {
    publicEnvironmentWeatherPresets,
    resolvePublicEnvironmentDateAtMinutes,
    resolvePublicEnvironmentSnapshot,
} from '../../../packages/ui/src/PublicChrome/publicEnvironment';
import { PublicEnvironmentHarness } from './PublicEnvironmentHarness';

const date = new Date('2026-09-22T10:00:00Z');
const clear = publicEnvironmentWeatherPresets.clear;
const snapshotAt = (minutes: number) =>
    resolvePublicEnvironmentSnapshot({
        date: resolvePublicEnvironmentDateAtMinutes(date, minutes),
        weather: clear,
    });
const dawn = Array.from({ length: 720 }, (_, minute) => minute).find(
    (minute) => !snapshotAt(minute).dark,
);
const dusk = Array.from({ length: 720 }, (_, minute) => minute + 720).find(
    (minute) => snapshotAt(minute).dark,
);
if (dawn === undefined || dusk === undefined) {
    throw new Error('The fixture date must have both light/dark transitions');
}
const times = [dawn - 1, dawn, 390, 780, dusk - 1, dusk, 1380];

function luminance(rgb: number[]) {
    const linear = rgb.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

async function prepare(page: Page) {
    await page.clock.setFixedTime(date);
    await page.route('**/api/public-environment/debug', (route) =>
        route.fulfill({ json: { enabled: true } }),
    );
    await page.route('**/api/data/weather/now', (route) =>
        route.fulfill({ json: clear }),
    );
    await page.route('**/api/auth/current-claims', (route) =>
        route.fulfill({ status: 401, json: {} }),
    );
}

async function enableDebug(page: Page) {
    await page.getByText('Debug prikaza', { exact: true }).click();
    await page.getByLabel('Fiksiraj vrijeme').check();
    // Probe the exact minute on either side of the theme boundary; the
    // production debug slider normally advances in fifteen-minute steps.
    await page.getByLabel('Vrijeme dana').evaluate((element) => {
        element.setAttribute('step', '1');
    });
}

async function textColors(page: Page) {
    return page
        .locator(
            'main h1, main h2, main p, main li, main strong, main a, main span.text-secondary-foreground',
        )
        .evaluateAll((elements) =>
            Array.from(
                new Set(
                    elements.map((element) => getComputedStyle(element).color),
                ),
            ),
        );
}

async function minimumContrast(page: Page) {
    const colors = await textColors(page);
    // Sample the rendered sky, including translucent weather, celestial bodies
    // and both veil gradients. Axe cannot resolve this layered background.
    const screenshot = await page.screenshot({
        style: 'main { visibility: hidden !important; }',
        animations: 'disabled',
    });
    const { data, info } = await sharp(screenshot)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const backgrounds: number[] = [];
    for (let y = 0; y < info.height; y += 8) {
        for (let x = 0; x < info.width; x += 8) {
            const offset = (y * info.width + x) * info.channels;
            backgrounds.push(
                luminance([data[offset], data[offset + 1], data[offset + 2]]),
            );
        }
    }
    return Math.min(
        ...colors.map((color) => {
            const rgb = color
                .match(/[\d.]+/g)
                ?.slice(0, 3)
                .map(Number);
            if (rgb?.length !== 3)
                throw new Error(`Unexpected color: ${color}`);
            const foreground = luminance(rgb);
            return Math.min(
                ...backgrounds.map(
                    (background) =>
                        (Math.max(foreground, background) + 0.05) /
                        (Math.min(foreground, background) + 0.05),
                ),
            );
        }),
    );
}

for (const width of [360, 768, 1280]) {
    test(`ambient public copy keeps AA contrast across sky and weather at ${width}px`, async ({
        mount,
        page,
    }, testInfo) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await prepare(page);
        await mount(<PublicEnvironmentHarness />);
        await enableDebug(page);
        const ratios: { minutes: number; weather: string; contrast: number }[] =
            [];

        for (const minutes of times) {
            await page.getByLabel('Vrijeme dana').fill(String(minutes));
            for (const weather of Object.keys(
                publicEnvironmentWeatherPresets,
            )) {
                await page.getByLabel('Vremenski uvjeti').selectOption(weather);
                await page.evaluate(() => window.scrollTo(0, 0));
                const contrast = await minimumContrast(page);
                ratios.push({ minutes, weather, contrast });
                expect(
                    contrast,
                    `${width}px, ${minutes} minutes, ${weather}`,
                ).toBeGreaterThanOrEqual(4.5);
            }
            if (minutes === 390 || minutes === dusk) {
                await page.getByLabel('Vremenski uvjeti').selectOption('clear');
                await page.evaluate(() => window.scrollTo(0, 0));
                await page.screenshot({
                    path: testInfo.outputPath(
                        `${minutes === 390 ? 'sunrise' : 'sunset'}.png`,
                    ),
                });
            }
        }

        await page.getByLabel('Vrijeme dana').fill('390');
        await page
            .getByText('Smjernice za uzgoj i berbu.')
            .scrollIntoViewIfNeeded();
        expect(await minimumContrast(page)).toBeGreaterThanOrEqual(4.5);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true);
        await testInfo.attach('contrast-ratios', {
            body: JSON.stringify(ratios, null, 2),
            contentType: 'application/json',
        });
    });
}

test('theme and reading colors switch together with motion enabled', async ({
    mount,
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await prepare(page);
    await mount(<PublicEnvironmentHarness />);
    await enableDebug(page);
    for (const minutes of [dawn - 1, dawn, dusk - 1, dusk]) {
        await page.getByLabel('Vrijeme dana').fill(String(minutes));
        const frames = await page.evaluate(async () => {
            const description = document.querySelector(
                '.public-page-description',
            );
            const veil = document.querySelector(
                '.public-environment-contrast-veil',
            );
            if (!description || !veil)
                throw new Error('Missing public reading surface');
            const samples = [];
            for (let frame = 0; frame < 12; frame++) {
                samples.push({
                    dark: document.documentElement.classList.contains('dark'),
                    color: getComputedStyle(description).color,
                    veil: getComputedStyle(veil).backgroundImage,
                });
                await new Promise(requestAnimationFrame);
            }
            return samples;
        });
        expect(
            frames.every((frame) => frame.dark === snapshotAt(minutes).dark),
        ).toBe(true);
        expect(new Set(frames.map((frame) => frame.color)).size).toBe(1);
        expect(new Set(frames.map((frame) => frame.veil)).size).toBe(1);
        expect(await minimumContrast(page)).toBeGreaterThanOrEqual(4.5);
    }
});
