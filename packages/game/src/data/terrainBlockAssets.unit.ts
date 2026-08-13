import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    allGameAssetNames,
    gameAssetModels,
    groundGameAssetNames,
} from './gameAssetModels.generated';

const stoneMaterials = [
    'Material.BlockStone.Large',
    'Material.BlockStone.Mid',
    'Material.BlockStone.Dark',
];
const gravelMaterials = [
    'Material.BlockGravel.Base',
    'Material.BlockGravel.PiecesLight',
    'Material.BlockGravel.PiecesDark',
];
const polishedStoneMaterials = ['Material.BlockPolishedStone.Surface'];
const assetSpecs = [
    {
        materials: stoneMaterials,
        name: 'BlockStone',
        objects: ['Block_Stone_Large', 'Block_Stone_Mid', 'Block_Stone_Dark'],
        zBounds: [-0.5, 0.5],
    },
    {
        materials: stoneMaterials,
        name: 'BlockStoneAngle',
        objects: [
            'Block_Stone_Angle_Large',
            'Block_Stone_Angle_Mid',
            'Block_Stone_Angle_Dark',
        ],
        zBounds: [-0.5, 0.5],
    },
    {
        materials: gravelMaterials,
        name: 'BlockGravel',
        objects: [
            'Block_Gravel_Base',
            'Block_Gravel_Pieces_Light',
            'Block_Gravel_Pieces_Dark',
        ],
        zBounds: [-0.5, 0.5],
    },
    {
        materials: gravelMaterials,
        name: 'BlockGravelAngle',
        objects: [
            'Block_Gravel_Angle_Base',
            'Block_Gravel_Angle_Pieces_Light',
            'Block_Gravel_Angle_Pieces_Dark',
        ],
        zBounds: [-0.5, 0.5],
    },
    {
        materials: stoneMaterials,
        name: 'BlockStoneStairs',
        objects: [
            'Block_Stone_Stairs_Large',
            'Block_Stone_Stairs_Mid',
            'Block_Stone_Stairs_Dark',
        ],
        zBounds: [-0.5, 0.5],
    },
    {
        materials: stoneMaterials,
        name: 'BlockStoneStairsCorner',
        objects: [
            'Block_Stone_Stairs_Corner_Large',
            'Block_Stone_Stairs_Corner_Mid',
            'Block_Stone_Stairs_Corner_Dark',
        ],
        zBounds: [-0.5, 0.5],
    },
    {
        materials: polishedStoneMaterials,
        name: 'BlockPolishedStone',
        objects: ['Block_Polished_Stone'],
        zBounds: [-0.5, 0.5],
    },
    {
        materials: polishedStoneMaterials,
        name: 'BlockPolishedStoneAngle',
        objects: ['Block_Polished_Stone_Angle'],
        zBounds: [-0.5, 0.5],
    },
    {
        materials: polishedStoneMaterials,
        name: 'BlockPolishedStoneStairs',
        objects: ['Block_Polished_Stone_Stairs'],
        zBounds: [-0.5, 0.5],
    },
    {
        materials: polishedStoneMaterials,
        name: 'BlockPolishedStoneStairsCorner',
        objects: ['Block_Polished_Stone_Stairs_Corner'],
        zBounds: [-0.5, 0.5],
    },
] as const;

const manifestPath = fileURLToPath(
    new URL('../../../../assets/game-assets.json', import.meta.url),
);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isNumberArray(value: unknown): value is number[] {
    return (
        Array.isArray(value) && value.every((item) => typeof item === 'number')
    );
}

function getModelPath(assetName: string) {
    return fileURLToPath(
        new URL(
            `../../../../apps/garden/public/assets/models/${assetName}.glb`,
            import.meta.url,
        ),
    );
}

function readGlbDocument(model: Buffer): Record<string, unknown> {
    assert.equal(model.subarray(0, 4).toString('ascii'), 'glTF');
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return document;
}

function getPositionAccessors(document: Record<string, unknown>) {
    const nodes = document.nodes;
    const meshes = document.meshes;
    const accessors = document.accessors;
    assert.ok(Array.isArray(nodes));
    assert.ok(Array.isArray(meshes));
    assert.ok(Array.isArray(accessors));

    return nodes.flatMap((node) => {
        assert.ok(isRecord(node));
        if (node.mesh === undefined) {
            return [];
        }

        assert.ok(typeof node.mesh === 'number');
        const mesh = meshes[node.mesh];
        assert.ok(isRecord(mesh));
        assert.ok(Array.isArray(mesh.primitives));
        assert.equal(mesh.primitives.length, 1);
        const primitive = mesh.primitives[0];
        assert.ok(isRecord(primitive));
        assert.ok(isRecord(primitive.attributes));
        const positionIndex = primitive.attributes.POSITION;
        assert.ok(typeof positionIndex === 'number');
        const accessor = accessors[positionIndex];
        assert.ok(isRecord(accessor));
        assert.ok(isNumberArray(accessor.min));
        assert.ok(isNumberArray(accessor.max));
        assert.ok(typeof accessor.count === 'number');
        assert.ok(typeof node.name === 'string');

        return [
            {
                count: accessor.count,
                maximum: accessor.max,
                minimum: accessor.min,
                nodeName: node.name,
            },
        ];
    });
}

function getPositionVertices(
    model: Buffer,
    document: Record<string, unknown>,
    nodeName: string,
) {
    const nodes = document.nodes;
    const meshes = document.meshes;
    const accessors = document.accessors;
    const bufferViews = document.bufferViews;
    assert.ok(Array.isArray(nodes));
    assert.ok(Array.isArray(meshes));
    assert.ok(Array.isArray(accessors));
    assert.ok(Array.isArray(bufferViews));

    const node = nodes.find(
        (candidate) => isRecord(candidate) && candidate.name === nodeName,
    );
    assert.ok(isRecord(node));
    assert.ok(typeof node.mesh === 'number');
    const mesh = meshes[node.mesh];
    assert.ok(isRecord(mesh));
    assert.ok(Array.isArray(mesh.primitives));
    const primitive = mesh.primitives[0];
    assert.ok(isRecord(primitive));
    assert.ok(isRecord(primitive.attributes));
    const positionIndex = primitive.attributes.POSITION;
    assert.ok(typeof positionIndex === 'number');
    const accessor = accessors[positionIndex];
    assert.ok(isRecord(accessor));
    assert.equal(accessor.componentType, 5126);
    assert.equal(accessor.type, 'VEC3');
    assert.ok(typeof accessor.count === 'number');
    assert.ok(typeof accessor.bufferView === 'number');
    const bufferView = bufferViews[accessor.bufferView];
    assert.ok(isRecord(bufferView));
    assert.ok(
        bufferView.byteOffset === undefined ||
            typeof bufferView.byteOffset === 'number',
    );
    assert.ok(
        bufferView.byteStride === undefined ||
            typeof bufferView.byteStride === 'number',
    );
    assert.ok(
        accessor.byteOffset === undefined ||
            typeof accessor.byteOffset === 'number',
    );

    const jsonLength = model.readUInt32LE(12);
    const binaryChunkHeader = 20 + jsonLength;
    assert.equal(
        model.subarray(binaryChunkHeader + 4, binaryChunkHeader + 8).toString(),
        'BIN\0',
    );
    const binaryStart = binaryChunkHeader + 8;
    const baseOffset =
        binaryStart + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const byteStride = bufferView.byteStride ?? 12;

    return Array.from({ length: accessor.count }, (_, index) => {
        const offset = baseOffset + index * byteStride;
        return [
            model.readFloatLE(offset),
            model.readFloatLE(offset + 4),
            model.readFloatLE(offset + 8),
        ] as const;
    });
}

function sortedNames(value: unknown) {
    assert.ok(Array.isArray(value));
    return value
        .map((item) => {
            assert.ok(isRecord(item));
            assert.ok(typeof item.name === 'string');
            return item.name;
        })
        .toSorted();
}

function getMaterialColors(document: Record<string, unknown>) {
    assert.ok(Array.isArray(document.materials));
    return document.materials.map((material) => {
        assert.ok(isRecord(material));
        assert.ok(isRecord(material.pbrMetallicRoughness));
        const color = material.pbrMetallicRoughness.baseColorFactor;
        assert.ok(isNumberArray(color));
        return color.slice(0, 3);
    });
}

function assertClose(actual: number, expected: number) {
    assert.ok(
        Math.abs(actual - expected) <= 0.000_01,
        `Expected ${actual} to be within 0.00001 of ${expected}`,
    );
}

describe('terrain block Blender assets', () => {
    const manifestDocument: unknown = JSON.parse(
        readFileSync(manifestPath, 'utf8'),
    );
    assert.ok(isRecord(manifestDocument));
    const manifestAssets = manifestDocument.assets;
    assert.ok(Array.isArray(manifestAssets));

    it('does not register or preload the obsolete half-stair model', () => {
        assert.equal(
            manifestAssets.some(
                (asset) =>
                    isRecord(asset) && asset.name === 'BlockStoneStairsHalf',
            ),
            false,
        );
        assert.equal(
            Object.hasOwn(gameAssetModels, 'BlockStoneStairsHalf'),
            false,
        );
        assert.equal(
            groundGameAssetNames.map(String).includes('BlockStoneStairsHalf'),
            false,
        );
        assert.equal(
            allGameAssetNames.map(String).includes('BlockStoneStairsHalf'),
            false,
        );
    });

    for (const spec of assetSpecs) {
        it(`${spec.name} matches its manifest and ground preload contract`, () => {
            const model = readFileSync(getModelPath(spec.name));
            const version = createHash('sha256')
                .update(model)
                .digest('hex')
                .slice(0, 12);
            const document = readGlbDocument(model);
            const asset = manifestAssets.find(
                (candidate) =>
                    isRecord(candidate) && candidate.name === spec.name,
            );

            assert.ok(isRecord(asset));
            assert.equal(asset.source, `${spec.name}.blend`);
            assert.equal(asset.output, `${spec.name}.glb`);
            assert.equal(asset.preload, 'ground');
            assert.equal(asset.version, version);
            assert.deepEqual(asset.objects, spec.objects);
            assert.deepEqual(
                sortedNames(document.nodes),
                [...spec.objects].toSorted(),
            );
            assert.deepEqual(
                sortedNames(document.materials),
                [...spec.materials].toSorted(),
            );
            assert.equal(
                gameAssetModels[spec.name].url,
                `/assets/models/${spec.name}.glb?v=${version}`,
            );
            assert.ok(groundGameAssetNames.includes(spec.name));
            assert.ok(allGameAssetNames.includes(spec.name));
        });

        it(`${spec.name} stays grounded in its exact tile footprint`, () => {
            const document = readGlbDocument(
                readFileSync(getModelPath(spec.name)),
            );
            const accessors = getPositionAccessors(document);
            const minimum = [0, 1, 2].map((axis) =>
                Math.min(
                    ...accessors.map((accessor) => accessor.minimum[axis]),
                ),
            );
            const maximum = [0, 1, 2].map((axis) =>
                Math.max(
                    ...accessors.map((accessor) => accessor.maximum[axis]),
                ),
            );
            const vertexCount = accessors.reduce(
                (total, accessor) => total + accessor.count,
                0,
            );

            assertClose(minimum[0], -0.5);
            assertClose(maximum[0], 0.5);
            assertClose(minimum[1], 0);
            assertClose(maximum[1], 0.4);
            assertClose(minimum[2], spec.zBounds[0]);
            assertClose(maximum[2], spec.zBounds[1]);
            assert.ok(vertexCount <= 1_000);
        });
    }

    it('keeps gravel warm-neutral with distinct light and dark pieces', () => {
        for (const name of ['BlockGravel', 'BlockGravelAngle'] as const) {
            const document = readGlbDocument(readFileSync(getModelPath(name)));
            const accessors = getPositionAccessors(document);
            const base = accessors.find(({ nodeName }) =>
                nodeName.endsWith('_Base'),
            );
            const pieces = accessors.filter(({ nodeName }) =>
                nodeName.includes('_Pieces_'),
            );

            assert.ok(base);
            assert.equal(pieces.length, 2);
            assert.ok(
                pieces.every(({ count }) => count > base.count),
                'Gravel pieces must remain separately modeled geometry',
            );
            for (const color of getMaterialColors(document)) {
                assert.ok(color[0] > color[1]);
                assert.ok(color[1] > color[2]);
                assert.ok(Math.max(...color) - Math.min(...color) <= 0.12);
            }
        }
    });

    it('keeps gravel tile walls and top perimeters perfectly unbeveled', () => {
        for (const [name, nodeName] of [
            ['BlockGravel', 'Block_Gravel_Base'],
            ['BlockGravelAngle', 'Block_Gravel_Angle_Base'],
        ] as const) {
            const model = readFileSync(getModelPath(name));
            const document = readGlbDocument(model);
            const vertices = getPositionVertices(model, document, nodeName);

            // A beveled shell previously exported 96 base vertices. The exact
            // box/wedge perimeter uses only its original 24/18 face vertices.
            assert.equal(vertices.length, name === 'BlockGravel' ? 24 : 18);
            assert.ok(
                vertices.every(
                    ([x, , z]) =>
                        Math.abs(Math.abs(x) - 0.5) <= 0.000_01 &&
                        Math.abs(Math.abs(z) - 0.5) <= 0.000_01,
                ),
                `${name} must not inset any outer perimeter vertex`,
            );

            const negativeZEdge = vertices
                .filter(([, , z]) => Math.abs(z + 0.5) <= 0.000_01)
                .map(([x, y]) => `${x.toFixed(5)}:${y.toFixed(5)}`)
                .toSorted();
            const positiveZEdge = vertices
                .filter(([, , z]) => Math.abs(z - 0.5) <= 0.000_01)
                .map(([x, y]) => `${x.toFixed(5)}:${y.toFixed(5)}`)
                .toSorted();
            assert.deepEqual(
                negativeZEdge,
                positiveZEdge,
                `${name} neighboring side profiles must join without a gap`,
            );
        }
    });

    it('uses two X-running stair levels on the straight stone stairs', () => {
        const accessors = getPositionAccessors(
            readGlbDocument(readFileSync(getModelPath('BlockStoneStairs'))),
        );
        const treadLevels = accessors
            .map(({ maximum }) => Number(maximum[1].toFixed(3)))
            .filter((height, index, values) => values.indexOf(height) === index)
            .toSorted();
        const middleTread = accessors.find(
            ({ maximum, minimum }) =>
                Math.abs(minimum[0] + 0.5) <= 0.000_01 &&
                Math.abs(maximum[0]) <= 0.000_01 &&
                Math.abs(maximum[1] - 0.2) <= 0.000_01,
        );
        const topTread = accessors.find(
            ({ maximum, minimum }) =>
                Math.abs(minimum[0]) <= 0.000_01 &&
                Math.abs(maximum[0] - 0.5) <= 0.000_01 &&
                Math.abs(maximum[1] - 0.4) <= 0.000_01,
        );

        assert.deepEqual(treadLevels, [0.2, 0.4]);
        assert.ok(middleTread);
        assert.ok(topTread);
    });

    it('makes both corner stairs full-tile L stairs with the top at +X/-Z', () => {
        for (const [name, nodeName] of [
            ['BlockStoneStairsCorner', 'Block_Stone_Stairs_Corner_Large'],
            [
                'BlockPolishedStoneStairsCorner',
                'Block_Polished_Stone_Stairs_Corner',
            ],
        ] as const) {
            const model = readFileSync(getModelPath(name));
            const document = readGlbDocument(model);
            const allAccessors = getPositionAccessors(document);
            const vertices = getPositionVertices(model, document, nodeName);
            const topVertices = vertices.filter(
                ([, y]) => Math.abs(y - 0.4) <= 0.000_01,
            );

            assertClose(
                Math.min(...allAccessors.map(({ minimum }) => minimum[0])),
                -0.5,
            );
            assertClose(
                Math.max(...allAccessors.map(({ maximum }) => maximum[0])),
                0.5,
            );
            assertClose(
                Math.min(...allAccessors.map(({ minimum }) => minimum[2])),
                -0.5,
            );
            assertClose(
                Math.max(...allAccessors.map(({ maximum }) => maximum[2])),
                0.5,
            );
            assert.ok(topVertices.length > 0);
            assert.ok(
                topVertices.every(
                    ([x, , z]) => x >= -0.000_01 && z <= 0.000_01,
                ),
                `${name} top tread must occupy runtime +X/-Z`,
            );
        }
    });

    it('exports every polished stone variation as one-piece geometry', () => {
        for (const name of [
            'BlockPolishedStone',
            'BlockPolishedStoneAngle',
            'BlockPolishedStoneStairs',
            'BlockPolishedStoneStairsCorner',
        ] as const) {
            const document = readGlbDocument(readFileSync(getModelPath(name)));
            assert.equal(getPositionAccessors(document).length, 1);
            assert.equal(getMaterialColors(document).length, 1);
        }
    });
});
