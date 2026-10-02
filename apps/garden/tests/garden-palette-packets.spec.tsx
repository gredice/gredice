import { expect, test } from '@playwright/experimental-ct-react';
import sharp from 'sharp';
import { GardenPalettePacketFixture } from '../../../packages/game/tests/GardenPalettePacketFixture';

async function pixels(png: Buffer) {
    return sharp(png).ensureAlpha().raw().toBuffer();
}

function compare(left: Buffer, right: Buffer) {
    expect(right.length).toBe(left.length);
    let different = 0;
    let maxChannelError = 0;
    for (let index = 0; index < left.length; index += 4) {
        let error = 0;
        for (let channel = 0; channel < 3; channel++)
            error = Math.max(
                error,
                Math.abs(left[index + channel] - right[index + channel]),
            );
        if (error > 2) different++;
        maxChannelError = Math.max(maxChannelError, error);
    }
    return {
        differentPixelRatio: different / (left.length / 4),
        maxChannelError,
    };
}

for (const weather of ['clear', 'rain', 'snow', 'combined'] as const) {
    for (const night of [false, true]) {
        test(`palette packets preserve ${weather} ${night ? 'night' : 'day'} colors, shadows, maps and depth`, async ({
            mount,
            page,
        }, testInfo) => {
            test.setTimeout(60_000);
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            page.on('console', (message) => {
                if (message.type() === 'error') errors.push(message.text());
            });
            const fixture = await mount(
                <GardenPalettePacketFixture weather={weather} night={night} />,
            );
            await expect(fixture).toHaveAttribute(
                'data-ready',
                `false:false:true:${night}:${weather}`,
            );
            const originalPng = await fixture.locator('canvas').screenshot();
            const original = await pixels(originalPng);
            expect(new Set(original).size).toBeGreaterThan(100);
            await fixture.update(
                <GardenPalettePacketFixture
                    weather={weather}
                    night={night}
                    palette
                />,
            );
            await expect(fixture).toHaveAttribute(
                'data-ready',
                `true:false:true:${night}:${weather}`,
            );
            const palettePng = await fixture.locator('canvas').screenshot();
            const palette = await pixels(palettePng);
            const readback = JSON.parse(
                (await fixture.getAttribute('data-result')) ?? '{}',
            );
            expect(readback.meshes).toBe(6);
            expect(readback.paletteVertices).toBeGreaterThan(100);
            const result = compare(original, palette);
            expect(result.differentPixelRatio).toBeLessThan(0.001);
            expect(result.maxChannelError).toBeLessThanOrEqual(8);
            await testInfo.attach('original', {
                body: originalPng,
                contentType: 'image/png',
            });
            await testInfo.attach('palette', {
                body: palettePng,
                contentType: 'image/png',
            });
            await testInfo.attach('comparison', {
                body: JSON.stringify({ result, readback }),
                contentType: 'application/json',
            });
            expect(errors).toEqual([]);
        });
    }
}

test('palette mutation and StrictMode cleanup preserve frames and release owned shaders', async ({
    mount,
    page,
}) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await mount(<GardenPalettePacketFixture palette />);
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'true:false:true:false:clear',
    );
    const initial = await pixels(await fixture.locator('canvas').screenshot());
    await fixture.update(<GardenPalettePacketFixture palette mutated />);
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'true:true:true:false:clear',
    );
    const changed = await pixels(await fixture.locator('canvas').screenshot());
    expect(compare(initial, changed).differentPixelRatio).toBeGreaterThan(0.01);
    await fixture.update(<GardenPalettePacketFixture mutated />);
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'false:true:true:false:clear',
    );
    const source = await pixels(await fixture.locator('canvas').screenshot());
    expect(compare(source, changed).differentPixelRatio).toBeLessThan(0.001);
    await fixture.update(
        <GardenPalettePacketFixture palette mounted={false} />,
    );
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'true:false:false:false:clear',
    );
    const released = JSON.parse(
        (await fixture.getAttribute('data-result')) ?? '{}',
    );
    expect(released.meshes).toBe(0);
    expect(released.paletteMaterials).toBe(0);
    expect(released.sharedMaterialUsers).toBe(0);
    await fixture.update(<GardenPalettePacketFixture palette mutated />);
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'true:true:true:false:clear',
    );
    expect(
        compare(
            source,
            await pixels(await fixture.locator('canvas').screenshot()),
        ).differentPixelRatio,
    ).toBeLessThan(0.001);
    expect(errors).toEqual([]);
});
