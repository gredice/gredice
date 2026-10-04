import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { Vector3 } from 'three';
import { createAutumnLeafClusterGeometry } from '../../scene/autumnLeafClusterGeometry';
import {
    type AutumnLeafSurface,
    type AutumnPartLeafSurface,
    autumnLeafSurfaces,
    autumnPartLeafSurfaces,
} from './autumnLeafSurfaces';

type GltfAccessor = {
    bufferView: number;
    byteOffset?: number;
    componentType: number;
    count: number;
    type: 'SCALAR' | 'VEC3';
};
type Gltf = {
    accessors: GltfAccessor[];
    bufferViews: { byteOffset?: number; byteStride?: number }[];
    meshes: {
        primitives: { attributes: { POSITION: number }; indices: number }[];
    }[];
    nodes: { name: string; mesh?: number }[];
};
type Triangle = [Vector3, Vector3, Vector3];

function exportedTriangles(
    asset: string,
    nodeName: string,
    scale = new Vector3(1, 1, 1),
) {
    const file = readFileSync(
        resolve(
            process.cwd(),
            '../../apps/garden/public/assets/models',
            `${asset}.glb`,
        ),
    );
    assert.equal(file.toString('utf8', 0, 4), 'glTF');
    let offset = 12;
    let gltf: Gltf | undefined;
    let binary: Buffer | undefined;
    while (offset < file.length) {
        const length = file.readUInt32LE(offset);
        const kind = file.readUInt32LE(offset + 4);
        const data = file.subarray(offset + 8, offset + 8 + length);
        if (kind === 0x4e4f534a) gltf = JSON.parse(data.toString('utf8'));
        if (kind === 0x004e4942) binary = data;
        offset += 8 + length;
    }
    assert(gltf && binary);
    const data = binary;
    const document = gltf;
    const read = (index: number) => {
        const accessor = document.accessors[index];
        const view = document.bufferViews[accessor.bufferView];
        const size = accessor.type === 'VEC3' ? 3 : 1;
        const width =
            accessor.componentType === 5126 || accessor.componentType === 5125
                ? 4
                : 2;
        const stride = view.byteStride ?? size * width;
        const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
        return Array.from({ length: accessor.count }, (_, i) =>
            Array.from({ length: size }, (_, j) => {
                const at = start + i * stride + j * width;
                if (accessor.componentType === 5126)
                    return data.readFloatLE(at);
                if (accessor.componentType === 5125)
                    return data.readUInt32LE(at);
                return data.readUInt16LE(at);
            }),
        );
    };
    const node = document.nodes.find((entry) => entry.name === nodeName);
    assert(node?.mesh !== undefined, `${asset}:${nodeName}`);
    const triangles: Triangle[] = [];
    for (const primitive of document.meshes[node.mesh].primitives) {
        const positions = read(primitive.attributes.POSITION).map(([x, y, z]) =>
            new Vector3(x, y, z).multiply(scale),
        );
        const indices = read(primitive.indices).map(([index]) => index);
        for (let i = 0; i < indices.length; i += 3)
            triangles.push([
                positions[indices[i]],
                positions[indices[i + 1]],
                positions[indices[i + 2]],
            ]);
    }
    return triangles;
}

function upwardFaceAt(x: number, z: number, triangles: Triangle[]) {
    let highest: number | null = null;
    for (const [a, b, c] of triangles) {
        const ux = b.x - a.x;
        const uz = b.z - a.z;
        const vx = c.x - a.x;
        const vz = c.z - a.z;
        const det = ux * vz - uz * vx;
        if (Math.abs(det) < 1e-9) continue;
        const normal = new Vector3()
            .subVectors(b, a)
            .cross(new Vector3().subVectors(c, a));
        if (Math.abs(normal.y) / normal.length() < 0.7) continue;
        const dx = x - a.x;
        const dz = z - a.z;
        const u = (dx * vz - dz * vx) / det;
        const v = (ux * dz - uz * dx) / det;
        if (u < -1e-5 || v < -1e-5 || u + v > 1.00001) continue;
        const height = a.y + u * (b.y - a.y) + v * (c.y - a.y);
        highest = Math.max(highest ?? -Infinity, height);
    }
    return highest;
}

function assertFootprint(
    asset: string,
    node: string,
    surface: AutumnLeafSurface | AutumnPartLeafSurface,
    triangles: Triangle[],
) {
    for (const variant of [0, 1]) {
        const geometry = createAutumnLeafClusterGeometry(
            surface.gradientX ?? 0,
            surface.gradientZ ?? 0,
            variant,
        );
        const positions = geometry.attributes.position;
        for (let index = 0; index < positions.count; index++) {
            const vertex = new Vector3()
                .fromBufferAttribute(positions, index)
                .multiplyScalar(
                    'scale' in surface ? (surface.scale ?? 0.45) : 0.45,
                )
                .add(new Vector3(...surface.position))
                .add(new Vector3(0, 0.006, 0));
            const faceY = upwardFaceAt(vertex.x, vertex.z, triangles);
            assert(
                faceY !== null,
                `${asset}:${node}:${surface.id}:${variant} footprint ${index}`,
            );
            assert(
                vertex.y >= faceY - 0.007,
                `${asset}:${node}:${surface.id}:${variant} sinks`,
            );
            assert(
                vertex.y <= faceY + 0.05,
                `${asset}:${node}:${surface.id}:${variant} floats`,
            );
        }
        geometry.dispose();
    }
}

test('both cluster variants fit the exported exposed bench, table, closed-lid and large-stone faces', () => {
    for (const node of [
        'WoodenBench_SeatSlatFront',
        'WoodenBench_SeatSlatCenter',
        'WoodenBench_SeatSlatBack',
    ]) {
        const triangles = exportedTriangles('WoodenBench', node);
        for (const surface of autumnPartLeafSurfaces[node])
            assertFootprint('WoodenBench', node, surface, triangles);
    }
    for (const [asset, node] of [
        ['OutletDisplayTable', 'OutletDisplayTable_TopPlanks'],
        ['GardenBox', 'GardenBox_Lid_HingeOrigin'],
        ['FenceGate', 'FenceGate_Posts'],
        ['StoneFenceGate', 'StoneFenceGate_Posts'],
        ['PolishedStoneFenceGate', 'PolishedStoneFenceGate_Posts'],
    ]) {
        const triangles = exportedTriangles(asset, node);
        const runtimeName =
            node === 'StoneFenceGate_Posts'
                ? 'StoneFenceGate_Posts_Mesh'
                : node;
        for (const surface of autumnPartLeafSurfaces[runtimeName])
            assertFootprint(asset, node, surface, triangles);
    }
    const stone = exportedTriangles(
        'StoneLarge',
        'Stone Large',
        new Vector3(0.263, 0.426, 0.291),
    );
    for (const surface of autumnLeafSurfaces.StoneLarge)
        assertFootprint('StoneLarge', 'Stone Large', surface, stone);
});
