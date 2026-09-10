import assert from 'node:assert/strict';
import test from 'node:test';
import type { WebGLProgram, WebGLRenderer } from 'three';
import {
    createRendererStatsPublisher,
    rendererStatsMeasurementMode,
} from './rendererStats';

function renderer() {
    return {
        info: {
            memory: { geometries: 0, textures: 0 },
            programs: [],
            render: {
                calls: 0,
                frame: 0,
                lines: 0,
                points: 0,
                triangles: 0,
            },
        },
    } as unknown as WebGLRenderer;
}

test('renderer stats publish after the queued render boundary with a monotonic receipt', () => {
    const callbacks: Array<() => void> = [];
    const publications: Array<Record<string, unknown>> = [];
    const gl = renderer();
    const publisher = createRendererStatsPublisher({
        enqueue: (callback) => callbacks.push(callback),
        now: () => 123,
        publish: (metadata) => publications.push(metadata),
    });

    publisher.schedule(gl);
    assert.equal(publications.length, 0);

    gl.info.memory.geometries = 258;
    gl.info.memory.textures = 7;
    gl.info.programs = new Array<WebGLProgram>(24);
    gl.info.render.calls = 156;
    gl.info.render.frame = 1;
    gl.info.render.triangles = 19_812;
    callbacks.shift()?.();

    assert.deepEqual(publications[0], {
        rendererGeometries: 258,
        rendererLines: 0,
        rendererPoints: 0,
        rendererRenderCalls: 156,
        rendererShaders: 24,
        rendererStatsMeasurementMode,
        rendererStatsPublishedAt: 123,
        rendererStatsReceiptCount: 1,
        rendererStatsRenderFrame: 1,
        rendererTextures: 7,
        rendererTriangles: 19_812,
    });

    publisher.schedule(gl);
    callbacks.shift()?.();
    assert.equal(publications[1]?.rendererStatsReceiptCount, 2);
});

test('renderer stats coalesce queued reads and ignore stale work after disposal', () => {
    const callbacks: Array<() => void> = [];
    const publications: Array<Record<string, unknown>> = [];
    const publisher = createRendererStatsPublisher({
        enqueue: (callback) => callbacks.push(callback),
        publish: (metadata) => publications.push(metadata),
    });
    const gl = renderer();

    publisher.schedule(gl);
    publisher.schedule(gl);
    assert.equal(callbacks.length, 1);
    publisher.dispose();
    callbacks.shift()?.();
    publisher.schedule(gl);

    assert.equal(publications.length, 0);
    assert.equal(callbacks.length, 0);
});

test('renderer stats remain monotonic across StrictMode cleanup and remount', () => {
    const callbacks: Array<() => void> = [];
    const publications: Array<Record<string, unknown>> = [];
    const currentReceipt = () =>
        publications.at(-1)?.rendererStatsReceiptCount as number | undefined;
    const createPublisher = () =>
        createRendererStatsPublisher({
            enqueue: (callback) => callbacks.push(callback),
            publish: (metadata) => publications.push(metadata),
            readCurrentReceipt: currentReceipt,
        });
    const gl = renderer();

    const strictModeProbe = createPublisher();
    strictModeProbe.dispose();
    const mounted = createPublisher();
    mounted.schedule(gl);
    callbacks.shift()?.();
    assert.equal(currentReceipt(), 1);

    mounted.dispose();
    const remounted = createPublisher();
    remounted.schedule(gl);
    callbacks.shift()?.();
    assert.equal(currentReceipt(), 2);
});
