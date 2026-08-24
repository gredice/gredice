import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gameAssetModels } from './gameAssetModels.generated';

type JsonRecord = Record<string, unknown>;

const manifestPath = fileURLToPath(
    new URL('../../../../assets/game-assets.json', import.meta.url),
);
const sourcePath = fileURLToPath(
    new URL('../../../../assets/game-assets/Cow.blend', import.meta.url),
);
const modelPath = fileURLToPath(
    new URL(
        '../../../../apps/garden/public/assets/models/Cow.glb',
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

function readCowDocument() {
    const model = readFileSync(modelPath);
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return document;
}

describe('Cow source and runtime asset', () => {
    it('keeps the original Blender source and every procedural rig pivot', () => {
        assert.ok(readFileSync(sourcePath).byteLength > 10_000);
        const document = readCowDocument();
        const nodeNames = new Set(
            records(document.nodes, 'Cow.nodes').map((node) => node.name),
        );

        for (const nodeName of [
            'Cow_Root',
            'Cow_BodyPivot',
            'Cow_NeckPivot',
            'Cow_HeadPivot',
            'Cow_JawPivot',
            'Cow_EarPivot_L',
            'Cow_EarPivot_R',
            'Cow_TailPivot_Base',
            'Cow_TailPivot_Tip',
            'Cow_LegPivot_FL',
            'Cow_LegPivot_FR',
            'Cow_LegPivot_RL',
            'Cow_LegPivot_RR',
        ]) {
            assert.equal(nodeNames.has(nodeName), true, `Missing ${nodeName}`);
        }
    });

    it('exports exactly the two independently selectable coat patch groups', () => {
        const document = readCowDocument();
        const nodeNames = records(document.nodes, 'Cow.nodes')
            .map((node) => node.name)
            .filter(
                (name): name is string =>
                    typeof name === 'string' && name.startsWith('Cow_Coat_'),
            );
        const materialNames = new Set(
            records(document.materials, 'Cow.materials').map(
                (material) => material.name,
            ),
        );

        assert.deepEqual(nodeNames.sort(), [
            'Cow_Coat_BlackPatches',
            'Cow_Coat_BrownPatches',
        ]);
        assert.equal(materialNames.has('Material.Cow.Black'), true);
        assert.equal(materialNames.has('Material.Cow.Brown'), true);
        assert.equal(materialNames.has('Material.Cow.Cream'), true);
    });

    it('cache-busts the generated Cow GLB by its content hash', () => {
        const expectedVersion = createHash('sha256')
            .update(readFileSync(modelPath))
            .digest('hex')
            .slice(0, 12);
        const manifest: unknown = JSON.parse(
            readFileSync(manifestPath, 'utf8'),
        );
        assert.ok(isRecord(manifest));
        const cow = records(manifest.assets, 'manifest.assets').find(
            (asset) => asset.name === 'Cow',
        );

        assert.ok(cow);
        assert.equal(cow.version, expectedVersion);
        assert.equal(
            gameAssetModels.Cow.url,
            `/assets/models/Cow.glb?v=${expectedVersion}`,
        );
    });
});
