import { Matrix4, Vector3 } from 'three';
import {
    compileMeshBuffers,
    packMeshGeometry,
} from '../../src/scene/compiler/meshBuffers';

export function distribution(values) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return {
        samples: sorted.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
        min: sorted[0],
        max: sorted.at(-1),
    };
}

function transformJS(source, matrices, output) {
    let o = 0;
    for (let m = 0; m < matrices.length; m += 16) {
        for (let v = 0; v < source.length; v += 3) {
            const x = source[v];
            const y = source[v + 1];
            const z = source[v + 2];
            const w =
                1 /
                (matrices[m + 3] * x +
                    matrices[m + 7] * y +
                    matrices[m + 11] * z +
                    matrices[m + 15]);
            output[o++] =
                (matrices[m] * x +
                    matrices[m + 4] * y +
                    matrices[m + 8] * z +
                    matrices[m + 12]) *
                w;
            output[o++] =
                (matrices[m + 1] * x +
                    matrices[m + 5] * y +
                    matrices[m + 9] * z +
                    matrices[m + 13]) *
                w;
            output[o++] =
                (matrices[m + 2] * x +
                    matrices[m + 6] * y +
                    matrices[m + 10] * z +
                    matrices[m + 14]) *
                w;
        }
    }
}

export async function benchmarkCPU(geometry) {
    const started = performance.now();
    const { instance } = await WebAssembly.instantiateStreaming(
        fetch('/transform.wasm'),
    );
    const startupMs = performance.now() - started;
    const { memory, transform } = instance.exports;
    const source = new Float32Array(geometry.attributes.position.array);
    const results = [];
    // Existing chunk sizes plus an intentionally large bulk workload.
    for (const count of [8, 64, 256, 4096]) {
        const matrices = new Float64Array(count * 16);
        const matrix = new Matrix4();
        for (let i = 0; i < count; i++) {
            matrix.makeRotationY(((i % 4) * Math.PI) / 2);
            matrix.scale(new Vector3(1, 0.9 + (i % 3) * 0.1, 1));
            matrix.setPosition(i % 64, (i % 7) / 10, Math.floor(i / 64));
            matrices.set(matrix.elements, i * 16);
        }
        const mOffset = Math.ceil(source.byteLength / 8) * 8;
        const oOffset = mOffset + matrices.byteLength;
        const outputBytes = source.byteLength * count;
        const requiredPages = Math.ceil((oOffset + outputBytes) / 65536);
        if (requiredPages > memory.buffer.byteLength / 65536) {
            memory.grow(requiredPages - memory.buffer.byteLength / 65536);
        }
        const inputView = new Float32Array(memory.buffer, 0, source.length);
        const matrixView = new Float64Array(
            memory.buffer,
            mOffset,
            matrices.length,
        );
        const outputView = new Float32Array(
            memory.buffer,
            oOffset,
            source.length * count,
        );
        const jsOutput = new Float32Array(source.length * count);
        const copiedOutput = new Float32Array(source.length * count);
        inputView.set(source);
        matrixView.set(matrices);
        const wasm = () =>
            transform(0, mOffset, oOffset, source.length / 3, count);
        const js = () => transformJS(source, matrices, jsOutput);
        const copy = () => {
            inputView.set(source);
            matrixView.set(matrices);
            wasm();
            copiedOutput.set(outputView);
        };
        js();
        copy();
        // Compare against the real production compiler, not just two new kernels.
        const packed = packMeshGeometry(geometry);
        const production = compileMeshBuffers(packed, matrices).attributes
            .position.array;
        let maxError = 0;
        for (let i = 0; i < jsOutput.length; i++) {
            maxError = Math.max(
                maxError,
                Math.abs(jsOutput[i] - copiedOutput[i]),
                Math.abs(production[i] - copiedOutput[i]),
            );
        }
        if (!Number.isFinite(maxError) || maxError > 1e-5)
            throw new Error(`Wasm position parity failed: ${maxError}`);
        const operations = { js, wasm, wasmWithCopies: copy };
        for (const op of Object.values(operations))
            for (let i = 0; i < 100; i++) op();
        const batches = Math.max(1, Math.floor(16384 / count));
        const timings = { js: [], wasm: [], wasmWithCopies: [] };
        // Rotate the order to reduce JIT / thermal / scheduling bias.
        for (let round = 0; round < 60; round++) {
            const keys = Object.keys(operations);
            for (let n = 0; n < keys.length; n++) {
                const key = keys[(n + round) % keys.length];
                const start = performance.now();
                for (let b = 0; b < batches; b++) operations[key]();
                timings[key].push((performance.now() - start) / batches);
            }
            if (round % 10 === 0)
                await new Promise((resolve) => setTimeout(resolve, 0));
        }
        results.push({
            instances: count,
            sourceVertices: source.length / 3,
            outputBytes,
            batches,
            maxError,
            timings,
            summary: Object.fromEntries(
                Object.entries(timings).map(([k, v]) => [k, distribution(v)]),
            ),
        });
    }
    return { startupMs, memoryBytes: memory.buffer.byteLength, results };
}
