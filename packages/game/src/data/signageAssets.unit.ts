import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    allGameAssetNames,
    gameAssetModels,
    lazyGameAssetNames,
} from './gameAssetModels.generated';

const assets = [
    {
        expectedHeight: 1.18,
        materialNames: [
            'Material.ArrowSign.WarmWood',
            'Material.ArrowSign.Color',
            'Material.ArrowSign.DeepWood',
        ],
        name: 'ArrowSign',
        objectNames: [
            'ArrowSign_Post',
            'ArrowSign_Arrow',
            'ArrowSign_Fastener',
        ],
        registryModel: gameAssetModels.ArrowSign,
    },
    {
        expectedHeight: 1.16,
        materialNames: [
            'Material.WoodenSign.WarmWood',
            'Material.WoodenSign.BoardWood',
            'Material.WoodenSign.DeepWood',
        ],
        name: 'WoodenSign',
        objectNames: [
            'WoodenSign_Post',
            'WoodenSign_Board',
            'WoodenSign_Frame',
            'WoodenSign_Fasteners',
        ],
        registryModel: gameAssetModels.WoodenSign,
    },
];
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

function readGlbDocument(model: Buffer): unknown {
    const jsonLength = model.readUInt32LE(12);
    return JSON.parse(model.subarray(20, 20 + jsonLength).toString('utf8'));
}

function getModelPath(assetName: string) {
    return fileURLToPath(
        new URL(
            `../../../../apps/garden/public/assets/models/${assetName}.glb`,
            import.meta.url,
        ),
    );
}

function readVector(value: unknown, length: number, fallback: number[]) {
    if (value === undefined) {
        return fallback;
    }

    assert.ok(isNumberArray(value));
    assert.equal(value.length, length);
    return value;
}

function transformPoint(point: number[], node: Record<string, unknown>) {
    if (node.matrix !== undefined) {
        const matrix = readVector(node.matrix, 16, []);
        return [
            matrix[0] * point[0] +
                matrix[4] * point[1] +
                matrix[8] * point[2] +
                matrix[12],
            matrix[1] * point[0] +
                matrix[5] * point[1] +
                matrix[9] * point[2] +
                matrix[13],
            matrix[2] * point[0] +
                matrix[6] * point[1] +
                matrix[10] * point[2] +
                matrix[14],
        ];
    }

    const translation = readVector(node.translation, 3, [0, 0, 0]);
    const scale = readVector(node.scale, 3, [1, 1, 1]);
    const rotation = readVector(node.rotation, 4, [0, 0, 0, 1]);
    const x = point[0] * scale[0];
    const y = point[1] * scale[1];
    const z = point[2] * scale[2];
    const [qx, qy, qz, qw] = rotation;
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;

    return [
        ix * qw + iw * -qx + iy * -qz - iz * -qy + translation[0],
        iy * qw + iw * -qy + iz * -qx - ix * -qz + translation[1],
        iz * qw + iw * -qz + ix * -qy - iy * -qx + translation[2],
    ];
}

function getPositionAccessors(document: Record<string, unknown>) {
    assert.ok(Array.isArray(document.nodes));
    assert.ok(Array.isArray(document.meshes));
    assert.ok(Array.isArray(document.accessors));
    const meshes = document.meshes;
    const accessors = document.accessors;

    return document.nodes.flatMap((node) => {
        assert.ok(isRecord(node));
        if (node.mesh === undefined) {
            return [];
        }

        assert.ok(typeof node.mesh === 'number');
        const mesh = meshes[node.mesh];
        assert.ok(isRecord(mesh));
        assert.ok(Array.isArray(mesh.primitives));

        return mesh.primitives.map((primitive) => {
            assert.ok(isRecord(primitive));
            assert.ok(isRecord(primitive.attributes));
            const positionIndex = primitive.attributes.POSITION;
            assert.ok(typeof positionIndex === 'number');
            const accessor = accessors[positionIndex];
            assert.ok(isRecord(accessor));
            assert.ok(isNumberArray(accessor.min));
            assert.ok(isNumberArray(accessor.max));
            assert.equal(accessor.min.length, 3);
            assert.equal(accessor.max.length, 3);
            assert.ok(typeof accessor.count === 'number');

            const localMinimum = accessor.min;
            const localMaximum = accessor.max;
            const corners = [localMinimum[0], localMaximum[0]].flatMap((x) =>
                [localMinimum[1], localMaximum[1]].flatMap((y) =>
                    [localMinimum[2], localMaximum[2]].map((z) =>
                        transformPoint([x, y, z], node),
                    ),
                ),
            );

            return {
                count: accessor.count,
                localMaximum,
                localMinimum,
                maximum: [0, 1, 2].map((axis) =>
                    Math.max(...corners.map((corner) => corner[axis])),
                ),
                minimum: [0, 1, 2].map((axis) =>
                    Math.min(...corners.map((corner) => corner[axis])),
                ),
                nodeName: node.name,
            };
        });
    });
}

describe('Signage assets', () => {
    for (const asset of assets) {
        describe(asset.name, () => {
            it('exports a lightweight, base-centered model within one tile', () => {
                const document = readGlbDocument(
                    readFileSync(getModelPath(asset.name)),
                );
                assert.ok(isRecord(document));
                const positionAccessors = getPositionAccessors(document);
                const minimum = [0, 1, 2].map((axis) =>
                    Math.min(
                        ...positionAccessors.map(
                            (accessor) => accessor.minimum[axis],
                        ),
                    ),
                );
                const maximum = [0, 1, 2].map((axis) =>
                    Math.max(
                        ...positionAccessors.map(
                            (accessor) => accessor.maximum[axis],
                        ),
                    ),
                );
                const vertexCount = positionAccessors.reduce(
                    (total, accessor) => total + accessor.count,
                    0,
                );

                assert.ok(Math.abs(minimum[1]) < 0.000_01);
                assert.ok(minimum[0] >= -0.5 && maximum[0] <= 0.5);
                assert.ok(minimum[2] >= -0.5 && maximum[2] <= 0.5);
                assert.ok(maximum[0] - minimum[0] <= 1);
                assert.ok(maximum[2] - minimum[2] <= 1);
                assert.ok(Math.abs(maximum[1] - asset.expectedHeight) < 0.005);
                assert.ok(vertexCount <= 1_500);
            });

            it('keeps the intentional node and material roles', () => {
                const document = readGlbDocument(
                    readFileSync(getModelPath(asset.name)),
                );
                assert.ok(isRecord(document));
                assert.ok(Array.isArray(document.nodes));
                assert.ok(Array.isArray(document.meshes));
                assert.ok(Array.isArray(document.materials));

                assert.deepEqual(
                    document.nodes.map((node) => {
                        assert.ok(isRecord(node));
                        return node.name;
                    }),
                    asset.objectNames,
                );
                assert.equal(document.meshes.length, asset.objectNames.length);
                assert.deepEqual(
                    document.materials.map((material) => {
                        assert.ok(isRecord(material));
                        return material.name;
                    }),
                    asset.materialNames,
                );
            });

            it('matches the manifest and generated lazy registry', () => {
                const model = readFileSync(getModelPath(asset.name));
                const version = createHash('sha256')
                    .update(model)
                    .digest('hex')
                    .slice(0, 12);
                const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

                assert.ok(isRecord(manifest));
                assert.ok(Array.isArray(manifest.assets));
                const manifestAsset = manifest.assets.find(
                    (candidate) =>
                        isRecord(candidate) && candidate.name === asset.name,
                );
                assert.ok(isRecord(manifestAsset));
                assert.equal(manifestAsset.source, `${asset.name}.blend`);
                assert.equal(manifestAsset.output, `${asset.name}.glb`);
                assert.equal(manifestAsset.preload, 'lazy');
                assert.equal(manifestAsset.version, version);
                assert.deepEqual(manifestAsset.objects, asset.objectNames);
                assert.equal(
                    asset.registryModel.url,
                    `/assets/models/${asset.name}.glb?v=${version}`,
                );
                assert.ok(
                    lazyGameAssetNames.some((name) => name === asset.name),
                );
                assert.ok(
                    allGameAssetNames.some((name) => name === asset.name),
                );
            });
        });
    }

    it('keeps the arrow plaque pivot at its center for direction rotation', () => {
        const document = readGlbDocument(
            readFileSync(getModelPath('ArrowSign')),
        );
        assert.ok(isRecord(document));
        assert.ok(Array.isArray(document.nodes));
        const plaqueNode = document.nodes.find(
            (node) => isRecord(node) && node.name === 'ArrowSign_Arrow',
        );
        assert.ok(isRecord(plaqueNode));
        const translation = readVector(plaqueNode.translation, 3, [0, 0, 0]);
        assert.ok(Math.abs(translation[0]) < 0.000_01);
        assert.ok(Math.abs(translation[1] - 0.92) < 0.000_01);
        assert.ok(Math.abs(translation[2]) < 0.000_01);

        const plaqueAccessors = getPositionAccessors(document).filter(
            (accessor) => accessor.nodeName === 'ArrowSign_Arrow',
        );
        assert.ok(plaqueAccessors.length > 0);
        const localMinimum = [0, 1, 2].map((axis) =>
            Math.min(
                ...plaqueAccessors.map(
                    (accessor) => accessor.localMinimum[axis],
                ),
            ),
        );
        const localMaximum = [0, 1, 2].map((axis) =>
            Math.max(
                ...plaqueAccessors.map(
                    (accessor) => accessor.localMaximum[axis],
                ),
            ),
        );

        assert.ok(Math.abs(localMinimum[0] + localMaximum[0]) < 0.001);
        assert.ok(Math.abs(localMinimum[1] + localMaximum[1]) < 0.000_01);
        assert.ok(Math.abs(localMinimum[2] + localMaximum[2]) < 0.000_01);
    });

    it('keeps the wooden sign post below the writing board', () => {
        const document = readGlbDocument(
            readFileSync(getModelPath('WoodenSign')),
        );
        assert.ok(isRecord(document));
        const positionAccessors = getPositionAccessors(document);
        const postAccessors = positionAccessors.filter(
            (accessor) => accessor.nodeName === 'WoodenSign_Post',
        );
        const boardAccessors = positionAccessors.filter(
            (accessor) => accessor.nodeName === 'WoodenSign_Board',
        );
        assert.ok(postAccessors.length > 0);
        assert.ok(boardAccessors.length > 0);

        const postTop = Math.max(
            ...postAccessors.map((accessor) => accessor.maximum[1]),
        );
        const boardBottom = Math.min(
            ...boardAccessors.map((accessor) => accessor.minimum[1]),
        );

        assert.ok(postTop <= boardBottom + 0.000_01);
    });
});
