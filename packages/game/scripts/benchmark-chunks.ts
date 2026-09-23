import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BufferGeometry, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
    type ChunkedMeshInstance,
    createChunkMatrices,
    createMeshInstanceMatrix,
} from '../src/entities/chunkedMeshGeometry';
import { synchronousChunkComponentLimit } from '../src/scene/compiler/MeshCompiler';
import {
    compileMeshBuffers,
    meshGeometryComponentCount,
    packMeshGeometry,
    unpackMeshGeometry,
} from '../src/scene/compiler/meshBuffers';
import { compileRetainedGardenScene } from '../src/scene/compiler/retainedGardenScene';
import type { Stack } from '../src/types/Stack';

const local = { position: [0, 0, 0], rotation: [0, 0, 0] } satisfies Parameters<
    typeof createMeshInstanceMatrix
>[1];
function timings(operation: () => void) {
    for (let i = 0; i < 20; i++) operation();
    const samples = Array.from({ length: 100 }, () => {
        const start = performance.now();
        operation();
        return performance.now() - start;
    }).sort((a, b) => a - b);
    return { medianMs: samples[50], p95Ms: samples[94], maxMs: samples[99] };
}

const geometryResults = [];
for (const asset of ['BlockGround', 'BlockGrass', 'BlockStone']) {
    const file = await readFile(
        new URL(
            `../../../apps/garden/public/assets/models/${asset}.glb`,
            import.meta.url,
        ),
    );
    const gltf = await new GLTFLoader().parseAsync(
        file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
        '',
    );
    const geometries: BufferGeometry[] = [];
    gltf.scene.traverse((node) => {
        if (node instanceof Mesh && node.geometry instanceof BufferGeometry)
            geometries.push(node.geometry);
    });
    for (const source of geometries) {
        for (const count of [1, 8, 64, 256]) {
            const instances: ChunkedMeshInstance[] = Array.from(
                { length: count },
                (_, i) => ({
                    position: [i % 8, 0, Math.floor(i / 8)],
                    rotation: i % 4,
                }),
            );
            const components = meshGeometryComponentCount(source) * count;
            const direct = timings(() => {
                const output = unpackMeshGeometry(
                    compileMeshBuffers(
                        packMeshGeometry(source),
                        createChunkMatrices(instances, local, 1),
                    ),
                );
                output.dispose();
            });
            const legacy = timings(() => {
                const clones = instances.map((instance) =>
                    source
                        .clone()
                        .applyMatrix4(
                            createMeshInstanceMatrix(instance, local, 1),
                        ),
                );
                const output = mergeGeometries(clones, false);
                output?.computeBoundingBox();
                output?.computeBoundingSphere();
                output?.dispose();
                for (const clone of clones) clone.dispose();
            });
            const synchronous = components <= synchronousChunkComponentLimit;
            if (synchronous)
                assert.ok(
                    direct.p95Ms < 2,
                    `${asset} small-patch p95 exceeded 2 ms`,
                );
            geometryResults.push({
                asset,
                vertices: source.getAttribute('position').count,
                count,
                components,
                synchronous,
                direct,
                legacy,
            });
        }
    }
    for (const geometry of geometries) geometry.dispose();
}

const stacks: Stack[] = Array.from({ length: 4096 }, (_, i) => ({
    position: new Vector3(i % 64, 0, Math.floor(i / 64)),
    blocks: [{ id: String(i), name: 'Block_Grass', rotation: 0 }],
}));
const scene = compileRetainedGardenScene(stacks, undefined);
const patch = stacks.map((stack, i) =>
    i === 650
        ? { ...stack, blocks: [{ ...stack.blocks[0], rotation: 1 }] }
        : stack,
);
const scenePatch = timings(() => {
    const result = compileRetainedGardenScene(patch, undefined, scene);
    assert.equal(result.dirtyChunkKeys.length, 1);
    assert.equal(
        result.chunks.filter((chunk, i) => chunk === scene.chunks[i]).length,
        scene.chunks.length - 1,
    );
});
console.log(
    JSON.stringify(
        {
            runtime: process.version,
            platform: process.platform,
            arch: process.arch,
            synchronousChunkComponentLimit,
            geometryResults,
            scenePatch,
        },
        null,
        2,
    ),
);
