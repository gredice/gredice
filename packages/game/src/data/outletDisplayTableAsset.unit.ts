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

const assetName = 'OutletDisplayTable';
const objectNames = [
    'OutletDisplayTable_TopPlanks',
    'OutletDisplayTable_Frame',
    'OutletDisplayTable_LowerShelf',
];
const materialNames = [
    'Material.OutletDisplayTable.HoneyWood',
    'Material.OutletDisplayTable.DeepWood',
    'Material.OutletDisplayTable.GoldenWood',
];
const modelPath = fileURLToPath(
    new URL(
        '../../../../apps/garden/public/assets/models/OutletDisplayTable.glb',
        import.meta.url,
    ),
);
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

function getPositionAccessors(document: Record<string, unknown>) {
    assert.ok(Array.isArray(document.meshes));
    assert.ok(Array.isArray(document.accessors));
    const accessors = document.accessors;

    return document.meshes.flatMap((mesh) => {
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
            const count = accessor.count;
            assert.ok(typeof count === 'number');
            return {
                count,
                maximum: accessor.max,
                minimum: accessor.min,
            };
        });
    });
}

describe('OutletDisplayTable asset', () => {
    it('exports a lightweight, base-centered 1x1 table at display height', () => {
        const document = readGlbDocument(readFileSync(modelPath));
        assert.ok(isRecord(document));
        const accessors = getPositionAccessors(document);
        const minimum = [0, 1, 2].map((axis) =>
            Math.min(...accessors.map((accessor) => accessor.minimum[axis])),
        );
        const maximum = [0, 1, 2].map((axis) =>
            Math.max(...accessors.map((accessor) => accessor.maximum[axis])),
        );
        const vertexCount = accessors.reduce(
            (total, accessor) => total + accessor.count,
            0,
        );

        assert.ok(Math.abs(minimum[1]) < 0.000_01);
        assert.ok(minimum[0] >= -0.5 && maximum[0] <= 0.5);
        assert.ok(minimum[2] >= -0.5 && maximum[2] <= 0.5);
        assert.ok(maximum[1] >= 0.62 && maximum[1] <= 0.7);
        assert.ok(vertexCount <= 1_500);
    });

    it('keeps three intentional wood roles in the exported scene', () => {
        const document = readGlbDocument(readFileSync(modelPath));
        assert.ok(isRecord(document));
        assert.ok(Array.isArray(document.nodes));
        assert.ok(Array.isArray(document.meshes));
        assert.ok(Array.isArray(document.materials));

        assert.deepEqual(
            document.nodes.map((node) => {
                assert.ok(isRecord(node));
                return node.name;
            }),
            objectNames,
        );
        assert.equal(document.meshes.length, 3);
        assert.deepEqual(
            document.materials.map((material) => {
                assert.ok(isRecord(material));
                return material.name;
            }),
            materialNames,
        );
    });

    it('matches the focused manifest and generated lazy registry', () => {
        const model = readFileSync(modelPath);
        const version = createHash('sha256')
            .update(model)
            .digest('hex')
            .slice(0, 12);
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

        assert.ok(isRecord(manifest));
        assert.ok(Array.isArray(manifest.assets));
        const asset = manifest.assets.find(
            (candidate) => isRecord(candidate) && candidate.name === assetName,
        );
        assert.ok(isRecord(asset));
        assert.equal(asset.source, `${assetName}.blend`);
        assert.equal(asset.output, `${assetName}.glb`);
        assert.equal(asset.preload, 'lazy');
        assert.equal(asset.version, version);
        assert.deepEqual(asset.objects, objectNames);
        assert.equal(
            gameAssetModels.OutletDisplayTable.url,
            `/assets/models/${assetName}.glb?v=${version}`,
        );
        assert.ok(lazyGameAssetNames.includes(assetName));
        assert.ok(allGameAssetNames.includes(assetName));
    });
});
