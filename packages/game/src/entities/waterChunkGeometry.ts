import {
    BufferGeometry,
    Float32BufferAttribute,
    Uint16BufferAttribute,
    type Vector4,
} from 'three';
import {
    type ChunkedMeshInstance,
    chunkMeshInstances,
    type MeshInstanceChunk,
} from './chunkedMeshGeometry';
import type { WaterBlockDepthSamples } from './waterBlockDepth';

export type WaterTopChunkInstance = ChunkedMeshInstance & {
    depthSamples: WaterBlockDepthSamples;
    foamCorners: Vector4;
    foamEdges: Vector4;
    shoreDepth: number;
    shoreDepthSamples?: WaterBlockDepthSamples;
    surfaceY: number;
    waterHeight: number;
};

const waterBlockHalfSize = 0.5;

export function chunkWaterTopInstances(
    instances: WaterTopChunkInstance[],
): MeshInstanceChunk<WaterTopChunkInstance>[] {
    return chunkMeshInstances(instances);
}

export function createWaterTopChunkGeometry(
    instances: WaterTopChunkInstance[],
) {
    const positions: number[] = [];
    const normals: number[] = [];
    const localPositions: number[] = [];
    const foamEdges: number[] = [];
    const foamCorners: number[] = [];
    const depths: number[] = [];
    const shoreDepths: number[] = [];
    const surfaceYs: number[] = [];
    const indices: number[] = [];

    instances.forEach((instance, instanceIndex) => {
        const [x, y, z] = instance.position;
        const topY = y + instance.waterHeight / 2;
        const localY = instance.waterHeight / 2;
        const vertexOffset = instanceIndex * 4;
        const worldVertices = [
            [x - waterBlockHalfSize, topY, z - waterBlockHalfSize],
            [x - waterBlockHalfSize, topY, z + waterBlockHalfSize],
            [x + waterBlockHalfSize, topY, z + waterBlockHalfSize],
            [x + waterBlockHalfSize, topY, z - waterBlockHalfSize],
        ];
        const localVertices = [
            [-waterBlockHalfSize, localY, -waterBlockHalfSize],
            [-waterBlockHalfSize, localY, waterBlockHalfSize],
            [waterBlockHalfSize, localY, waterBlockHalfSize],
            [waterBlockHalfSize, localY, -waterBlockHalfSize],
        ];

        for (let vertexIndex = 0; vertexIndex < 4; vertexIndex += 1) {
            const worldVertex = worldVertices[vertexIndex];
            const localVertex = localVertices[vertexIndex];

            if (worldVertex && localVertex) {
                positions.push(...worldVertex);
                normals.push(0, 1, 0);
                localPositions.push(...localVertex);
                foamEdges.push(
                    instance.foamEdges.x,
                    instance.foamEdges.y,
                    instance.foamEdges.z,
                    instance.foamEdges.w,
                );
                foamCorners.push(
                    instance.foamCorners.x,
                    instance.foamCorners.y,
                    instance.foamCorners.z,
                    instance.foamCorners.w,
                );
                depths.push(instance.depthSamples[vertexIndex] ?? 0);
                shoreDepths.push(
                    instance.shoreDepthSamples?.[vertexIndex] ??
                        instance.shoreDepth,
                );
                surfaceYs.push(instance.surfaceY);
            }
        }

        indices.push(
            vertexOffset,
            vertexOffset + 1,
            vertexOffset + 2,
            vertexOffset,
            vertexOffset + 2,
            vertexOffset + 3,
        );
    });

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setAttribute(
        'waterLocalPosition',
        new Float32BufferAttribute(localPositions, 3),
    );
    geometry.setAttribute(
        'waterFoamEdges',
        new Float32BufferAttribute(foamEdges, 4),
    );
    geometry.setAttribute(
        'waterFoamCorners',
        new Float32BufferAttribute(foamCorners, 4),
    );
    geometry.setAttribute('waterDepth', new Float32BufferAttribute(depths, 1));
    geometry.setAttribute(
        'waterShoreDepth',
        new Float32BufferAttribute(shoreDepths, 1),
    );
    geometry.setAttribute(
        'waterSurfaceY',
        new Float32BufferAttribute(surfaceYs, 1),
    );
    geometry.setIndex(new Uint16BufferAttribute(indices, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
}
