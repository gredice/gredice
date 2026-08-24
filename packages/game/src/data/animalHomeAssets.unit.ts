import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Box3, Matrix4, Quaternion, Vector3 } from 'three';
import {
    allGameAssetNames,
    gameAssetModels,
    lazyGameAssetNames,
} from './gameAssetModels.generated';

type JsonRecord = Record<string, unknown>;

type HomeName =
    | 'RabbitHutch'
    | 'HorseStable'
    | 'CowShelter'
    | 'GoatShelter'
    | 'SheepFold';

type HomeSpec = {
    name: HomeName;
    objects: readonly string[];
    halfWidth: number;
    frontDepth: number;
    backDepth: number;
    height: number;
    vertexLimit: number;
};

const homeSpecs: readonly HomeSpec[] = [
    {
        name: 'RabbitHutch',
        objects: [
            'RabbitHutch_Oak',
            'RabbitHutch_Walls',
            'RabbitHutch_Roof',
            'RabbitHutch_EntranceRamp',
            'RabbitHutch_Straw',
        ],
        halfWidth: 0.46,
        frontDepth: 0.63,
        backDepth: 0.41,
        height: 0.98,
        vertexLimit: 3_600,
    },
    {
        name: 'HorseStable',
        objects: [
            'HorseStable_Stone',
            'HorseStable_Frame',
            'HorseStable_Walls',
            'HorseStable_Roof',
            'HorseStable_Trough',
            'HorseStable_Straw',
        ],
        halfWidth: 0.95,
        frontDepth: 0.82,
        backDepth: 0.92,
        height: 1.71,
        vertexLimit: 3_700,
    },
    {
        name: 'CowShelter',
        objects: [
            'CowShelter_Stone',
            'CowShelter_Timber',
            'CowShelter_Walls',
            'CowShelter_Roof',
            'CowShelter_Trough',
        ],
        halfWidth: 0.95,
        frontDepth: 0.8,
        backDepth: 0.88,
        height: 1.5,
        vertexLimit: 2_900,
    },
    {
        name: 'GoatShelter',
        objects: [
            'GoatShelter_Stone',
            'GoatShelter_Frame',
            'GoatShelter_Walls',
            'GoatShelter_Roof',
            'GoatShelter_Platform',
        ],
        halfWidth: 0.5,
        frontDepth: 0.51,
        backDepth: 0.5,
        height: 1.01,
        vertexLimit: 2_750,
    },
    {
        name: 'SheepFold',
        objects: [
            'SheepFold_Stone',
            'SheepFold_Wattle',
            'SheepFold_ShelterFrame',
            'SheepFold_Roof',
            'SheepFold_Straw',
            'SheepFold_Gate',
        ],
        halfWidth: 0.87,
        frontDepth: 0.73,
        backDepth: 0.81,
        height: 1.46,
        vertexLimit: 4_000,
    },
];

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const manifestPath = fileURLToPath(
    new URL('../../../../assets/game-assets.json', import.meta.url),
);
const generatorPath = fileURLToPath(
    new URL(
        '../../../../assets/scripts/generate-animal-homes.py',
        import.meta.url,
    ),
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
    if (typeof value !== 'number') {
        assert.fail(`${label} must be numeric`);
    }
    return value;
}

function numericArray(value: unknown, label: string, length: number) {
    assert.ok(Array.isArray(value), `${label} must be an array`);
    assert.equal(value.length, length, `${label} must have ${length} channels`);
    return value.map((channel, index) =>
        numeric(channel, `${label}[${index}]`),
    );
}

function modelPath(name: HomeName) {
    return fileURLToPath(
        new URL(
            `../../../../apps/garden/public/assets/models/${name}.glb`,
            import.meta.url,
        ),
    );
}

function readModel(name: HomeName) {
    const model = readFileSync(modelPath(name));
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    const binaryChunkHeader = 20 + jsonLength;
    const binaryLength = model.readUInt32LE(binaryChunkHeader);
    const binaryStart = binaryChunkHeader + 8;
    return {
        binary: model.subarray(binaryStart, binaryStart + binaryLength),
        document,
    };
}

function readDocument(name: HomeName) {
    return readModel(name).document;
}

function sortedNames(value: unknown, label: string) {
    return records(value, label)
        .map((item, index) => {
            assert.equal(typeof item.name, 'string', `${label}[${index}].name`);
            return item.name;
        })
        .toSorted();
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

function modelBounds({
    binary,
    document,
}: {
    binary: Buffer;
    document: JsonRecord;
}) {
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

    const box = new Box3();
    let vertexCount = 0;
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
            assert.equal(
                accessor.componentType,
                5126,
                'POSITION must use floats',
            );
            assert.equal(accessor.type, 'VEC3', 'POSITION must use VEC3');
            const count = numeric(accessor.count, 'accessor.count');
            const bufferViewIndex = numeric(
                accessor.bufferView,
                'accessor.bufferView',
            );
            const bufferView = bufferViews[bufferViewIndex];
            assert.ok(bufferView, `Missing bufferView ${bufferViewIndex}`);
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
            vertexCount += count;
            for (let vertexIndex = 0; vertexIndex < count; vertexIndex += 1) {
                const offset =
                    viewOffset + accessorOffset + vertexIndex * stride;
                box.expandByPoint(
                    new Vector3(
                        binary.readFloatLE(offset),
                        binary.readFloatLE(offset + 4),
                        binary.readFloatLE(offset + 8),
                    ).applyMatrix4(worldMatrix(nodeIndex)),
                );
            }
        }
    }
    assert.equal(box.isEmpty(), false);
    return { box, vertexCount };
}

describe('persistent animal home assets', () => {
    const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.ok(isRecord(manifest));
    const assets = records(manifest.assets, 'manifest.assets');

    it('documents one common front direction for all home generators', () => {
        const generator = readFileSync(generatorPath, 'utf8');
        assert.match(
            generator,
            /Every home is base-centered and opens toward Blender \+Y/,
        );
        assert.match(generator, /scene\["front_direction"\] = "Blender \+Y"/);
    });

    for (const spec of homeSpecs) {
        it(`${spec.name} matches its editable source, manifest, and lazy registry`, () => {
            const outputPath = modelPath(spec.name);
            const version = createHash('sha256')
                .update(readFileSync(outputPath))
                .digest('hex')
                .slice(0, 12);
            const document = readDocument(spec.name);
            const asset = assets.find(
                (candidate) => candidate.name === spec.name,
            );

            assert.ok(asset, `Missing ${spec.name} manifest entry`);
            assert.equal(asset.source, `${spec.name}.blend`);
            assert.equal(asset.output, `${spec.name}.glb`);
            assert.equal(asset.preload, 'lazy');
            assert.equal(asset.version, version);
            assert.deepEqual(asset.objects, [...spec.objects]);
            assert.deepEqual(
                sortedNames(document.nodes, `${spec.name}.nodes`),
                [...spec.objects].toSorted(),
            );
            assert.ok(
                existsSync(
                    `${repositoryRoot}assets/game-assets/${spec.name}.blend`,
                ),
            );
            assert.ok(statSync(outputPath).size <= 160_000);
            assert.equal(
                gameAssetModels[spec.name].url,
                `/assets/models/${spec.name}.glb?v=${version}`,
            );
            assert.ok(lazyGameAssetNames.includes(spec.name));
            assert.ok(allGameAssetNames.includes(spec.name));
        });

        it(`${spec.name} is grounded inside its intended footprint`, () => {
            const { box, vertexCount } = modelBounds(readModel(spec.name));

            assert.ok(
                Math.abs(box.min.y) < 0.000_01,
                `${spec.name} min y ${box.min.y}`,
            );
            assert.ok(box.min.x >= -spec.halfWidth);
            assert.ok(box.max.x <= spec.halfWidth);
            assert.ok(box.min.z >= -spec.frontDepth);
            assert.ok(box.max.z <= spec.backDepth);
            assert.ok(box.max.y <= spec.height);
            assert.ok(vertexCount <= spec.vertexLimit);
        });
    }
});
