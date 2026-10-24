import { expect, test } from '@playwright/experimental-ct-react';
import sharp from 'sharp';
import { GardenPacketLifetimeFixture } from '../../../packages/game/tests/GardenPacketLifetimeFixture';
import { GardenPaletteAdmissionFixture } from '../../../packages/game/tests/GardenPaletteAdmissionFixture';
import { GardenPaletteCullingFixture } from '../../../packages/game/tests/GardenPaletteCullingFixture';
import { GardenPaletteInteractionFixture } from '../../../packages/game/tests/GardenPaletteInteractionFixture';
import { GardenPalettePacketFixture } from '../../../packages/game/tests/GardenPalettePacketFixture';
import { readGardenPacketNativeProgramWitness } from '../../../packages/game/tests/gardenPacketNativeProgramWitness';
import {
    type GardenPaletteFrameInputSnapshot,
    installGardenPaletteFrameInput,
} from '../../../packages/game/tests/gardenPaletteFrameInput';

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

test('stock aggregate draws retain authored native instancing programs and release owned buffers', async ({
    mount,
    page,
}, testInfo) => {
    test.setTimeout(90_000);
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
    const fixture = await mount(
        <GardenPaletteAdmissionFixture aggregate nativeProgramWitness />,
    );
    const read = async (key: string) => {
        await expect(fixture).toHaveAttribute('data-ready', key);
        const result: unknown = JSON.parse(
            (await fixture.getAttribute('data-result')) ?? '{}',
        );
        if (typeof result !== 'object' || result === null)
            throw new Error('Native program fixture readback is required.');
        return readGardenPacketNativeProgramWitness(
            Reflect.get(result, 'nativePrograms'),
        );
    };
    const authored = await read('false:false:false:true:aggregate:3');
    await fixture.update(
        <GardenPaletteAdmissionFixture batch aggregate nativeProgramWitness />,
    );
    const joined = await read('true:false:false:true:aggregate:3');
    await testInfo.attach('authored-and-stock-native-programs', {
        body: JSON.stringify({ authored, joined }, null, 2),
        contentType: 'application/json',
    });
    const originalDraws = authored.draws.filter(
        (draw) => draw.kind === 'authored' && draw.pass === 'main',
    );
    const compiledDraws = joined.draws.filter(
        (draw) => draw.kind === 'compiled' && draw.pass === 'main',
    );
    const pendingDraws = joined.draws.filter(
        (draw) => draw.kind === 'pending' && draw.pass === 'main',
    );
    expect(originalDraws.length).toBeGreaterThan(0);
    expect(compiledDraws.length).toBeGreaterThan(0);
    expect(pendingDraws.length).toBeGreaterThan(0);
    expect(
        originalDraws.every((draw) => draw.instancing && draw.shaderInstancing),
    ).toBe(true);
    expect(
        compiledDraws.every(
            (draw) =>
                draw.instancing &&
                draw.shaderInstancing &&
                draw.instanceCount === 1,
        ),
    ).toBe(true);
    expect(new Set(compiledDraws.map((draw) => draw.cacheKey))).toEqual(
        new Set(originalDraws.map((draw) => draw.cacheKey)),
    );
    expect(new Set(compiledDraws.map((draw) => draw.programId))).toEqual(
        new Set(originalDraws.map((draw) => draw.programId)),
    );
    const originalShadows = authored.draws.filter(
        (draw) => draw.kind === 'authored' && draw.pass === 'shadow',
    );
    const compiledShadows = joined.draws.filter(
        (draw) => draw.kind === 'compiled' && draw.pass === 'shadow',
    );
    expect(originalShadows.length).toBeGreaterThan(0);
    expect(compiledShadows.length).toBeGreaterThan(0);
    expect(new Set(compiledShadows.map((draw) => draw.cacheKey))).toEqual(
        new Set(originalShadows.map((draw) => draw.cacheKey)),
    );
    expect(new Set(compiledShadows.map((draw) => draw.programId))).toEqual(
        new Set(originalShadows.map((draw) => draw.programId)),
    );
    expect(joined.createdPrograms).toBe(authored.createdPrograms);
    expect(joined.programPeak).toBe(authored.programPeak);
    const released = [];
    for (let cycle = 0; cycle < 3; cycle++) {
        await fixture.update(
            <GardenPaletteAdmissionFixture
                batch
                aggregate
                nativeProgramWitness
                mounted={false}
            />,
        );
        released.push(await read('true:false:false:false:aggregate:3'));
        await fixture.update(
            <GardenPaletteAdmissionFixture
                batch
                aggregate
                nativeProgramWitness
            />,
        );
        await read('true:false:false:true:aggregate:3');
    }
    await testInfo.attach('native-program-and-buffer-release-cycles', {
        body: JSON.stringify(released, null, 2),
        contentType: 'application/json',
    });
    expect(released.map((value) => value.liveBuffers)).toEqual(
        Array(3).fill(released[0]?.liveBuffers),
    );
    expect(released.map((value) => value.livePrograms)).toEqual(
        Array(3).fill(released[0]?.livePrograms),
    );
    expect(released.at(-1)?.deletedBuffers).toBeGreaterThan(
        joined.deletedBuffers,
    );
    // Borrowed authored sources keep these exact programs alive. Owned packet
    // consumers release their references without recreating shader variants.
    expect(released.map((value) => value.createdPrograms)).toEqual(
        Array(3).fill(authored.createdPrograms),
    );
    expect(released.map((value) => value.programPeak)).toEqual(
        Array(3).fill(authored.programPeak),
    );
});

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
    const fixture = await mount(<GardenPaletteAdmissionFixture batch />);
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'true:false:false:true',
    );
    const strictInitial = JSON.parse(
        (await fixture.getAttribute('data-result')) ?? '{}',
    );
    expect(strictInitial.materials.sharedMaterialUsers).toBe(3);
    expect(strictInitial.packets.savedSubmissions).toBe(0);
    expect(strictInitial.fallbackFrames).toBe(0);
    expect(
        strictInitial.compiler.syncCompiles +
            strictInitial.compiler.workerCompiles,
    ).toBe(0);
    expect(strictInitial.borrowedSingletonGeometries).toBe(6);
    expect(strictInitial.borrowedSourceDisposals).toBe(0);
    expect(strictInitial.nativePendingDraws).toBe(0);
    expect(strictInitial.nativeStockDraws).toBeGreaterThan(0);
    expect(strictInitial.paletteFallbacks).toBe(0);
    expect(strictInitial.borrowedFallbacks).toBe(0);
    expect(strictInitial.liveFallbackMaterials).toBe(0);
    expect(strictInitial.disposedFallbackMaterials).toBe(0);
    expect(strictInitial.borrowedFallbackGeometries).toBe(0);
    expect(strictInitial.liveFallbackGeometries).toBe(0);
    expect(strictInitial.disposedFallbackGeometries).toBe(0);
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
    expect(initial.packets.packets).toBe(6);
    expect(initial.packets.savedSubmissions).toBe(0);
    expect(initial.meshes).toBe(8);
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
    const initialGeometries = Object.fromEntries(
            Object.entries(initial.geometryIds),
        ),
        patchedGeometries = Object.fromEntries(
            Object.entries(patched.geometryIds),
        );
    expect(Object.keys(initialGeometries)).toHaveLength(6);
    expect(Object.keys(patchedGeometries)).toHaveLength(5);
    for (const [key, geometry] of Object.entries(patchedGeometries))
        expect(geometry).toBe(initialGeometries[key]);
    expect(
        Object.keys(patchedGeometries).filter((key) => key.startsWith('0:0|')),
    ).toHaveLength(3);
    const removed = Object.keys(initialGeometries).filter(
        (key) => !(key in patchedGeometries),
    );
    expect(removed).toHaveLength(1);
    expect(removed[0].startsWith('-1:0|')).toBe(true);
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

test('singleton stock packets preserve borrowed geometry and compile only after compatible sources join', async ({
    mount,
    page,
}, testInfo) => {
    test.setTimeout(90_000);
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

    const fixture = await mount(
        <GardenPaletteAdmissionFixture batch aggregate sources={1} />,
    );
    const read = async (key: string) => {
        await expect(fixture).toHaveAttribute('data-ready', key);
        return JSON.parse((await fixture.getAttribute('data-result')) ?? '{}');
    };
    const singleton = await read('true:false:false:true:aggregate:1');
    expect(singleton.packets.contributions).toBe(2);
    expect(singleton.packets.savedSubmissions).toBe(0);
    expect(singleton.singletonMeshes).toBe(2);
    expect(singleton.borrowedSingletonGeometries).toBe(2);
    expect(
        singleton.compiler.syncCompiles + singleton.compiler.workerCompiles,
    ).toBe(0);
    expect(singleton.compiler.liveGeometries).toBe(0);
    expect(singleton.nativeStockDraws).toBeGreaterThan(0);
    expect(singleton.nativePendingDraws).toBe(0);
    expect(singleton.borrowedSourceDisposals).toBe(0);
    await fixture.update(<GardenPaletteAdmissionFixture aggregate />);
    const authored = await read('false:false:false:true:aggregate:3');
    const authoredPng = await fixture.locator('canvas').screenshot();
    await fixture.update(<GardenPaletteAdmissionFixture batch aggregate />);
    const joined = await read('true:false:false:true:aggregate:3');
    const joinedPng = await fixture.locator('canvas').screenshot();
    expect(joined.packets.contributions).toBe(6);
    expect(joined.packets.packets).toBe(2);
    expect(joined.packets.savedSubmissions).toBe(4);
    expect(joined.singletonMeshes).toBe(0);
    expect(
        joined.compiler.syncCompiles + joined.compiler.workerCompiles,
    ).toBeGreaterThan(0);
    expect(joined.compiler.liveGeometries).toBe(2);
    expect(joined.nativePendingDraws).toBeGreaterThan(0);
    expect(joined.nativeStockDraws).toBeGreaterThan(0);
    expect(joined.liveFallbackMaterials).toBe(0);
    expect(joined.liveFallbackGeometries).toBe(0);
    expect(joined.disposedFallbackMaterials).toBeGreaterThan(0);
    expect(joined.disposedFallbackGeometries).toBeGreaterThan(0);
    expect(joined.borrowedFallbacks).toBe(0);
    expect(joined.borrowedFallbackGeometries).toBe(0);
    expect(joined.borrowedSourceDisposals).toBe(0);
    expect(joined.triangles).toBe(authored.triangles);
    expect(joined.hit).toEqual(authored.hit);
    const diff = compare(await pixels(authoredPng), await pixels(joinedPng));
    expect(diff.differentPixelRatio).toBeLessThan(0.001);
    expect(diff.maxChannelError).toBeLessThanOrEqual(8);
    const telemetryFrames = [];
    const telemetryModes: Array<'insert' | 'replace' | 'none'> = [
        'insert',
        'replace',
        'none',
        'insert',
    ];
    for (const mode of telemetryModes) {
        await fixture.update(
            <GardenPaletteAdmissionFixture
                batch
                aggregate
                placementTelemetry={mode}
            />,
        );
        const telemetry = await read(
            `true:false:false:true:aggregate:3${mode === 'none' ? '' : `:placement:${mode}`}`,
        );
        expect(telemetry.compiler.workerCompiles).toBe(
            joined.compiler.workerCompiles,
        );
        expect(telemetry.compiler.syncCompiles).toBe(
            joined.compiler.syncCompiles,
        );
        expect(telemetry.packets.packetCompiles).toBe(
            joined.packets.packetCompiles,
        );
        expect(telemetry.placement.placementChunkPhysicalRebuildCount).toBe(
            joined.placement.placementChunkPhysicalRebuildCount,
        );
        expect(telemetry.geometryIds).toEqual(joined.geometryIds);
        expect(telemetry.triangles).toBe(joined.triangles);
        expect(telemetry.hit).toEqual(joined.hit);
        expect(telemetry.nativeStockDraws).toBeGreaterThan(
            joined.nativeStockDraws,
        );
        telemetryFrames.push(telemetry);
    }
    const reinserted = telemetryFrames.at(-1);
    if (!reinserted) throw new Error('Missing settled empty placement member');
    await fixture.update(
        <GardenPaletteAdmissionFixture
            batch
            aggregate
            placementTelemetry="drawable"
        />,
    );
    const physical = await read(
        'true:false:false:true:aggregate:3:placement:drawable',
    );
    expect(physical.compiler.workerCompiles).toBeGreaterThan(
        reinserted.compiler.workerCompiles,
    );
    expect(physical.packets.packetCompiles).toBeGreaterThan(
        reinserted.packets.packetCompiles,
    );
    expect(
        physical.placement.placementChunkPhysicalRebuildCount,
    ).toBeGreaterThan(reinserted.placement.placementChunkPhysicalRebuildCount);
    expect(
        physical.placement.placementChunkPhysicalTransformedInstanceCount,
    ).toBeGreaterThan(
        reinserted.placement.placementChunkPhysicalTransformedInstanceCount,
    );
    await fixture.update(
        <GardenPaletteAdmissionFixture batch aggregate sources={1} />,
    );
    const separated = await read('true:false:false:true:aggregate:1');
    expect(separated.singletonMeshes).toBe(2);
    expect(separated.borrowedSingletonGeometries).toBe(2);
    expect(separated.compiler.liveGeometries).toBe(0);
    expect(separated.compiler.pendingJobs).toBe(0);
    expect(separated.borrowedSourceDisposals).toBe(0);
    await fixture.update(
        <GardenPaletteAdmissionFixture
            batch
            aggregate
            sources={1}
            mounted={false}
        />,
    );
    const released = await read('true:false:false:false:aggregate:1');
    expect(released.compiler.liveGeometries).toBe(0);
    expect(released.materials.sharedMaterialUsers).toBe(0);
    expect(released.borrowedSourceDisposals).toBe(0);
    await testInfo.attach('singleton-join-release', {
        body: JSON.stringify(
            {
                singleton,
                authored,
                joined,
                telemetryFrames,
                physical,
                separated,
                released,
            },
            null,
            2,
        ),
        contentType: 'application/json',
    });
    await testInfo.attach('joined-authored', {
        body: authoredPng,
        contentType: 'image/png',
    });
    await testInfo.attach('joined-stock', {
        body: joinedPng,
        contentType: 'image/png',
    });
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

for (const equalUniforms of [false, true]) {
    test(`production stock packets preserve main/shadow culling for equal uniforms=${equalUniforms}`, async ({
        mount,
        page,
    }, testInfo) => {
        test.setTimeout(90_000);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const fixture = await mount(
            <GardenPaletteCullingFixture equalUniforms={equalUniforms} />,
        );
        const snapshots: Record<string, unknown> = {};
        for (const view of ['mixed', 'all', 'none', 'opposite'] as const) {
            await fixture.update(
                <GardenPaletteCullingFixture
                    equalUniforms={equalUniforms}
                    view={view}
                />,
            );
            await expect(fixture).toHaveAttribute(
                'data-ready',
                `false:${view}${equalUniforms ? ':equal' : ''}`,
            );
            const source = JSON.parse(
                (await fixture.getAttribute('data-result')) ?? '{}',
            );
            const sourcePng = await fixture.locator('canvas').screenshot();
            await fixture.update(
                <GardenPaletteCullingFixture
                    equalUniforms={equalUniforms}
                    batch
                    view={view}
                />,
            );
            await expect(fixture).toHaveAttribute(
                'data-ready',
                `true:${view}${equalUniforms ? ':equal' : ''}`,
            );
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
                expect(packetRows.length).toBe(
                    view === 'none'
                        ? 0
                        : view === 'all' && !equalUniforms
                          ? 3
                          : 1,
                );
            }
            expect(candidate.packets.contributions).toBe(3);
            expect(candidate.packets.packets).toBe(equalUniforms ? 1 : 3);
            expect(candidate.packets.savedSubmissions).toBe(
                equalUniforms ? 2 : 0,
            );
            expect(candidate.geometryIds).toHaveLength(1);
            if (!equalUniforms) {
                expect(candidate.compiler.liveGeometries).toBe(0);
                expect(
                    candidate.compiler.syncCompiles +
                        candidate.compiler.workerCompiles,
                ).toBe(0);
            }
            expect(candidate.materialIds).toHaveLength(equalUniforms ? 1 : 3);
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
                expect(candidateHit.distance).toBeCloseTo(
                    sourceHit.distance,
                    6,
                );
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
        await fixture.update(
            <GardenPaletteCullingFixture
                equalUniforms={equalUniforms}
                batch
                view="mixed"
            />,
        );
        await expect(fixture).toHaveAttribute(
            'data-ready',
            `true:mixed${equalUniforms ? ':equal' : ''}`,
        );
        const before = JSON.parse(
            (await fixture.getAttribute('data-result')) ?? '{}',
        );
        await fixture.update(
            <GardenPaletteCullingFixture
                equalUniforms={equalUniforms}
                batch
                view="opposite"
            />,
        );
        await expect(fixture).toHaveAttribute(
            'data-ready',
            `true:opposite${equalUniforms ? ':equal' : ''}`,
        );
        const after = JSON.parse(
            (await fixture.getAttribute('data-result')) ?? '{}',
        );
        expect(after.geometryIds).toEqual(before.geometryIds);
        expect(after.materialIds).toEqual(before.materialIds);
        expect(after.compiler.syncCompiles).toBe(before.compiler.syncCompiles);
        expect(after.compiler.workerCompiles).toBe(
            before.compiler.workerCompiles,
        );
        await testInfo.attach('actual-main-shadow-submissions', {
            body: JSON.stringify({ snapshots, cameraOnly: { before, after } }),
            contentType: 'application/json',
        });
        expect(errors).toEqual([]);
    });
}

test('unsupported partial-range sources retain the original explicit merged path', async ({
    mount,
    page,
}, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await mount(
        <GardenPaletteCullingFixture unsupportedRange view="all" />,
    );
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'false:all:legacy-range',
    );
    const source = JSON.parse(
        (await fixture.getAttribute('data-result')) ?? '{}',
    );
    const sourcePng = await fixture.locator('canvas').screenshot();
    await fixture.update(
        <GardenPaletteCullingFixture batch unsupportedRange view="all" />,
    );
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'true:all:legacy-range',
    );
    const candidate = JSON.parse(
        (await fixture.getAttribute('data-result')) ?? '{}',
    );
    const candidatePng = await fixture.locator('canvas').screenshot();
    expect(candidate.localContributions).toHaveLength(3);
    expect(
        candidate.localContributions.every(
            (value: { sourceBoundsCulling: boolean }) =>
                value.sourceBoundsCulling === false,
        ),
    ).toBe(true);
    expect(candidate.sceneRaycastHits).toEqual(source.sceneRaycastHits);
    for (const pass of ['main', 'shadow'])
        expect(
            candidate.receipts
                .filter((row: { pass: string }) => row.pass === pass)
                .reduce(
                    (sum: number, row: { triangles: number }) =>
                        sum + row.triangles,
                    0,
                ),
        ).toBe(
            source.receipts
                .filter((row: { pass: string }) => row.pass === pass)
                .reduce(
                    (sum: number, row: { triangles: number }) =>
                        sum + row.triangles,
                    0,
                ),
        );
    const result = compare(await pixels(sourcePng), await pixels(candidatePng));
    expect(result.differentPixelRatio).toBeLessThan(0.001);
    expect(result.maxChannelError).toBeLessThanOrEqual(8);
    expect(candidate.sourceDisposals).toBe(0);
    await testInfo.attach('unsupported-merged-source', {
        body: JSON.stringify({ source, candidate, result }),
        contentType: 'application/json',
    });
    expect(errors).toEqual([]);
});

test('existing merged sources retain borrowed material ownership when stock admission is enabled', async ({
    mount,
    page,
}, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await mount(
        <GardenPaletteCullingFixture legacyMerged view="all" />,
    );
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'false:all:legacy-merged',
    );
    const source = JSON.parse(
        (await fixture.getAttribute('data-result')) ?? '{}',
    );
    const sourcePng = await fixture.locator('canvas').screenshot();
    await fixture.update(
        <GardenPaletteCullingFixture batch legacyMerged view="all" />,
    );
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'true:all:legacy-merged',
    );
    const candidate = JSON.parse(
        (await fixture.getAttribute('data-result')) ?? '{}',
    );
    const candidatePng = await fixture.locator('canvas').screenshot();
    expect(candidate.localContributions).toHaveLength(3);
    expect(
        candidate.localContributions.every(
            (value: { sourceBoundsCulling: boolean }) =>
                !value.sourceBoundsCulling,
        ),
    ).toBe(true);
    expect(candidate.stockMaterialCount).toBe(0);
    expect(candidate.borrowedMaterialIds).toHaveLength(3);
    expect(candidate.materialIds).toEqual(source.materialIds);
    expect(candidate.geometryIds).toEqual(source.geometryIds);
    expect(candidate.sourceDisposals).toBe(0);
    expect(candidate.sceneRaycastHits).toEqual(source.sceneRaycastHits);
    for (const pass of ['main', 'shadow'])
        expect(
            candidate.receipts
                .filter((row: { pass: string }) => row.pass === pass)
                .reduce(
                    (sum: number, row: { triangles: number }) =>
                        sum + row.triangles,
                    0,
                ),
        ).toBe(
            source.receipts
                .filter((row: { pass: string }) => row.pass === pass)
                .reduce(
                    (sum: number, row: { triangles: number }) =>
                        sum + row.triangles,
                    0,
                ),
        );
    const result = compare(await pixels(sourcePng), await pixels(candidatePng));
    expect(result.differentPixelRatio).toBeLessThan(0.001);
    expect(result.maxChannelError).toBeLessThanOrEqual(8);
    await testInfo.attach('legacy-material-lifetime', {
        body: JSON.stringify({ source, candidate, result }),
        contentType: 'application/json',
    });
    expect(errors).toEqual([]);
});

test('equal stock sources keep independent Canvas ownership through sibling release', async ({
    mount,
    page,
}, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await mount(
        <div>
            <div key="first" data-testid="first-root">
                <GardenPaletteCullingFixture batch equalUniforms />
            </div>
            <div key="second" data-testid="second-root">
                <GardenPaletteCullingFixture batch equalUniforms />
            </div>
        </div>,
    );
    const first = fixture
            .getByTestId('first-root')
            .getByTestId('palette-culling'),
        second = fixture
            .getByTestId('second-root')
            .getByTestId('palette-culling');
    await expect(first).toHaveAttribute('data-ready', 'true:mixed:equal');
    await expect(second).toHaveAttribute('data-ready', 'true:mixed:equal');
    const a = JSON.parse((await first.getAttribute('data-result')) ?? '{}'),
        b = JSON.parse((await second.getAttribute('data-result')) ?? '{}');
    expect(a.materialIds).toHaveLength(1);
    expect(b.materialIds).toHaveLength(1);
    expect(a.materialIds).not.toEqual(b.materialIds);
    const before = await second.locator('canvas').screenshot();
    await fixture.update(
        <div>
            <div key="first" data-testid="first-root" />
            <div key="second" data-testid="second-root">
                <GardenPaletteCullingFixture batch equalUniforms />
            </div>
        </div>,
    );
    await expect(second).toHaveAttribute('data-ready', 'true:mixed:equal');
    // Observe a fresh actual surviving-root submission after sibling release.
    await fixture.update(
        <div>
            <div key="first" data-testid="first-root" />
            <div key="second" data-testid="second-root">
                <GardenPaletteCullingFixture
                    batch
                    equalUniforms
                    view="opposite"
                />
            </div>
        </div>,
    );
    await expect(second).toHaveAttribute('data-ready', 'true:opposite:equal');
    await fixture.update(
        <div>
            <div key="first" data-testid="first-root" />
            <div key="second" data-testid="second-root">
                <GardenPaletteCullingFixture batch equalUniforms />
            </div>
        </div>,
    );
    await expect(second).toHaveAttribute('data-ready', 'true:mixed:equal');
    const surviving = JSON.parse(
        (await second.getAttribute('data-result')) ?? '{}',
    );
    expect(surviving.frame).toBeGreaterThan(b.frame);
    expect(surviving.localContributions).toHaveLength(3);
    expect(
        surviving.receipts.some(
            (row: { pass: string; calls: number }) =>
                row.pass === 'main' && row.calls > 0,
        ),
    ).toBe(true);
    expect(surviving.materialIds).toEqual(b.materialIds);
    expect(surviving.sourceDisposals).toBe(0);
    const after = await second.locator('canvas').screenshot();
    const result = compare(await pixels(before), await pixels(after));
    expect(result.differentPixelRatio).toBeLessThan(0.001);
    expect(result.maxChannelError).toBeLessThanOrEqual(8);
    await testInfo.attach('independent-root-ownership', {
        body: JSON.stringify({ a, b, surviving, result }),
        contentType: 'application/json',
    });
    expect(errors).toEqual([]);
});

test('committed, changed and context-restored stock presentation preserves whole-scene picking and native shadows', async ({
    mount,
    page,
}, testInfo) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await mount(
        <GardenPaletteCullingFixture transitionWitness />,
    );
    await expect(fixture).toHaveAttribute(
        'data-ready',
        'false:mixed:transition:0:false',
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
                transitionWitness
                shaderRevision={revision}
                restoreContext={restored}
            />,
        );
        await expect(fixture).toHaveAttribute(
            'data-ready',
            `true:mixed:transition:${revision}:${restored}`,
        );
        const candidate = JSON.parse(
            (await fixture.getAttribute('data-result')) ?? '{}',
        );
        const frames = candidate.transitionFrames.filter(
            (sample: { revision: number; restored: boolean }) =>
                sample.revision === revision && sample.restored === restored,
        );
        const handoff = frames.filter(
            (sample: { phase: string }) => sample.phase !== 'first-affected',
        );
        expect(
            handoff.map((sample: { phase: string }) => sample.phase),
        ).toEqual(['ready']);
        expect(
            frames.filter(
                (sample: { phase: string }) =>
                    sample.phase === 'first-affected',
            ),
        ).toHaveLength(revision > 0 || restored ? 1 : 0);
        expect(candidate.missingPresentationFrames).toBe(0);
        expect(handoff[0].hiddenPaletteMeshes).toBe(0);
        // Distinct uniforms now remain three direct singleton InstancedMeshes.
        expect(handoff[0].visiblePaletteMeshes).toBe(3);
        expect(handoff[0].fallbackMeshes).toBe(0);
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
                `stock-transition-${revision}-${restored}-${frame.phase}-frame-${frame.frame}`,
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
        await testInfo.attach(`stock-transition-${revision}-${restored}`, {
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
                transitionWitness
                shaderRevision={revision}
                restoreContext={restored}
            />,
        );
        await expect(fixture).toHaveAttribute(
            'data-ready',
            `false:mixed:transition:${revision}:${restored}`,
        );
        const control = JSON.parse(
            (await fixture.getAttribute('data-result')) ?? '{}',
        );
        const controlPng = submittedCanvasPng(control.png);
        const controlPixels = await pixels(controlPng);
        await testInfo.attach(
            `stock-transition-source-${revision}-${restored}-frame-${control.frame}`,
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
        test(`stock packets preserve ${weather} ${night ? 'night' : 'day'} colors, shadows, maps and depth`, async ({
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
            expect(readback.paletteVertices).toBe(0);
            expect(readback.stockMeshes).toBe(6);
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

for (const [entityName, rain, sameChunk] of [
    ['Tree', false, false],
    ['Tree', true, false],
    ['Stool', false, false],
    ['Stool', false, true],
] as const) {
    test(`actual ${entityName} GLTF packet props preserve hover, pickup, selection, drag and drop pixels with rain=${rain} sameChunk=${sameChunk}`, async ({
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
            // managed timers live until worker compilation and native presentation complete.
            await page.clock.install();
            await page.evaluate(installGardenPaletteFrameInput);
            for (const batch of [false, true]) {
                await page.clock.resume();
                const fixture = await mount(
                    <GardenPaletteInteractionFixture
                        batch={batch}
                        rain={rain}
                        entityName={entityName}
                        sameChunk={sameChunk}
                    />,
                );
                await page.waitForFunction(
                    () => window.gardenPaletteInteractionWitness !== undefined,
                    null,
                    { timeout: 15_000, polling: 100 },
                );
                // Let actual worker delivery and positive native frames commit
                // before freezing matched spring/weather inputs.
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
                let beforeDropPhysical = 0;
                let beforeDropTransformed = 0;
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
                        ['pickup', 'selection', 'drag'].includes(name) ||
                        (name === 'hover' && entityName === 'Tree')
                    ) {
                        expect(readback.outlineMeshes).toBeGreaterThan(0);
                        expect(readback.outlineOriginalGeometry).toBe(
                            readback.outlineMeshes,
                        );
                    }
                    if (entityName === 'Stool') {
                        if (name === 'hover')
                            expect(readback.outlineMeshes).toBe(0);
                        expect(readback.hoveredBlockId).toBe(
                            name === 'hover' ? 'palette-picked-tree' : null,
                        );
                        const stoolMembers = readback.stockContributions.filter(
                            (value) => value.blockName === 'Stool',
                        );
                        const pickedMember = stoolMembers.find(
                            (value) => value.blockId === 'palette-picked-tree',
                        );
                        expect(
                            stoolMembers.some(
                                (value) =>
                                    value.blockId === 'palette-static-tree' &&
                                    value.sourceBoundsCulling &&
                                    value.cacheGroup === 'static-props',
                            ),
                        ).toBe(batch);
                        if (batch && activeDrop)
                            expect(pickedMember).toBeUndefined();
                        if (batch && !activeDrop)
                            expect(pickedMember).toMatchObject({
                                cacheGroup: 'static-props',
                                sourceBoundsCulling: true,
                            });
                    }
                    if (name === 'drag')
                        expect(
                            readback.treePositions?.find(
                                (value) => value.id === 'palette-picked-tree',
                            ),
                        ).toEqual({
                            id: 'palette-picked-tree',
                            position: [
                                -0.75,
                                entityName === 'Stool' ? 1.35 : 0.85,
                                -0.5,
                            ],
                            pickupOutlineVisible: true,
                        });
                    if (
                        activeDrop &&
                        batch &&
                        entityName === 'Stool' &&
                        sameChunk
                    ) {
                        expect(
                            readback.placement
                                .placementChunkPhysicalRebuildCount,
                        ).toBeGreaterThan(beforeDropPhysical);
                        expect(
                            readback.placement
                                .placementChunkPhysicalTransformedInstanceCount,
                        ).toBeGreaterThan(beforeDropTransformed);
                        expect(readback.singletonMeshes).toBeGreaterThan(0);
                    }
                    if (activeDrop) {
                        expect(deltaSequence).toEqual(
                            entityName === 'Stool' ? [16, 16] : [16],
                        );
                        expect(readback.springStarted).toBe(true);
                        expect(readback.dropSpringAdvances).toHaveLength(
                            entityName === 'Stool' ? 2 : 1,
                        );
                        expect(
                            new Set(
                                readback.dropSpringAdvances.map(
                                    (advance) => advance.springIdentity,
                                ),
                            ).size,
                        ).toBe(entityName === 'Stool' ? 2 : 1);
                        for (const advance of readback.dropSpringAdvances)
                            expect(advance).toMatchObject({
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
                        if (
                            idle &&
                            name === 'hover' &&
                            entityName === 'Stool'
                        ) {
                            const hoverPixels = compare(
                                await pixels(idle.png),
                                await pixels(png),
                            );
                            expect(
                                hoverPixels.differentPixelRatio,
                            ).toBeLessThan(0.001);
                            expect(
                                hoverPixels.maxChannelError,
                            ).toBeLessThanOrEqual(8);
                        } else if (idle && name !== 'drop-settled')
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
                const beforeDrop = await read();
                if (!beforeDrop)
                    throw new Error('Missing before-drop telemetry');
                beforeDropPhysical =
                    beforeDrop.placement.placementChunkPhysicalRebuildCount;
                beforeDropTransformed =
                    beforeDrop.placement
                        .placementChunkPhysicalTransformedInstanceCount;
                // Prospectively align the input to an already admitted root
                // RAF on the unchanged fake16ms display grid. No spring exists
                // while waiting; no additional frame/timer/render is requested.
                const expectedRoot = await page.evaluate(
                    () =>
                        window.gardenPaletteInteractionWitness?.frameInput()
                            ?.rootId,
                );
                if (expectedRoot === undefined)
                    throw new Error(
                        'Missing native root identity before input',
                    );
                let armedInput: GardenPaletteFrameInputSnapshot | undefined;
                for (let waitMs = 0; waitMs <= 1000; waitMs++) {
                    const decision = await page.evaluate((rootId) => {
                        const witness = window.gardenPaletteInteractionWitness;
                        const value = witness?.snapshot();
                        const input = witness?.frameInput();
                        if (!input || input.rootId !== rootId)
                            throw new Error(
                                'Native root ownership changed before input',
                            );
                        const noDrop =
                            value?.phase === 'idle' &&
                            value?.dropAnimation === undefined &&
                            value?.springStarted === false &&
                            witness?.activeDrop() === undefined;
                        if (!noDrop)
                            throw new Error('Drop exists before input barrier');
                        if (!input?.ready) return { dispatched: false, input };
                        const button = document.querySelector(
                            '[data-testid="palette-drop"]',
                        );
                        if (!(button instanceof HTMLButtonElement))
                            throw new Error('Missing drop input button');
                        button.click();
                        return { dispatched: true, input };
                    }, expectedRoot);
                    stateCaptures.push({
                        batch,
                        name: 'drop-pre-input',
                        virtualWaitMs: waitMs,
                        ...decision,
                    });
                    if (decision.dispatched) {
                        armedInput = decision.input;
                        break;
                    }
                    if (waitMs < 1000) await page.clock.runFor(1);
                }
                if (!armedInput)
                    throw new Error(
                        'No equivalent admitted next16 root frame before drop',
                    );
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
                const actualDrop = await page.evaluate(() =>
                    window.gardenPaletteInteractionWitness?.activeDrop(),
                );
                expect(actualDrop?.frameInputReceipt).toEqual({
                    rootId: armedInput.rootId,
                    callbackId: armedInput.callbackId,
                    requestId: armedInput.queued[0].requestId,
                    timestamp: armedInput.dueAt,
                });
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
            const frameInputHistory = await page.evaluate(() => {
                const observer = window.gardenPaletteFrameInput;
                const history = observer?.history();
                const restored = observer?.restore();
                return { ...history, restored };
            });
            await testInfo.attach('pre-input-owned-frame-history', {
                body: JSON.stringify(frameInputHistory),
                contentType: 'application/json',
            });
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
            expect(frameInputHistory.errors).toEqual([]);
            expect(frameInputHistory.restored).toBe(true);
        }
        expect(outcomes).toHaveLength(7);
        expect(errors).toEqual([]);
    });
}

function lifetimeReadback(value: unknown) {
    if (typeof value !== 'object' || value === null)
        throw new Error('Lifetime readback required.');
    const counts = Reflect.get(value, 'counts'),
        lifetime = Reflect.get(value, 'lifetime');
    if (
        typeof counts !== 'object' ||
        counts === null ||
        typeof lifetime !== 'object' ||
        lifetime === null
    )
        throw new Error('Lifetime counts required.');
    const count = (object: object, name: string) => {
        const result: unknown = Reflect.get(object, name);
        if (
            typeof result !== 'number' ||
            !Number.isSafeInteger(result) ||
            result < 0
        )
            throw new Error(`Invalid lifetime count ${name}.`);
        return result;
    };
    const uniforms: unknown = Reflect.get(value, 'uniforms');
    const png: unknown = Reflect.get(value, 'png');
    const firstMain: unknown = Reflect.get(value, 'firstMainUniforms');
    if (!Array.isArray(firstMain))
        throw new Error('First actual positive GPU submission is required.');
    if (!Array.isArray(uniforms) || typeof png !== 'string')
        throw new Error('Actual uniform/pixel witness required.');
    return {
        native: readGardenPacketNativeProgramWitness(
            Reflect.get(value, 'nativePrograms'),
        ),
        counts: {
            ownedCreated: count(counts, 'ownedCreated'),
            ownedDisposed: count(counts, 'ownedDisposed'),
            borrowedDisposed: count(counts, 'borrowedDisposed'),
            contextLost: count(counts, 'contextLost'),
            contextRestored: count(counts, 'contextRestored'),
        },
        lifetime: {
            idleOrigins: count(lifetime, 'idleOrigins'),
            activeSignatures: count(lifetime, 'activeSignatures'),
        },
        uniforms: uniforms.map((uniform: unknown) => {
            if (typeof uniform !== 'object' || uniform === null)
                throw new Error('Uniform witness required.');
            const uuid: unknown = Reflect.get(uniform, 'uuid'),
                cloudStrength: unknown = Reflect.get(uniform, 'cloudStrength'),
                wetStrength: unknown = Reflect.get(uniform, 'wetStrength');
            if (
                typeof uuid !== 'string' ||
                (cloudStrength !== undefined &&
                    typeof cloudStrength !== 'number') ||
                typeof wetStrength !== 'number'
            )
                throw new Error('Current cloud/wet uniforms required.');
            return { uuid, cloudStrength, wetStrength };
        }),
        png,
        resources: Reflect.get(value, 'resources'),
        programInventory: Reflect.get(value, 'programInventory'),
        firstMainUniforms: firstMain.map((draw: unknown) => {
            if (typeof draw !== 'object' || draw === null)
                throw new Error('First GPU uniform submission required.');
            const cloud: unknown = Reflect.get(draw, 'cloud'),
                wet: unknown = Reflect.get(draw, 'wet'),
                cacheKey: unknown = Reflect.get(draw, 'cacheKey'),
                material: unknown = Reflect.get(draw, 'material');
            if (
                (cloud !== undefined &&
                    (typeof cloud !== 'number' || !Number.isFinite(cloud))) ||
                typeof wet !== 'number' ||
                !Number.isFinite(wet) ||
                typeof cacheKey !== 'string' ||
                typeof material !== 'string'
            )
                throw new Error('First actual GPU uniform values required.');
            return {
                cloud,
                wet,
                cacheKey,
                material,
                bounds: Reflect.get(draw, 'bounds'),
                projection: Reflect.get(draw, 'projection'),
                hardness: Reflect.get(draw, 'hardness'),
                mapMatches: Reflect.get(draw, 'mapMatches'),
            };
        }),
    };
}

function expectCurrentCloudGpu(
    readback: ReturnType<typeof lifetimeReadback>,
    strength: number,
) {
    expect(readback.firstMainUniforms.length).toBeGreaterThan(0);
    for (const draw of readback.firstMainUniforms) {
        expect(draw.cloud).toBe(Math.fround(strength));
        expect(draw.wet).toBe(Math.fround(0.4));
        expect(draw.bounds).toEqual([-10, -10, 0.04, 0.04].map(Math.fround));
        expect(draw.projection).toEqual([0.15, -0.2].map(Math.fround));
        expect(draw.hardness).toBe(Math.fround(0.6));
        expect(draw.mapMatches).toBe(true);
    }
}

function lifetimeMainPrograms(readback: ReturnType<typeof lifetimeReadback>) {
    const draws = readback.native.draws.filter(
        (draw) =>
            draw.pass === 'main' &&
            (draw.kind === 'singleton' || draw.kind === 'compiled'),
    );
    expect(draws.length).toBeGreaterThan(0);
    expect(
        draws.every(
            (draw) =>
                draw.calls > 0 && draw.instancing && draw.shaderInstancing,
        ),
    ).toBe(true);
    return new Map(draws.map((draw) => [draw.cacheKey, draw.programId]));
}

test('resident Dirt returns reuse actual native programs with current cloud uniforms and bounded root cleanup', async ({
    mount,
    page,
}, testInfo) => {
    test.setTimeout(90_000);
    const fixture = await mount(<GardenPacketLifetimeFixture />);
    const read = async (key: string) => {
        await expect(fixture).toHaveAttribute('data-ready', key);
        return lifetimeReadback(
            JSON.parse((await fixture.getAttribute('data-result')) ?? '{}'),
        );
    };
    const first = await read('true:0.4:0.2:false');
    const programs = lifetimeMainPrograms(first);
    const receipts = [first];
    expect(first.uniforms.length).toBeGreaterThan(0);
    expect(
        first.uniforms.every(
            (uniform) =>
                uniform.cloudStrength === 0.2 && uniform.wetStrength === 0.4,
        ),
    ).toBe(true);
    for (let i = 0; i < 4; i++) {
        await fixture.update(
            <GardenPacketLifetimeFixture mounted={false} cloudStrength={0.8} />,
        );
        const idle = await read('false:0.4:0.8:false');
        receipts.push(idle);
        await fixture.update(
            <GardenPacketLifetimeFixture cloudStrength={0.8} />,
        );
        const returned = await read('true:0.4:0.8:false');
        receipts.push(returned);
        await testInfo.attach(`resident-dirt-return-${i + 1}`, {
            body: JSON.stringify({ first, idle, returned }, null, 2),
            contentType: 'application/json',
        });
        expect(lifetimeMainPrograms(returned)).toEqual(programs);
        expect(idle.lifetime).toEqual({ idleOrigins: 1, activeSignatures: 0 });
        expect(idle.native.liveBuffers).toBe(first.native.liveBuffers - 2);
        expect(returned.native.liveBuffers).toBe(first.native.liveBuffers);
        expect(returned.native.createdPrograms).toBe(
            first.native.createdPrograms,
        );
        expectCurrentCloudGpu(returned, 0.8);
        expect(returned.firstMainUniforms.length).toBeGreaterThan(0);
        expect(
            returned.firstMainUniforms.every(
                (draw) =>
                    draw.cloud === Math.fround(0.8) &&
                    draw.wet === Math.fround(0.4),
            ),
        ).toBe(true);
        expect(returned.uniforms.length).toBeGreaterThan(0);
        expect(
            returned.uniforms.every(
                (uniform) =>
                    uniform.cloudStrength === 0.8 &&
                    uniform.wetStrength === 0.4,
            ),
        ).toBe(true);
        expect(returned.counts.ownedCreated).toBe(first.counts.ownedCreated);
        expect(returned.counts.borrowedDisposed).toBe(0);
    }
    expect(await pixels(submittedCanvasPng(first.png))).not.toEqual(
        await pixels(submittedCanvasPng(receipts[2].png)),
    );
    await testInfo.attach('resident-dirt-native-program-return-receipts', {
        body: JSON.stringify(receipts, null, 2),
        contentType: 'application/json',
    });
    const beforeClose = receipts.at(-1);
    if (!beforeClose) throw new Error('Positive return receipt required.');
    await fixture.unmount();
    const closed = lifetimeReadback(
        await page.evaluate(() => window.gardenPacketLifetimeWitness?.read()),
    );
    await testInfo.attach('resident-dirt-root-cleanup', {
        body: JSON.stringify(closed, null, 2),
        contentType: 'application/json',
    });
    expect(closed.lifetime).toEqual({ idleOrigins: 0, activeSignatures: 0 });
    expect(closed.counts.ownedDisposed).toBe(closed.counts.ownedCreated);
    expect(closed.counts.borrowedDisposed).toBe(0);
    expect(closed.native.deletedPrograms).toBeGreaterThan(
        beforeClose.native.deletedPrograms,
    );
    expect(closed.native.deletedBuffers).toBe(
        beforeClose.native.deletedBuffers + 2,
    );
    await page.evaluate(() =>
        window.gardenPacketLifetimeWitness?.stopObserving(),
    );
});

test('resident stock configuration changes and aborted Suspense stay bounded across context restoration', async ({
    mount,
    page,
}, testInfo) => {
    test.setTimeout(90_000);
    const fixture = await mount(<GardenPacketLifetimeFixture aborted />);
    const read = async (key: string) => {
        await expect(fixture).toHaveAttribute('data-ready', key);
        return lifetimeReadback(
            JSON.parse((await fixture.getAttribute('data-result')) ?? '{}'),
        );
    };
    const first = await read('true:0.4:0.2:true');
    expect(first.lifetime).toEqual({ idleOrigins: 0, activeSignatures: 1 });
    const receipts = [first];
    for (let i = 0; i < 6; i++) {
        const wetStrength = i % 2 ? 0.4 : 0.9;
        await fixture.update(
            <GardenPacketLifetimeFixture wetStrength={wetStrength} aborted />,
        );
        const changed = await read(`true:${wetStrength}:0.2:true`);
        receipts.push(changed);
        expect(changed.lifetime).toEqual({
            idleOrigins: 0,
            activeSignatures: 1,
        });
        expect(changed.uniforms.length).toBeGreaterThan(0);
        expect(
            changed.uniforms.every(
                (uniform) => uniform.wetStrength === wetStrength,
            ),
        ).toBe(true);
        expect(changed.counts.ownedCreated - changed.counts.ownedDisposed).toBe(
            1,
        );
        expect(changed.counts.borrowedDisposed).toBe(0);
    }
    expect(await pixels(submittedCanvasPng(first.png))).not.toEqual(
        await pixels(submittedCanvasPng(receipts[1].png)),
    );
    await page.evaluate(() =>
        window.gardenPacketLifetimeWitness?.loseContext(),
    );
    await expect
        .poll(
            async () =>
                lifetimeReadback(
                    await page.evaluate(() =>
                        window.gardenPacketLifetimeWitness?.read(),
                    ),
                ).counts.contextLost,
        )
        .toBe(1);
    await page.evaluate(() =>
        window.gardenPacketLifetimeWitness?.restoreContext(),
    );
    await expect
        .poll(
            async () =>
                lifetimeReadback(
                    await page.evaluate(() =>
                        window.gardenPacketLifetimeWitness?.read(),
                    ),
                ).counts.contextRestored,
        )
        .toBe(1);
    await fixture.update(
        <GardenPacketLifetimeFixture
            wetStrength={0.4}
            cloudStrength={0.8}
            aborted
        />,
    );
    const restored = await read('true:0.4:0.8:true');
    receipts.push(restored);
    await testInfo.attach('resident-stock-config-and-context-receipts', {
        body: JSON.stringify(receipts, null, 2),
        contentType: 'application/json',
    });

    expect(restored.lifetime).toEqual({ idleOrigins: 0, activeSignatures: 1 });
    expect(
        restored.uniforms.every(
            (uniform) =>
                uniform.cloudStrength === 0.8 && uniform.wetStrength === 0.4,
        ),
    ).toBe(true);
    const beforeLoss = receipts.at(-2);
    if (!beforeLoss) throw new Error('Pre-loss draw required.');
    expect(restored.counts.ownedCreated).toBe(beforeLoss.counts.ownedCreated);
    expect(restored.uniforms.map((uniform) => uniform.uuid)).toEqual(
        beforeLoss.uniforms.map((uniform) => uniform.uuid),
    );
    expect([...lifetimeMainPrograms(restored).keys()]).toEqual([
        ...lifetimeMainPrograms(beforeLoss).keys(),
    ]);
    expect([...lifetimeMainPrograms(restored).values()]).not.toEqual([
        ...lifetimeMainPrograms(beforeLoss).values(),
    ]);
    expect(restored.native.livePrograms).toBe(beforeLoss.native.livePrograms);
    expect(restored.native.lostPrograms).toBe(beforeLoss.native.livePrograms);
    expect(restored.native.lostBuffers).toBe(beforeLoss.native.liveBuffers);
    await fixture.unmount();
    const closed = lifetimeReadback(
        await page.evaluate(() => window.gardenPacketLifetimeWitness?.read()),
    );
    expect(closed.counts.ownedDisposed).toBe(closed.counts.ownedCreated);
    expect(closed.lifetime).toEqual({ idleOrigins: 0, activeSignatures: 0 });
    await page.evaluate(() =>
        window.gardenPacketLifetimeWitness?.stopObserving(),
    );
});

test('resident stock cloud program variants use current custom uniforms after an unpatched draw', async ({
    mount,
    page,
}, testInfo) => {
    test.setTimeout(60_000);
    const fixture = await mount(<GardenPacketLifetimeFixture />);
    const read = async (key: string) => {
        await expect(fixture).toHaveAttribute('data-ready', key);
        return lifetimeReadback(
            JSON.parse((await fixture.getAttribute('data-result')) ?? '{}'),
        );
    };
    const first = await read('true:0.4:0.2:false');
    await fixture.update(
        <GardenPacketLifetimeFixture mounted={false} cloudStrength={0} />,
    );
    const idle = await read('false:0.4:0:false');
    await fixture.update(<GardenPacketLifetimeFixture cloudStrength={0} />);
    const unpatched = await read('true:0.4:0:false');
    expect(unpatched.uniforms.length).toBeGreaterThan(0);
    expect(
        unpatched.uniforms.every(
            (uniform) =>
                uniform.cloudStrength === undefined &&
                uniform.wetStrength === 0.4,
        ),
    ).toBe(true);
    await fixture.update(
        <GardenPacketLifetimeFixture mounted={false} cloudStrength={0.8} />,
    );
    await read('false:0.4:0.8:false');
    await fixture.update(<GardenPacketLifetimeFixture cloudStrength={0.8} />);
    const returned = await read('true:0.4:0.8:false');
    await testInfo.attach('resident-stock-cloud-program-variants', {
        body: JSON.stringify({ first, idle, unpatched, returned }, null, 2),
        contentType: 'application/json',
    });
    expectCurrentCloudGpu(returned, 0.8);
    expect(returned.uniforms.length).toBeGreaterThan(0);
    expect(
        returned.uniforms.every(
            (uniform) =>
                uniform.cloudStrength === 0.8 && uniform.wetStrength === 0.4,
        ),
    ).toBe(true);
    expect(lifetimeMainPrograms(returned)).toEqual(lifetimeMainPrograms(first));
    await fixture.unmount();
    await page.evaluate(() =>
        window.gardenPacketLifetimeWitness?.stopObserving(),
    );
});

test('active stock cloud program variants bind current uniforms on their first actual return draw', async ({
    mount,
    page,
}, testInfo) => {
    test.setTimeout(60_000);
    const fixture = await mount(<GardenPacketLifetimeFixture />);
    const read = async (key: string) => {
        await expect(fixture).toHaveAttribute('data-ready', key);
        return lifetimeReadback(
            JSON.parse((await fixture.getAttribute('data-result')) ?? '{}'),
        );
    };
    const first = await read('true:0.4:0.2:false');
    await fixture.update(<GardenPacketLifetimeFixture cloudStrength={0} />);
    const unpatched = await read('true:0.4:0:false');
    await fixture.update(<GardenPacketLifetimeFixture cloudStrength={0.8} />);
    const returned = await read('true:0.4:0.8:false');
    await testInfo.attach('active-stock-cloud-first-return-uniforms', {
        body: JSON.stringify({ first, unpatched, returned }, null, 2),
        contentType: 'application/json',
    });
    expect(returned.uniforms.map((uniform) => uniform.uuid)).toEqual(
        first.uniforms.map((uniform) => uniform.uuid),
    );
    expect(lifetimeMainPrograms(returned)).toEqual(lifetimeMainPrograms(first));
    expectCurrentCloudGpu(returned, 0.8);
    expect(returned.firstMainUniforms.length).toBeGreaterThan(0);
    expect(
        returned.firstMainUniforms.every(
            (draw) =>
                draw.cloud === Math.fround(0.8) &&
                draw.wet === Math.fround(0.4),
        ),
    ).toBe(true);
    await fixture.unmount();
    await page.evaluate(() =>
        window.gardenPacketLifetimeWitness?.stopObserving(),
    );
});

test('resident stock cloud uniforms remain isolated between live Canvas roots and sibling release', async ({
    mount,
    page,
}, testInfo) => {
    test.setTimeout(60_000);
    const fixture = await mount(
        <div>
            <GardenPacketLifetimeFixture key="first" cloudStrength={0.2} />
            <GardenPacketLifetimeFixture key="second" cloudStrength={0.8} />
        </div>,
    );
    const read = async (index: number, key: string) => {
        const root = fixture.getByTestId('garden-packet-lifetime').nth(index);
        await expect(root).toHaveAttribute('data-ready', key);
        return lifetimeReadback(
            JSON.parse((await root.getAttribute('data-result')) ?? '{}'),
        );
    };
    const first = await read(0, 'true:0.4:0.2:false');
    const second = await read(1, 'true:0.4:0.8:false');
    expect(first.uniforms.length).toBeGreaterThan(0);
    expect(second.uniforms.length).toBeGreaterThan(0);
    expect(first.uniforms.map((uniform) => uniform.uuid)).not.toEqual(
        second.uniforms.map((uniform) => uniform.uuid),
    );
    expect(first.firstMainUniforms.length).toBeGreaterThan(0);
    for (const draw of first.firstMainUniforms) {
        expect(draw.cloud).toBe(Math.fround(0.2));
        expect(draw.bounds).toEqual([-20, -20, 0.025, 0.025].map(Math.fround));
        expect(draw.projection).toEqual([0, 0]);
        expect(draw.hardness).toBe(0);
        expect(draw.mapMatches).toBe(true);
    }
    expectCurrentCloudGpu(second, 0.8);
    await fixture.update(
        <div>
            <GardenPacketLifetimeFixture key="second" cloudStrength={0} />
        </div>,
    );
    const unpatched = await read(0, 'true:0.4:0:false');
    await fixture.update(
        <div>
            <GardenPacketLifetimeFixture key="second" cloudStrength={0.9} />
        </div>,
    );
    const returned = await read(0, 'true:0.4:0.9:false');
    await testInfo.attach('resident-stock-isolated-root-cloud-uniforms', {
        body: JSON.stringify({ first, second, unpatched, returned }, null, 2),
        contentType: 'application/json',
    });
    expect(returned.uniforms.map((uniform) => uniform.uuid)).toEqual(
        second.uniforms.map((uniform) => uniform.uuid),
    );
    expect(lifetimeMainPrograms(returned)).toEqual(
        lifetimeMainPrograms(second),
    );
    expectCurrentCloudGpu(returned, 0.9);
    expect(returned.counts.borrowedDisposed).toBe(0);
    expect(returned.counts.ownedCreated - returned.counts.ownedDisposed).toBe(
        1,
    );
    expect(returned.lifetime).toEqual({ idleOrigins: 0, activeSignatures: 1 });
    await fixture.unmount();
    await page.evaluate(() =>
        window.gardenPacketLifetimeWitness?.stopObserving(),
    );
});
