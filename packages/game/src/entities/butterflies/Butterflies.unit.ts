import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Box3, Matrix4, Quaternion, Vector3 } from 'three';
import type { Stack } from '../../types/Stack';
import {
    type AnimalFlightObstacle,
    isAnimalFlightSegmentClear,
} from '../animals/animalFlightSafety';
import type { PollinatorFlowerTarget } from '../pollinators/flowerTargets';
import {
    butterflyActorScale,
    createApproachState,
    createButterflyHabitats,
    createMeanderState,
    createTakeoffState,
} from './Butterflies';

type JsonRecord = Record<string, unknown>;

const butterflyModelPath = fileURLToPath(
    new URL(
        '../../../../../apps/garden/public/assets/models/Butterfly.glb',
        import.meta.url,
    ),
);
const legacyButterflyActorScale = 0.31;
const legacyButterflyModelSize = new Vector3(
    1.7200000286102295,
    0.43817607401032627,
    1.3797724739243153,
);

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null;
}

function records(value: unknown, label: string) {
    assert.ok(Array.isArray(value), `${label} must be an array`);
    return value.map((item, index) => {
        assert.ok(isRecord(item), `${label}[${index}] must be an object`);
        return item;
    });
}

function numeric(value: unknown, label: string) {
    assert.equal(typeof value, 'number', `${label} must be numeric`);
    return value as number;
}

function numericArray(value: unknown, label: string, length: number) {
    assert.ok(Array.isArray(value), `${label} must be an array`);
    assert.equal(value.length, length, `${label} must have ${length} channels`);
    return value.map((channel, index) =>
        numeric(channel, `${label}[${index}]`),
    );
}

function localNodeMatrix(node: JsonRecord, label: string) {
    if (node.matrix !== undefined) {
        return new Matrix4().fromArray(
            numericArray(node.matrix, `${label}.matrix`, 16),
        );
    }
    const translation =
        node.translation === undefined
            ? [0, 0, 0]
            : numericArray(node.translation, `${label}.translation`, 3);
    const rotation =
        node.rotation === undefined
            ? [0, 0, 0, 1]
            : numericArray(node.rotation, `${label}.rotation`, 4);
    const scale =
        node.scale === undefined
            ? [1, 1, 1]
            : numericArray(node.scale, `${label}.scale`, 3);
    return new Matrix4().compose(
        new Vector3(translation[0], translation[1], translation[2]),
        new Quaternion(rotation[0], rotation[1], rotation[2], rotation[3]),
        new Vector3(scale[0], scale[1], scale[2]),
    );
}

function readButterflyModelBounds() {
    const model = readFileSync(butterflyModelPath);
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    const binaryChunkHeader = 20 + jsonLength;
    const binaryLength = model.readUInt32LE(binaryChunkHeader);
    const binaryStart = binaryChunkHeader + 8;
    const binary = model.subarray(binaryStart, binaryStart + binaryLength);
    const nodes = records(document.nodes, 'nodes');
    const meshes = records(document.meshes, 'meshes');
    const accessors = records(document.accessors, 'accessors');
    const bufferViews = records(document.bufferViews, 'bufferViews');
    const parents = new Map<number, number>();
    for (const [parentIndex, node] of nodes.entries()) {
        if (!Array.isArray(node.children)) continue;
        for (const child of node.children) {
            parents.set(
                numeric(child, `nodes[${parentIndex}].child`),
                parentIndex,
            );
        }
    }

    const worldMatrices = new Map<number, Matrix4>();
    const worldMatrix = (nodeIndex: number): Matrix4 => {
        const existing = worldMatrices.get(nodeIndex);
        if (existing) return existing;
        const node = nodes[nodeIndex];
        assert.ok(node, `Missing node ${nodeIndex}`);
        const local = localNodeMatrix(node, `nodes[${nodeIndex}]`);
        const parentIndex = parents.get(nodeIndex);
        const world =
            parentIndex === undefined
                ? local
                : worldMatrix(parentIndex).clone().multiply(local);
        worldMatrices.set(nodeIndex, world);
        return world;
    };

    const bounds = new Box3();
    for (const [nodeIndex, node] of nodes.entries()) {
        if (typeof node.mesh !== 'number') continue;
        const mesh = meshes[node.mesh];
        assert.ok(mesh, `Missing mesh ${node.mesh}`);
        for (const primitive of records(
            mesh.primitives,
            `meshes[${node.mesh}].primitives`,
        )) {
            assert.ok(isRecord(primitive.attributes));
            const accessorIndex = numeric(
                primitive.attributes.POSITION,
                'POSITION accessor',
            );
            const accessor = accessors[accessorIndex];
            assert.ok(accessor, `Missing accessor ${accessorIndex}`);
            assert.equal(accessor.componentType, 5126);
            assert.equal(accessor.type, 'VEC3');
            const count = numeric(accessor.count, 'accessor.count');
            const bufferViewIndex = numeric(
                accessor.bufferView,
                'accessor.bufferView',
            );
            const bufferView = bufferViews[bufferViewIndex];
            assert.ok(bufferView, `Missing buffer view ${bufferViewIndex}`);
            const viewOffset =
                bufferView.byteOffset === undefined
                    ? 0
                    : numeric(bufferView.byteOffset, 'bufferView.byteOffset');
            const accessorOffset =
                accessor.byteOffset === undefined
                    ? 0
                    : numeric(accessor.byteOffset, 'accessor.byteOffset');
            const stride =
                bufferView.byteStride === undefined
                    ? 12
                    : numeric(bufferView.byteStride, 'bufferView.byteStride');
            for (let vertexIndex = 0; vertexIndex < count; vertexIndex += 1) {
                const offset =
                    viewOffset + accessorOffset + vertexIndex * stride;
                bounds.expandByPoint(
                    new Vector3(
                        binary.readFloatLE(offset),
                        binary.readFloatLE(offset + 4),
                        binary.readFloatLE(offset + 8),
                    ).applyMatrix4(worldMatrix(nodeIndex)),
                );
            }
        }
    }
    assert.equal(bounds.isEmpty(), false);
    return bounds;
}

function stackWithBlocks(
    x: number,
    z: number,
    blocks: Array<{ id: string; name: string }>,
): Stack {
    return {
        blocks: blocks.map((block) => ({ ...block, rotation: 0 })),
        position: new Vector3(x, 0, z),
    };
}

test('creates butterfly habitat only for flowers with valid ground support', () => {
    const supportedFlower = stackWithBlocks(0, 0, [
        { id: 'grass', name: 'Block_Grass' },
        { id: 'tulip', name: 'Tulip' },
    ]);
    const unsupportedFlower = stackWithBlocks(3, 0, [
        { id: 'unsupported-tulip', name: 'Tulip' },
    ]);

    const habitats = createButterflyHabitats({
        blockData: undefined,
        garden: {
            id: 14,
            raisedBeds: [],
            stacks: [supportedFlower, unsupportedFlower],
        },
        groundDecorationDensity: 0,
    });

    assert.equal(habitats.length, 1);
    assert.ok(habitats[0]?.targets.length);
    assert.ok(
        habitats[0]?.targets.every((target) =>
            target.blockIds?.includes('tulip'),
        ),
    );
});

test('does not create a butterfly habitat without flowers', () => {
    const habitats = createButterflyHabitats({
        blockData: undefined,
        garden: {
            id: 14,
            raisedBeds: [],
            stacks: [
                stackWithBlocks(0, 0, [
                    { id: 'grass', name: 'Block_Grass' },
                    { id: 'tree', name: 'Tree' },
                ]),
            ],
        },
        groundDecorationDensity: 0,
    });

    assert.deepEqual(habitats, []);
});

test('versions a habitat when an existing flower moves', () => {
    const gardenAt = (x: number) => ({
        id: 14,
        raisedBeds: [],
        stacks: [
            stackWithBlocks(x, 0, [
                { id: 'grass', name: 'Block_Grass' },
                { id: 'tulip', name: 'Tulip' },
            ]),
        ],
    });
    const original = createButterflyHabitats({
        blockData: undefined,
        garden: gardenAt(0),
        groundDecorationDensity: 0,
    });
    const moved = createButterflyHabitats({
        blockData: undefined,
        garden: gardenAt(2),
        groundDecorationDensity: 0,
    });

    assert.equal(original.length, 1);
    assert.equal(moved.length, 1);
    assert.notEqual(original[0]?.id, moved[0]?.id);
});

test('keeps approach, initial meander, and takeoff routable through the active flower host', () => {
    const target = {
        blockIds: ['tulip'],
        id: 'tulip-target',
        kind: 'flower',
        position: new Vector3(0, 0.52, 0),
    } satisfies PollinatorFlowerTarget;
    const obstacles = [
        {
            blockIds: ['grass', 'tulip'],
            topY: 1,
            x: 0,
            z: 0,
        },
    ] satisfies AnimalFlightObstacle[];
    const now = 4;

    assert.ok(
        createApproachState({
            from: new Vector3(0.35, 1.07, 0.35),
            now,
            obstacles,
            target,
        }),
    );
    assert.ok(
        createTakeoffState({
            from: new Vector3(0, 0.555, 0),
            now,
            obstacles,
            target,
        }),
    );

    const meanderInput = {
        from: new Vector3(0, 0.9, 0),
        habitat: {
            center: new Vector3(0, 0, 0),
            id: 'host-habitat',
            seed: 1,
            targets: [target],
        },
        now,
        obstacles,
        random: () => 0,
    };
    const meander = createMeanderState(meanderInput);
    assert.ok(meander);
    assert.ok(
        Math.hypot(
            meander.to.x - target.position.x,
            meander.to.z - target.position.z,
        ) <= 1.4,
    );
});

test('meanders ignore only their selected flower host', () => {
    const target = {
        blockIds: ['active-flower'],
        id: 'active-target',
        kind: 'flower',
        position: new Vector3(0, 0.52, 0),
    } satisfies PollinatorFlowerTarget;
    const obstacles = [
        {
            blockIds: ['active-flower'],
            topY: 1,
            x: 0,
            z: 0,
        },
        {
            blockIds: ['unrelated-tree'],
            topY: 2,
            x: -1,
            z: 0,
        },
    ] satisfies AnimalFlightObstacle[];
    const randomValues = [0, 1, 0];
    const meander = createMeanderState({
        anchor: target,
        from: new Vector3(-2, 0.9, 0),
        habitat: {
            center: new Vector3(0, 0, 0),
            id: 'selected-host-habitat',
            seed: 1,
            targets: [target],
        },
        now: 4,
        obstacles,
        random: () => randomValues.shift() ?? 0,
    });

    assert.ok(meander);
    assert.ok(meander.waypoints.length >= 2);
    let cursor = new Vector3(-2, 0.9, 0);
    for (const waypoint of meander.waypoints) {
        assert.equal(
            isAnimalFlightSegmentClear({
                from: cursor,
                ignoredBlockIds: new Set(target.blockIds),
                obstacles,
                to: waypoint,
            }),
            true,
        );
        cursor = waypoint;
    }
});

test('renders the remodeled butterfly silhouette at 40 percent of the legacy bounds', () => {
    const remodeledModelSize = readButterflyModelBounds().getSize(
        new Vector3(),
    );
    const legacyWorldSize = legacyButterflyModelSize
        .clone()
        .multiplyScalar(legacyButterflyActorScale);
    const remodeledWorldSize = remodeledModelSize
        .clone()
        .multiplyScalar(butterflyActorScale);
    const axisRatios = [
        remodeledWorldSize.x / legacyWorldSize.x,
        remodeledWorldSize.y / legacyWorldSize.y,
        remodeledWorldSize.z / legacyWorldSize.z,
    ];

    for (const [axis, ratio] of axisRatios.entries()) {
        assert.ok(
            ratio <= 0.4 + 0.000_001,
            `Butterfly axis ${axis} retained ${(ratio * 100).toFixed(2)}% of the legacy silhouette`,
        );
    }
    assert.ok(
        Math.abs(Math.max(...axisRatios) - 0.4) < 0.000_001,
        `Maximum rendered silhouette ratio ${Math.max(...axisRatios)}`,
    );
});
