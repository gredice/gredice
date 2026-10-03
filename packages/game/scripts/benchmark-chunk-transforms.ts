import assert from 'node:assert/strict';
import { BoxGeometry } from 'three';
import {
    type ChunkedMeshInstance,
    createChunkMatrices,
    createMeshInstanceMatrix,
} from '../src/entities/chunkedMeshGeometry';
import {
    compileMeshBuffers,
    packMeshGeometry,
} from '../src/scene/compiler/meshBuffers';

const local = {
    position: [-0.5, 0.25, 0.75],
    rotation: [0.3, -0.4, 0.1],
} satisfies Parameters<typeof createChunkMatrices>[1];
const scale: [number, number, number] = [0.75, 1.25, -1];
const sampleCount = 200;
const results = [];
const source = new BoxGeometry();
const packed = packMeshGeometry(source);

function summarize(samples: number[]) {
    samples.sort((a, b) => a - b);
    return {
        p50Ms: samples[Math.floor(samples.length * 0.5)],
        p95Ms: samples[Math.ceil(samples.length * 0.95) - 1],
        maxMs: samples[samples.length - 1],
    };
}

for (const count of [0, 8, 64, 4096, 16384]) {
    const instances: ChunkedMeshInstance[] = Array.from(
        { length: count },
        (_, index) => ({
            position: [
                (index % 64) - 32,
                index % 3,
                Math.floor(index / 64) - 32,
            ],
            rotation: index % 4,
        }),
    );
    const legacy = () => {
        const output = new Float64Array(count * 16);
        for (let index = 0; index < count; index++) {
            createMeshInstanceMatrix(instances[index], local, scale).toArray(
                output,
                index * 16,
            );
        }
        return output;
    };
    const candidate = () => createChunkMatrices(instances, local, scale);
    assert.deepEqual(candidate(), legacy());
    for (let warmup = 0; warmup < 30; warmup++) {
        legacy();
        candidate();
    }
    const baselinePreparation: number[] = [];
    const candidatePreparation: number[] = [];
    const baselineCompilation: number[] = [];
    const candidateCompilation: number[] = [];
    for (let sample = 0; sample < sampleCount; sample++) {
        // Alternate order to avoid systematically favoring one implementation.
        const operations =
            sample % 2 === 0 ? [legacy, candidate] : [candidate, legacy];
        for (const operation of operations) {
            const startedAt = performance.now();
            const matrices = operation();
            const preparedAt = performance.now();
            compileMeshBuffers(packed, matrices);
            const finishedAt = performance.now();
            const preparation =
                operation === legacy
                    ? baselinePreparation
                    : candidatePreparation;
            const compilation =
                operation === legacy
                    ? baselineCompilation
                    : candidateCompilation;
            preparation.push(preparedAt - startedAt);
            compilation.push(finishedAt - startedAt);
        }
    }
    results.push({
        count,
        independentlyOwnedOutputBytes:
            count * 16 * Float64Array.BYTES_PER_ELEMENT,
        // Counts only explicitly constructed Three.js transform objects.
        // GC and browser request-to-visible timing require separate captures.
        baselineTransformObjects: count * 10,
        candidateTransformObjects: count === 0 ? 0 : 10,
        baselinePreparation: summarize(baselinePreparation),
        candidatePreparation: summarize(candidatePreparation),
        baselinePreparationAndCompilation: summarize(baselineCompilation),
        candidatePreparationAndCompilation: summarize(candidateCompilation),
    });
}
source.dispose();
console.log(
    JSON.stringify(
        {
            runtime: process.version,
            platform: process.platform,
            arch: process.arch,
            sampleCount,
            results,
        },
        null,
        2,
    ),
);
