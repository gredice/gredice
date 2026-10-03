import { expect, test } from '@playwright/experimental-ct-react';
import sharp from 'sharp';
import { GardenPaletteAdmissionFixture } from '../../../packages/game/tests/GardenPaletteAdmissionFixture';
import { GardenPaletteCullingFixture } from '../../../packages/game/tests/GardenPaletteCullingFixture';
import { GardenPaletteInteractionFixture } from '../../../packages/game/tests/GardenPaletteInteractionFixture';
import { GardenPalettePacketFixture } from '../../../packages/game/tests/GardenPalettePacketFixture';

async function pixels(png: Buffer) {
    return sharp(png).ensureAlpha().raw().toBuffer();
}

function submittedCanvasPng(value: unknown) {
    const prefix = 'data:image/png;base64,';
    if (typeof value !== 'string' || !value.startsWith(prefix))
        throw new Error('Submitted visual witness must contain PNG pixels');
    return Buffer.from(value.slice(prefix.length), 'base64');
}

function nativeRainInputs(
    meshes: { matrixWorld: number[]; materials: Record<string, unknown>[] }[],
) {
    return meshes.map((mesh) => ({
        matrixWorld: mesh.matrixWorld,
        uniforms: mesh.materials.map((uniforms) =>
            Object.fromEntries(
                Object.entries(uniforms).map(([key, value]) => [
                    key,
                    typeof value === 'number'
                        ? Math.fround(value)
                        : Array.isArray(value)
                          ? value.map((element: unknown) =>
                                typeof element === 'number'
                                    ? Math.fround(element)
                                    : element,
                            )
                          : value,
                ]),
            ),
        ),
    }));
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

test('production palette packets preserve original main and shadow culling with shared native ranges', async ({
    mount,
    page,
}, testInfo) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await mount(<GardenPaletteCullingFixture />);
    const snapshots: Record<string, unknown> = {};
    for (const view of ['mixed', 'all', 'none', 'opposite'] as const) {
        await fixture.update(<GardenPaletteCullingFixture view={view} />);
        await expect(fixture).toHaveAttribute('data-ready', `false:${view}`);
        const source = JSON.parse(
            (await fixture.getAttribute('data-result')) ?? '{}',
        );
        const sourcePng = await fixture.locator('canvas').screenshot();
        await fixture.update(<GardenPaletteCullingFixture batch view={view} />);
        await expect(fixture).toHaveAttribute('data-ready', `true:${view}`);
        const candidate = JSON.parse(
            (await fixture.getAttribute('data-result')) ?? '{}',
        );
        const packetPng = await fixture.locator('canvas').screenshot();
        const result = compare(
            await pixels(sourcePng),
            await pixels(packetPng),
        );
        for (const pass of ['main', 'shadow']) {
            const sourceRows = source.receipts.filter(
                (r: { pass: string }) => r.pass === pass,
            );
            const packetRows = candidate.receipts.filter(
                (r: { pass: string }) => r.pass === pass,
            );
            const expectedTriangles =
                view === 'all' ? 36 : view === 'none' ? 0 : 12;
            expect(
                sourceRows.reduce(
                    (total: number, r: { triangles: number }) =>
                        total + r.triangles,
                    0,
                ),
            ).toBe(expectedTriangles);
            expect(
                packetRows.reduce(
                    (total: number, r: { triangles: number }) =>
                        total + r.triangles,
                    0,
                ),
            ).toBe(expectedTriangles);
            expect(
                packetRows.every(
                    (r: { calls: number; count: number }) =>
                        r.calls === 1 && r.count > 0,
                ),
            ).toBe(true);
            expect(packetRows.length).toBe(view === 'none' ? 0 : 1);
        }
        expect(candidate.packets.contributions).toBe(3);
        expect(candidate.packets.packets).toBe(1);
        expect(candidate.geometryIds).toHaveLength(1);
        expect(candidate.materialIds).toHaveLength(1);
        expect(candidate.rangesRestored).toBe(true);
        expect(candidate.sourceDisposals).toBe(0);
        expect(candidate.sceneRaycastHits).toHaveLength(
            source.sceneRaycastHits.length,
        );
        for (let ray = 0; ray < source.sceneRaycastHits.length; ray++) {
            const authored = source.sceneRaycastHits[ray],
                ranged = candidate.sceneRaycastHits[ray];
            expect(authored).toHaveLength(1);
            expect(ranged).toHaveLength(authored.length);
            const sourceHit = authored[0],
                candidateHit = ranged[0];
            if (!sourceHit?.uv || !candidateHit?.uv)
                throw new Error(
                    'Whole-scene raycast witness requires source and packet UV hits',
                );
            expect(candidateHit.distance).toBeCloseTo(sourceHit.distance, 6);
            for (let axis = 0; axis < 3; axis++)
                expect(candidateHit.point[axis]).toBeCloseTo(
                    sourceHit.point[axis],
                    6,
                );
            for (let axis = 0; axis < 2; axis++)
                expect(candidateHit.uv[axis]).toBeCloseTo(
                    sourceHit.uv[axis],
                    6,
                );
        }
        expect(result.differentPixelRatio).toBeLessThan(0.001);
        expect(result.maxChannelError).toBeLessThanOrEqual(8);
        await testInfo.attach(`${view}-source`, {
            body: sourcePng,
            contentType: 'image/png',
        });
        await testInfo.attach(`${view}-packet`, {
            body: packetPng,
            contentType: 'image/png',
        });
        snapshots[view] = { source, candidate, result };
    }
    // Camera-only changes retain the committed packet and its existing buffers.
    await fixture.update(<GardenPaletteCullingFixture batch view="mixed" />);
    await expect(fixture).toHaveAttribute('data-ready', 'true:mixed');
    const before = JSON.parse(
        (await fixture.getAttribute('data-result')) ?? '{}',
    );
    await fixture.update(<GardenPaletteCullingFixture batch view="opposite" />);
    await expect(fixture).toHaveAttribute('data-ready', 'true:opposite');
    const after = JSON.parse(
        (await fixture.getAttribute('data-result')) ?? '{}',
    );
    expect(after.geometryIds).toEqual(before.geometryIds);
    expect(after.materialIds).toEqual(before.materialIds);
    expect(after.compiler.syncCompiles).toBe(before.compiler.syncCompiles);
    expect(after.compiler.workerCompiles).toBe(before.compiler.workerCompiles);
    await testInfo.attach('actual-main-shadow-submissions', {
        body: JSON.stringify({ snapshots, cameraOnly: { before, after } }),
        contentType: 'application/json',
    });
    expect(errors).toEqual([]);
});

test('pending, ready, invalidated and context-restored palette presentation preserves whole-scene picking and native shadows', async ({
    mount,
    page,
}, testInfo) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await mount(<GardenPaletteCullingFixture warmupWitness />);
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'false:mixed:warmup:0:false',
    );
    const source = JSON.parse(
        (await fixture.getAttribute('data-result')) ?? '{}',
    );
    const results: unknown[] = [];
    const frameCaptures: {
        revision: number;
        restored: boolean;
        phase: string;
        frame: number;
        png: Buffer;
    }[] = [];
    for (const [revision, restored] of [
        [0, false],
        [1, false],
        [1, true],
    ] as const) {
        await fixture.update(
            <GardenPaletteCullingFixture
                batch
                warmupWitness
                shaderRevision={revision}
                restoreContext={restored}
            />,
        );
        await expect(fixture).toHaveAttribute(
            'data-ready',
            `true:mixed:warmup:${revision}:${restored}`,
        );
        const candidate = JSON.parse(
            (await fixture.getAttribute('data-result')) ?? '{}',
        );
        const frames = candidate.warmupFrames.filter(
            (sample: { revision: number; restored: boolean }) =>
                sample.revision === revision && sample.restored === restored,
        );
        const handoff = frames.filter(
            (sample: { phase: string }) => sample.phase !== 'first-affected',
        );
        expect(
            handoff.map((sample: { phase: string }) => sample.phase),
        ).toEqual(['pending', 'ready']);
        expect(
            frames.filter(
                (sample: { phase: string }) =>
                    sample.phase === 'first-affected',
            ),
        ).toHaveLength(revision > 0 || restored ? 1 : 0);
        expect(candidate.missingPresentationFrames).toBe(0);
        expect(handoff[0].hiddenPaletteMeshes).toBe(4);
        expect(handoff[0].visiblePaletteMeshes).toBe(0);
        expect(handoff[0].fallbackMeshes).toBe(3);
        expect(handoff[1].visiblePaletteMeshes).toBe(4);
        expect(handoff[1].fallbackMeshes).toBe(0);
        expect(handoff[1].frame).toBeGreaterThan(handoff[0].frame);
        for (const frame of frames) {
            const png = submittedCanvasPng(frame.png);
            frameCaptures.push({
                revision,
                restored,
                phase: frame.phase,
                frame: frame.frame,
                png,
            });
            await testInfo.attach(
                `warmup-${revision}-${restored}-${frame.phase}-frame-${frame.frame}`,
                { body: png, contentType: 'image/png' },
            );
            expect(frame.rangesRestored).toBe(true);
            expect(frame.farRejectedHits).toBe(0);
            expect(frame.nearRejectedHits).toBe(0);
            expect(
                frame.sceneRaycastHits.map((hits: unknown[]) => hits.length),
            ).toEqual([1, 1]);
            for (let ray = 0; ray < source.sceneRaycastHits.length; ray++) {
                const expectedHit = source.sceneRaycastHits[ray][0],
                    actualHit = frame.sceneRaycastHits[ray][0];
                expect(actualHit.distance).toBeCloseTo(expectedHit.distance, 6);
                for (let axis = 0; axis < 3; axis++)
                    expect(actualHit.point[axis]).toBeCloseTo(
                        expectedHit.point[axis],
                        6,
                    );
                if (!actualHit.uv || !expectedHit.uv)
                    throw new Error('Actual handoff must preserve UV hits');
                for (let axis = 0; axis < 2; axis++)
                    expect(actualHit.uv[axis]).toBeCloseTo(
                        expectedHit.uv[axis],
                        6,
                    );
            }
            for (const pass of ['main', 'shadow']) {
                const receipts = frame.receipts.filter(
                    (receipt: { pass: string }) => receipt.pass === pass,
                );
                expect(
                    receipts.reduce(
                        (sum: number, receipt: { triangles: number }) =>
                            sum + receipt.triangles,
                        0,
                    ),
                ).toBe(12);
                expect(
                    receipts.every(
                        (receipt: { name: string }) =>
                            frame.phase !== 'pending' ||
                            receipt.name.includes(':fallback:'),
                    ),
                ).toBe(true);
                expect(
                    receipts.every(
                        (receipt: {
                            nativeProgramAfter: number | null;
                            nativeReadyAfter: boolean | null;
                        }) =>
                            receipt.nativeProgramAfter !== null &&
                            receipt.nativeReadyAfter === true,
                    ),
                ).toBe(true);
            }
        }
        const candidatePng = await fixture.locator('canvas').screenshot();
        await testInfo.attach(`warmup-${revision}-${restored}`, {
            body: candidatePng,
            contentType: 'image/png',
        });
        results.push({ revision, restored, candidate });
    }
    // Preserve uninterrupted ready→invalidated candidate transitions first.
    // Then capture the authored control at each identical light/context state.
    const controls: unknown[] = [],
        framePixels: unknown[] = [];
    for (const [revision, restored] of [
        [0, false],
        [1, false],
        [1, true],
    ] as const) {
        await fixture.update(
            <GardenPaletteCullingFixture
                warmupWitness
                shaderRevision={revision}
                restoreContext={restored}
            />,
        );
        await expect(fixture).toHaveAttribute(
            'data-ready',
            `false:mixed:warmup:${revision}:${restored}`,
        );
        const control = JSON.parse(
            (await fixture.getAttribute('data-result')) ?? '{}',
        );
        const controlPng = submittedCanvasPng(control.png);
        const controlPixels = await pixels(controlPng);
        await testInfo.attach(
            `warmup-source-${revision}-${restored}-frame-${control.frame}`,
            { body: controlPng, contentType: 'image/png' },
        );
        for (const capture of frameCaptures.filter(
            (sample) =>
                sample.revision === revision && sample.restored === restored,
        )) {
            const result = compare(controlPixels, await pixels(capture.png));
            expect(result.differentPixelRatio).toBeLessThan(0.001);
            expect(result.maxChannelError).toBeLessThanOrEqual(8);
            framePixels.push({
                revision,
                restored,
                phase: capture.phase,
                frame: capture.frame,
                controlFrame: control.frame,
                result,
            });
        }
        controls.push({ revision, restored, control });
    }
    await testInfo.attach(
        'actual-pending-ready-invalidation-context-receipts',
        {
            body: JSON.stringify({ source, results, controls, framePixels }),
            contentType: 'application/json',
        },
    );
    expect(errors).toEqual([]);
});

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
        const initializations: unknown[] = [];
        const stateCaptures: unknown[] = [];
        try {
            // Install before any root can queue a native RAF, then keep its
            // managed timers live throughout real async shader readiness.
            await page.clock.install();
            for (const batch of [false, true]) {
                await page.clock.resume();
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
                // Keep Three's real 10ms async readiness polling and the
                // production timeout live until presentation has committed.
                // A 60s virtual jump during compilation would expire its job.
                await expect
                    .poll(
                        async () => {
                            const value = await read();
                            initializations.push({
                                batch,
                                stage: 'real-bootstrap',
                                value,
                            });
                            return value &&
                                value.receipts > 4 &&
                                value.compiler.pendingJobs === 0 &&
                                value.pendingMeshes === 0
                                ? value.batch
                                : undefined;
                        },
                        { timeout: 15_000 },
                    )
                    .toBe(batch);
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
                // A clock wait alone is not proof of owned weather frames.
                // With wetSpeed5, 3.5s actual positive update delta converges
                // 0→1 beyond half a Float32 ULP; still require the actual value.
                if (rain) {
                    let settled = false;
                    for (let step = 0; step < 100; step++) {
                        await page.clock.runFor(160);
                        const value = await read();
                        const overlays = value?.weatherUniforms.filter((mesh) =>
                            mesh.materials.some(
                                (uniforms) => 'uWetness' in uniforms,
                            ),
                        );
                        stateCaptures.push({
                            batch,
                            name: 'rain-convergence',
                            virtualWaitMs: (step + 1) * 160,
                            readback: value,
                        });
                        if (
                            value &&
                            value.weatherEvolution.deltaSeconds >= 3.5 &&
                            value.weatherEvolution.frames > 0 &&
                            value.rainOverlayDrawCount === 2 &&
                            overlays?.length === 2 &&
                            overlays.every((mesh) =>
                                mesh.materials.every(
                                    (uniforms) =>
                                        typeof uniforms.uWetness === 'number' &&
                                        Math.fround(uniforms.uWetness) === 1,
                                ),
                            )
                        ) {
                            settled = true;
                            break;
                        }
                    }
                    expect(settled).toBe(true);
                } else await page.clock.runFor(160);
                const capture = async (name: string, activeDrop = false) => {
                    const submission = await page.evaluate(
                        (active) =>
                            active
                                ? window.gardenPaletteInteractionWitness?.activeDrop()
                                : window.gardenPaletteInteractionWitness?.capture(),
                        activeDrop,
                    );
                    const readback = submission?.readback;
                    const deltaSequence =
                        submission && 'deltaSequence' in submission
                            ? submission.deltaSequence
                            : undefined;
                    stateCaptures.push({
                        batch,
                        name,
                        activeDrop,
                        deltaSequence,
                        readback,
                    });
                    expect(readback).toBeDefined();
                    if (!readback) throw new Error('Missing scene witness');
                    expect(readback.receipts).toBeGreaterThan(4);
                    expect(readback.rendererFrame).toBeGreaterThan(4);
                    expect(readback.sourceDisposals).toBe(0);
                    expect(readback.rainSurfaceIntensity).toBe(rain ? 1 : 0);
                    const rainOverlays = readback.weatherUniforms.filter(
                        (mesh) =>
                            mesh.materials.some(
                                (uniforms) => 'uWetness' in uniforms,
                            ),
                    );
                    expect(rainOverlays).toHaveLength(rain ? 2 : 0);
                    expect(readback.rainOverlayDrawCount).toBe(rain ? 2 : 0);
                    for (const mesh of rainOverlays) {
                        for (const uniforms of mesh.materials) {
                            if (typeof uniforms.uWetness === 'number')
                                expect(Math.fround(uniforms.uWetness)).toBe(
                                    rain ? 1 : 0,
                                );
                        }
                    }
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
                        expect(deltaSequence).toEqual([16]);
                        expect(readback.springStarted).toBe(true);
                        expect(readback.dropSpringAdvances).toHaveLength(1);
                        expect(readback.dropSpringAdvances[0]).toMatchObject({
                            deltaMs: 16,
                            before: 0.1,
                            after: readback.dropOffsetY,
                        });
                        expect(readback.renderedTiming.delta).toBeCloseTo(
                            0.016,
                            12,
                        );
                        expect(readback.dropNativeDraws.length).toBeGreaterThan(
                            0,
                        );
                        for (const draw of readback.dropNativeDraws) {
                            expect(draw.calls).toBeGreaterThan(0);
                            expect(draw.triangles).toBeGreaterThan(0);
                            expect(draw.originalGeometry).toBe(true);
                        }
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
                    const png = submittedCanvasPng(submission?.png);
                    await testInfo.attach(
                        `${rain ? 'rain' : 'clear'}-${batch ? 'packets' : 'authored'}-${name}`,
                        { body: png, contentType: 'image/png' },
                    );
                    if (batch) {
                        const original = originals.get(name);
                        expect(original).toBeDefined();
                        if (!original)
                            throw new Error('Missing authored frame');
                        expect(readback.sceneTimeSeconds).toBe(
                            original.readback.sceneTimeSeconds,
                        );
                        expect(readback.camera).toEqual(
                            original.readback.camera,
                        );
                        expect(readback.lights).toEqual(
                            original.readback.lights,
                        );
                        const originalRainOverlays =
                            original.readback.weatherUniforms.filter((mesh) =>
                                mesh.materials.some(
                                    (uniforms) => 'uWetness' in uniforms,
                                ),
                            );
                        expect(nativeRainInputs(rainOverlays)).toEqual(
                            nativeRainInputs(originalRainOverlays),
                        );
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
                await expect
                    .poll(async () => {
                        const value = await read();
                        stateCaptures.push({
                            batch,
                            name: 'drop-initial',
                            readback: value,
                        });
                        return (
                            value?.dropAnimation?.visualStarted === true &&
                            value.springStarted &&
                            value.dropOffsetY === 0.1 &&
                            value.animatedMeshes > 0 &&
                            value.animatedOriginalGeometry ===
                                value.animatedMeshes
                        );
                    })
                    .toBe(true);
                // Observe the first positive authored drop submission. Equal
                // wall-clock waits can contain different owned root frames.
                const dropWaitStarted = Date.now();
                let dropVirtualWaitMs = 0;
                for (; dropVirtualWaitMs < 256; dropVirtualWaitMs++) {
                    await page.clock.runFor(1);
                    const submitted = await page.evaluate(() =>
                        window.gardenPaletteInteractionWitness?.activeDrop(),
                    );
                    if (submitted) {
                        dropVirtualWaitMs++;
                        break;
                    }
                }
                stateCaptures.push({
                    batch,
                    name: 'drop-first-submission-wait',
                    virtualWaitMs: dropVirtualWaitMs,
                    wallWaitMs: Date.now() - dropWaitStarted,
                });
                expect(
                    await page.evaluate(() =>
                        window.gardenPaletteInteractionWitness?.activeDrop(),
                    ),
                ).toBeDefined();
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
                body: JSON.stringify({
                    rain,
                    initializations,
                    stateCaptures,
                    outcomes,
                    errors,
                }),
                contentType: 'application/json',
            });
        }
        expect(outcomes).toHaveLength(7);
        expect(errors).toEqual([]);
    });
}
