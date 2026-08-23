import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    gameAssetModels,
    lazyGameAssetNames,
} from './gameAssetModels.generated';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function records(value: unknown, label: string) {
    assert.ok(Array.isArray(value), `${label} must be an array`);
    return value.map((entry) => {
        assert.ok(isRecord(entry));
        return entry;
    });
}

const modelPath = fileURLToPath(
    new URL(
        '../../../../apps/garden/public/assets/models/Rabbit.glb',
        import.meta.url,
    ),
);
const sourcePath = fileURLToPath(
    new URL('../../../../assets/game-assets/Rabbit.blend', import.meta.url),
);
const manifestPath = fileURLToPath(
    new URL('../../../../assets/game-assets.json', import.meta.url),
);

function readRabbitDocument() {
    const model = readFileSync(modelPath);
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return document;
}

describe('Rabbit asset', () => {
    it('keeps the original Blender source and every runtime animation pivot', () => {
        assert.equal(existsSync(sourcePath), true);
        const document = readRabbitDocument();
        const nodeNames = new Set(
            records(document.nodes, 'nodes').map((node) => node.name),
        );

        for (const name of [
            'Rabbit_Root',
            'Rabbit_BodyPivot',
            'Rabbit_HeadPivot',
            'Rabbit_NosePivot',
            'Rabbit_EarPivot_L',
            'Rabbit_EarPivot_R',
            'Rabbit_LegPivot_FL',
            'Rabbit_LegPivot_FR',
            'Rabbit_LegPivot_HL',
            'Rabbit_LegPivot_HR',
            'Rabbit_TailPivot',
        ]) {
            assert.equal(nodeNames.has(name), true, `Missing ${name}`);
        }
        assert.equal(records(document.meshes, 'meshes').length, 25);
    });

    it('exports only the five intentional material roles', () => {
        const materialNames = records(
            readRabbitDocument().materials,
            'materials',
        )
            .map((material) => material.name)
            .sort();

        assert.deepEqual(materialNames, [
            'Material.Rabbit.Charcoal',
            'Material.Rabbit.EyeGlint',
            'Material.Rabbit.FurPrimary',
            'Material.Rabbit.FurSecondary',
            'Material.Rabbit.InnerEar',
        ]);
    });

    it('matches its manifest hash and lazy typed registry', () => {
        const expectedVersion = createHash('sha256')
            .update(readFileSync(modelPath))
            .digest('hex')
            .slice(0, 12);
        const manifest: unknown = JSON.parse(
            readFileSync(manifestPath, 'utf8'),
        );
        assert.ok(isRecord(manifest));
        const rabbit = records(manifest.assets, 'assets').find(
            (asset) => asset.name === 'Rabbit',
        );

        assert.ok(rabbit);
        assert.equal(rabbit.version, expectedVersion);
        assert.equal(lazyGameAssetNames.includes('Rabbit'), true);
        assert.equal(
            gameAssetModels.Rabbit.url,
            `/assets/models/Rabbit.glb?v=${expectedVersion}`,
        );
    });
});
