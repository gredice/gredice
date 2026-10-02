import { expect, test } from '@playwright/experimental-ct-react';
import sharp from 'sharp';
import { GardenPaletteAdmissionFixture } from '../../../packages/game/tests/GardenPaletteAdmissionFixture';
import { GardenPaletteInteractionFixture } from '../../../packages/game/tests/GardenPaletteInteractionFixture';
import { GardenPalettePacketFixture } from '../../../packages/game/tests/GardenPalettePacketFixture';

async function pixels(png: Buffer) {
    return sharp(png).ensureAlpha().raw().toBuffer();
}

test('production entity props batch JSX material nodes, retain untouched chunks and preserve source frames', async ({
    mount,
    page,
}, testInfo) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    // Keep real worker computation, but ensure its result cannot beat the
    // pending-frame ownership witness on fast hosts. This affects only CT.
    await page.route('**/meshCompiler.worker-*.js', async (route) => {
        const response = await route.fetch();
        await route.fulfill({
            response,
            body:
                'const originalWorkerPostMessage = self.postMessage.bind(self);\n' +
                'self.postMessage = (...args) => setTimeout(() => originalWorkerPostMessage(...args), 100);\n' +
                (await response.text()),
        });
    });
    const fixture = await mount(<GardenPaletteAdmissionFixture batch />);
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'true:false:false:true',
    );
    const strictInitial = JSON.parse(
        (await fixture.getAttribute('data-result')) ?? '{}',
    );
    expect(strictInitial.materials.sharedMaterialUsers).toBe(3);
    expect(strictInitial.packets.savedSubmissions).toBe(4);
    expect(strictInitial.fallbackFrames).toBeGreaterThan(0);
    expect(strictInitial.paletteFallbacks).toBe(0);
    expect(strictInitial.borrowedFallbacks).toBe(0);
    expect(strictInitial.liveFallbackMaterials).toBe(0);
    expect(strictInitial.disposedFallbackMaterials).toBeGreaterThan(0);
    expect(strictInitial.borrowedFallbackGeometries).toBe(0);
    expect(strictInitial.liveFallbackGeometries).toBe(0);
    expect(strictInitial.disposedFallbackGeometries).toBeGreaterThan(0);
    await fixture.update(<GardenPaletteAdmissionFixture />);
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'false:false:false:true',
    );
    const read = async () =>
        JSON.parse((await fixture.getAttribute('data-result')) ?? '{}');
    const baseline = await read();
    const originalPng = await fixture.locator('canvas').screenshot();
    await fixture.update(<GardenPaletteAdmissionFixture batch />);
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'true:false:false:true',
    );
    const initial = await read();
    const batchedPng = await fixture.locator('canvas').screenshot();
    expect(initial.packets.contributions).toBe(6);
    expect(initial.packets.packets).toBe(2);
    expect(initial.packets.savedSubmissions).toBe(4);
    expect(initial.meshes).toBe(4);
    expect(baseline.meshes).toBe(8);
    expect(initial.triangles).toBe(baseline.triangles);
    expect(initial.hit).toEqual(baseline.hit);
    expect(initial.unknownMeshes).toBe(2);
    expect(
        compare(await pixels(originalPng), await pixels(batchedPng))
            .differentPixelRatio,
    ).toBeLessThan(0.001);
    await fixture.update(<GardenPaletteAdmissionFixture batch patched />);
    await expect(fixture).toHaveAttribute('data-ready', 'true:false:true:true');
    const patched = await read();
    expect(patched.geometryIds['0:0']).toBe(initial.geometryIds['0:0']);
    expect(patched.geometryIds['-1:0']).not.toBe(initial.geometryIds['-1:0']);
    expect(patched.triangles).toBe(initial.triangles - 12);
    await fixture.update(<GardenPaletteAdmissionFixture batch mutated />);
    await expect(fixture).toHaveAttribute('data-ready', 'true:true:false:true');
    const changedPng = await fixture.locator('canvas').screenshot();
    expect(
        compare(await pixels(changedPng), await pixels(batchedPng))
            .differentPixelRatio,
    ).toBeGreaterThan(0.001);
    await fixture.update(<GardenPaletteAdmissionFixture mutated />);
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'false:true:false:true',
    );
    expect(
        compare(
            await pixels(changedPng),
            await pixels(await fixture.locator('canvas').screenshot()),
        ).differentPixelRatio,
    ).toBeLessThan(0.001);
    await fixture.update(
        <GardenPaletteAdmissionFixture batch mounted={false} />,
    );
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'true:false:false:false',
    );
    const released = await read();
    expect(released.materials.canonicalMaterials).toBe(0);
    expect(released.materials.sharedMaterialUsers).toBe(0);
    expect(released.compiler.liveGeometries).toBe(0);
    expect(released.liveFallbackMaterials).toBe(0);
    expect(released.liveFallbackGeometries).toBe(0);
    await fixture.update(<GardenPaletteAdmissionFixture batch />);
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'true:false:false:true',
    );
    expect((await read()).triangles).toBe(initial.triangles);
    await testInfo.attach('production-source', {
        body: originalPng,
        contentType: 'image/png',
    });
    await testInfo.attach('production-packets', {
        body: batchedPng,
        contentType: 'image/png',
    });
    expect(errors).toEqual([]);
});

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

for (const { weather, night } of [
    { weather: 'combined', night: false },
    { weather: 'rain', night: true },
] as const) {
    test(`transient authored fallback clones preserve ${weather} ${night ? 'night' : 'day'} pixels and release`, async ({
        mount,
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const fixture = await mount(
            <GardenPalettePacketFixture weather={weather} night={night} />,
        );
        await expect(fixture).toHaveAttribute(
            'data-ready',
            `false:false:true:${night}:${weather}`,
        );
        const original = await pixels(
            await fixture.locator('canvas').screenshot(),
        );
        await fixture.update(
            <GardenPalettePacketFixture
                weather={weather}
                night={night}
                fallback
            />,
        );
        await expect(fixture).toHaveAttribute(
            'data-ready',
            `fallback:false:false:true:${night}:${weather}`,
        );
        expect(
            compare(
                original,
                await pixels(await fixture.locator('canvas').screenshot()),
            ).differentPixelRatio,
        ).toBeLessThan(0.001);
        await fixture.update(
            <GardenPalettePacketFixture
                weather={weather}
                night={night}
                fallback
                mounted={false}
            />,
        );
        await expect(fixture).toHaveAttribute(
            'data-ready',
            `fallback:false:false:false:${night}:${weather}`,
        );
        const released = JSON.parse(
            (await fixture.getAttribute('data-result')) ?? '{}',
        );
        expect(released.paletteMaterials).toBe(0);
        expect(released.sharedMaterialUsers).toBe(0);
        expect(errors).toEqual([]);
    });
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
            const colors = new Set<number>();
            for (let index = 0; index < original.length; index += 4)
                colors.add(
                    original[index] * 65536 +
                        original[index + 1] * 256 +
                        original[index + 2],
                );
            expect(colors.size).toBeGreaterThan(100);
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
            expect(result.differentPixelRatio).toBeLessThan(0.001);
            expect(result.maxChannelError).toBeLessThanOrEqual(8);
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

for (const rain of [false, true]) {
    test(`actual GLTF packet props preserve hover, pickup, selection, drag and drop pixels with rain=${rain}`, async ({
        mount,
        page,
    }, testInfo) => {
        test.setTimeout(120_000);
        const errors: string[] = [];
        page.on('pageerror', (error) => {
            errors.push(error.message);
            console.error(`Interaction fixture page error: ${error.message}`);
        });
        page.on('console', (message) => {
            if (message.type() === 'error') {
                errors.push(message.text());
                console.error(
                    `Interaction fixture console error: ${message.text()}`,
                );
            }
        });
        const read = () =>
            page.evaluate(() =>
                window.gardenPaletteInteractionWitness?.snapshot(),
            );
        const originals = new Map<
            string,
            {
                png: Buffer;
                readback: NonNullable<Awaited<ReturnType<typeof read>>>;
            }
        >();
        const outcomes: unknown[] = [];
        try {
            for (const batch of [false, true]) {
                if (batch) await page.clock.resume();
                const fixture = await mount(
                    <GardenPaletteInteractionFixture
                        batch={batch}
                        rain={rain}
                    />,
                );
                await page.waitForFunction(
                    () => window.gardenPaletteInteractionWitness !== undefined,
                    null,
                    { timeout: 15_000, polling: 100 },
                );
                if (!batch) await page.clock.install();
                await page.clock.pauseAt(
                    await page.evaluate(() => Date.now() + 60_000),
                );
                await expect
                    .poll(async () => {
                        await page.clock.runFor(160);
                        const value = await read();
                        return value &&
                            value.receipts > 4 &&
                            value.compiler.pendingJobs === 0 &&
                            value.pendingMeshes === 0
                            ? value.batch
                            : undefined;
                    })
                    .toBe(batch);
                // Frozen RAF steps settle rain uniforms before matched states.
                await page.clock.runFor(2000);
                const capture = async (name: string, activeDrop = false) => {
                    const readback = await read();
                    expect(readback).toBeDefined();
                    if (!readback) throw new Error('Missing scene witness');
                    expect(readback.receipts).toBeGreaterThan(4);
                    expect(readback.rendererFrame).toBeGreaterThan(4);
                    expect(readback.sourceDisposals).toBe(0);
                    expect(readback.rainSurfaceIntensity).toBe(rain ? 1 : 0);
                    if (!activeDrop) {
                        expect(readback.compiler.pendingJobs).toBe(0);
                        expect(readback.pendingMeshes).toBe(0);
                        expect(readback.paletteMeshes > 0).toBe(batch);
                        expect(readback.packets.contributions > 0).toBe(batch);
                    }
                    if (
                        ['hover', 'pickup', 'selection', 'drag'].includes(name)
                    ) {
                        expect(readback.outlineMeshes).toBeGreaterThan(0);
                        expect(readback.outlineOriginalGeometry).toBe(
                            readback.outlineMeshes,
                        );
                    }
                    if (name === 'drag')
                        expect(
                            readback.treePositions?.find(
                                (value) => value.id === 'palette-picked-tree',
                            ),
                        ).toEqual({
                            id: 'palette-picked-tree',
                            position: [-0.75, 0.85, -0.5],
                            pickupOutlineVisible: true,
                        });
                    if (activeDrop) {
                        expect(readback.dropOffsetY).toBeGreaterThan(0.001);
                        expect(readback.dropOffsetY).toBeLessThan(0.1);
                        expect(readback.animatedMeshes).toBeGreaterThan(0);
                        expect(readback.animatedOriginalGeometry).toBe(
                            readback.animatedMeshes,
                        );
                    }
                    if (name === 'drop-settled') {
                        expect(readback.dropOffsetY).toBeNull();
                        expect(readback.animatedMeshes).toBe(0);
                        expect(readback.dropAnimation).toBeUndefined();
                    }
                    const png = await fixture.locator('canvas').screenshot();
                    await testInfo.attach(
                        `${rain ? 'rain' : 'clear'}-${batch ? 'packets' : 'authored'}-${name}`,
                        { body: png, contentType: 'image/png' },
                    );
                    if (batch) {
                        const original = originals.get(name);
                        expect(original).toBeDefined();
                        if (!original)
                            throw new Error('Missing authored frame');
                        expect(readback.sourceInputs).toEqual(
                            original.readback.sourceInputs,
                        );
                        expect(readback.treePositions).toEqual(
                            original.readback.treePositions,
                        );
                        expect(readback.dropOffsetY).toEqual(
                            original.readback.dropOffsetY,
                        );
                        const result = compare(
                            await pixels(original.png),
                            await pixels(png),
                        );
                        outcomes.push({
                            name,
                            result,
                            original: original.readback,
                            packets: readback,
                        });
                        await testInfo.attach(`${name}-comparison`, {
                            body: JSON.stringify(outcomes.at(-1)),
                            contentType: 'application/json',
                        });
                        expect(result.differentPixelRatio).toBeLessThan(0.001);
                        expect(result.maxChannelError).toBeLessThanOrEqual(8);
                    } else {
                        const idle = originals.get('idle');
                        if (idle && name !== 'drop-settled')
                            expect(
                                compare(
                                    await pixels(idle.png),
                                    await pixels(png),
                                ).differentPixelRatio,
                            ).toBeGreaterThan(0);
                        originals.set(name, { png, readback });
                    }
                };
                await capture('idle');
                for (const phase of ['hover', 'pickup', 'selection', 'drag']) {
                    await fixture.getByTestId(`palette-${phase}`).click();
                    await expect
                        .poll(async () => (await read())?.phase)
                        .toBe(phase);
                    await expect
                        .poll(async () => {
                            await page.clock.runFor(160);
                            const value = await read();
                            return (
                                value?.compiler.pendingJobs === 0 &&
                                value.pendingMeshes === 0
                            );
                        })
                        .toBe(true);
                    await capture(phase);
                }
                // Rebase the previous drag before beginning the actual drop spring.
                await fixture.getByTestId('palette-idle').click();
                await page.clock.runFor(2000);
                await fixture.getByTestId('palette-drop').click();
                await expect
                    .poll(async () => (await read())?.phase)
                    .toBe('drop');
                await page.clock.runFor(32);
                await capture('drop-active', true);
                await page.clock.runFor(4000);
                await expect
                    .poll(async () => {
                        await page.clock.runFor(160);
                        const value = await read();
                        return (
                            value !== undefined &&
                            value.dropAnimation === undefined &&
                            value.compiler.pendingJobs === 0 &&
                            value.pendingMeshes === 0
                        );
                    })
                    .toBe(true);
                await capture('drop-settled');
                await fixture.unmount();
                await expect
                    .poll(() =>
                        page.evaluate(
                            () =>
                                window.gardenPaletteInteractionWitness ===
                                undefined,
                        ),
                    )
                    .toBe(true);
            }
        } finally {
            await testInfo.attach('interaction-outcomes', {
                body: JSON.stringify({ rain, outcomes, errors }),
                contentType: 'application/json',
            });
        }
        expect(outcomes).toHaveLength(7);
        expect(errors).toEqual([]);
    });
}
