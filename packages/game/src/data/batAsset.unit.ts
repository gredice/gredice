import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    gameAssetModels,
    lazyGameAssetNames,
} from './gameAssetModels.generated';

type JsonRecord = Record<string, unknown>;

const modelPath = fileURLToPath(
    new URL(
        '../../../../apps/garden/public/assets/models/Bat.glb',
        import.meta.url,
    ),
);
const manifestPath = fileURLToPath(
    new URL('../../../../assets/game-assets.json', import.meta.url),
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

function readBatDocument() {
    const model = readFileSync(modelPath);
    assert.equal(model.subarray(0, 4).toString('utf8'), 'glTF');
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return document;
}

describe('Bat game asset', () => {
    it('contains the authored anatomy, materials, and behavior clips', () => {
        const document = readBatDocument();
        const nodeNames = new Set(
            records(document.nodes, 'nodes').map((node) => node.name),
        );
        const materialNames = new Set(
            records(document.materials, 'materials').map(
                (material) => material.name,
            ),
        );
        const animationNames = records(document.animations, 'animations').map(
            (animation) => animation.name,
        );

        for (const name of [
            'Bat_Root',
            'Bat_Body',
            'Bat_Head',
            'Bat_Ear_L',
            'Bat_Ear_R',
            'Bat_UpperArm_L',
            'Bat_UpperArm_R',
            'Bat_Forearm_L',
            'Bat_Forearm_R',
            'Bat_HandMembrane_L',
            'Bat_HandMembrane_R',
            'Bat_TailMembrane',
        ]) {
            assert.ok(nodeNames.has(name), `Missing ${name}`);
        }
        assert.ok(materialNames.has('Material.Bat.WingMembrane'));
        assert.ok(materialNames.has('Material.Bat.WarmBrown'));
        assert.deepEqual(animationNames, [
            'Bat_Flap',
            'Bat_Glide',
            'Bat_Roost',
        ]);
    });

    it('stays lazy-loaded and within the bounded runtime asset budget', () => {
        assert.ok(lazyGameAssetNames.includes('Bat'));
        assert.ok(statSync(modelPath).size < 150_000);
        assert.ok(
            gameAssetModels.Bat.url.startsWith('/assets/models/Bat.glb?v='),
        );
    });

    it('cache-busts the GLB with its content hash', () => {
        const expectedVersion = createHash('sha256')
            .update(readFileSync(modelPath))
            .digest('hex')
            .slice(0, 12);
        const manifest: unknown = JSON.parse(
            readFileSync(manifestPath, 'utf8'),
        );
        assert.ok(isRecord(manifest));
        const bat = records(manifest.assets, 'manifest.assets').find(
            (asset) => asset.name === 'Bat',
        );
        assert.ok(bat);
        assert.equal(bat.version, expectedVersion);
        assert.ok(gameAssetModels.Bat.url.endsWith(`?v=${expectedVersion}`));
    });
});
