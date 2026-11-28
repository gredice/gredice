import {
    BufferGeometry,
    Float32BufferAttribute,
    Uint16BufferAttribute,
    Uint32BufferAttribute,
    type Vector4,
} from 'three';
import {
    type ChunkedMeshInstance,
    chunkMeshInstances,
    type MeshInstanceChunk,
} from './chunkedMeshGeometry';
import type { WaterBlockDepthSamples } from './waterBlockDepth';
import {
    createWaterRimTopQuads,
    waterRimCornersFromFlags,
    waterRimQuadTriangles,
    waterRimSidesFromFlags,
} from './waterBlockRim';

export type WaterTopChunkInstance = ChunkedMeshInstance & {
    depthSamples: WaterBlockDepthSamples;
    foamCorners: Vector4;
    foamEdges: Vector4;
    /** Inner corners the neighbours' rounded lips turn inside this tile. */
    rimCorners?: Vector4;
    /** Exposed sides, which round over into the side wall. */
    rimEdges?: Vector4;
    shoreDepth: number;
    shoreDepthSamples?: WaterBlockDepthSamples;
    surfaceY: number;
    waterHeight: number;
};

export function chunkWaterTopInstances<TInstance extends WaterTopChunkInstance>(
    instances: TInstance[],
): MeshInstanceChunk<TInstance>[] {
    return chunkMeshInstances(instances);
}

/**
 * Value at a local point of a tile from its four corner samples, in the
 * order of `WaterBlockDepthSamples`: (-x,-z), (-x,+z), (+x,+z), (+x,-z).
 */
export function sampleWaterTileCorners(
    samples: readonly number[],
    localX: number,
    localZ: number,
) {
    const u = Math.min(1, Math.max(0, localX + 0.5));
    const v = Math.min(1, Math.max(0, localZ + 0.5));
    return (
        (1 - u) * (1 - v) * (samples[0] ?? 0) +
        (1 - u) * v * (samples[1] ?? 0) +
        u * v * (samples[2] ?? 0) +
        u * (1 - v) * (samples[3] ?? 0)
    );
}

/** A bank only where the side is not exposed: the rim is not a shore. */
function bankFlags(foam: Vector4, rim: Vector4 | undefined) {
    return [
        rim && rim.x > 0.5 ? 0 : foam.x,
        rim && rim.y > 0.5 ? 0 : foam.y,
        rim && rim.z > 0.5 ? 0 : foam.z,
        rim && rim.w > 0.5 ? 0 : foam.w,
    ];
}

/**
 * The visible water tops of a chunk in one mesh. A tile is one flat quad,
 * or, with exposed sides, a flat top pulled in by the rim radius with
 * rounded lips and corners around it. Depth and shore samples are
 * interpolated across the tile so neighbouring tiles still meet without a
 * seam.
 */
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

    for (const instance of instances) {
        const [x, y, z] = instance.position;
        const localY = instance.waterHeight / 2;
        const sides = waterRimSidesFromFlags(instance.rimEdges);
        const foamSides = waterRimSidesFromFlags(instance.foamEdges);
        const quads = createWaterRimTopQuads({
            corners: waterRimCornersFromFlags(instance.rimCorners),
            sides: [
                sides[0] && foamSides[0],
                sides[1] && foamSides[1],
                sides[2] && foamSides[2],
                sides[3] && foamSides[3],
            ],
            topY: localY,
        });
        const bankEdges = bankFlags(instance.foamEdges, instance.rimEdges);
        const bankCorners = bankFlags(
            instance.foamCorners,
            instance.rimCorners,
        );
        const shoreSamples = instance.shoreDepthSamples ?? [
            instance.shoreDepth,
            instance.shoreDepth,
            instance.shoreDepth,
            instance.shoreDepth,
        ];

        for (const quad of quads) {
            const vertexOffset = positions.length / 3;
            const quadPositions = quad.map((vertex) => vertex.position);
            const quadNormals = quad.map((vertex) => vertex.normal);

            for (const vertex of quad) {
                const [localX, vertexY, localZ] = vertex.position;
                positions.push(x + localX, y + vertexY, z + localZ);
                normals.push(...vertex.normal);
                localPositions.push(localX, vertexY, localZ);
                foamEdges.push(...bankEdges);
                foamCorners.push(...bankCorners);
                depths.push(
                    sampleWaterTileCorners(
                        instance.depthSamples,
                        localX,
                        localZ,
                    ),
                );
                shoreDepths.push(
                    sampleWaterTileCorners(shoreSamples, localX, localZ),
                );
                surfaceYs.push(instance.surfaceY);
            }

            for (const triangle of waterRimQuadTriangles(
                quadPositions,
                quadNormals,
            )) {
                indices.push(
                    ...triangle.map((corner) => vertexOffset + corner),
                );
            }
        }
    }

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
    geometry.setIndex(
        positions.length / 3 > 65535
            ? new Uint32BufferAttribute(indices, 1)
            : new Uint16BufferAttribute(indices, 1),
    );
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
}
