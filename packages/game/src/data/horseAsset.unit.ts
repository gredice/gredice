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

type JsonRecord = Record<string, unknown>;

const assetName = 'Horse';
const animationNames = [
    'Horse_Idle',
    'Horse_Graze',
    'Horse_Walk',
    'Horse_Trot',
    'Horse_Attentive',
    'Horse_TailSwish',
] as const;
const materialNames = [
    'Material.Horse.CoatDark',
    'Material.Horse.Coat',
    'Material.Horse.Hoof',
    'Material.Horse.Marking',
    'Material.Horse.Eye',
    'Material.Horse.EyeGlint',
    'Material.Horse.Mane',
    'Material.Horse.Muzzle',
] as const;
const modelPath = fileURLToPath(
    new URL(
        '../../../../apps/garden/public/assets/models/Horse.glb',
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

function readHorseDocument() {
    const model = readFileSync(modelPath);
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return { document, model };
}

describe('Horse asset', () => {
    it('exports the stable authored hierarchy, palette roles, and six clips', () => {
        const { document } = readHorseDocument();
        const manifest: unknown = JSON.parse(
            readFileSync(manifestPath, 'utf8'),
        );
        assert.ok(isRecord(manifest));
        const asset = records(manifest.assets, 'manifest.assets').find(
            (candidate) => candidate.name === assetName,
        );
        assert.ok(asset);

        const exportedNodeNames = new Set(
            records(document.nodes, 'Horse.nodes').map((node) => node.name),
        );
        assert.ok(Array.isArray(asset.objects));
        assert.equal(exportedNodeNames.size, asset.objects.length);
        for (const objectName of asset.objects) {
            assert.equal(typeof objectName, 'string');
            assert.ok(exportedNodeNames.has(objectName), objectName);
        }

        assert.deepEqual(
            records(document.materials, 'Horse.materials').map(
                (material) => material.name,
            ),
            materialNames,
        );
        assert.deepEqual(
            records(document.animations, 'Horse.animations').map(
                (animation) => animation.name,
            ),
            animationNames,
        );
    });

    it('faces the runtime movement direction at authored horse scale', () => {
        const { document } = readHorseDocument();
        const root = records(document.nodes, 'Horse.nodes').find(
            (node) => node.name === 'Horse_Root',
        );
        assert.ok(root);
        assert.ok(Array.isArray(root.rotation));
        assert.ok(Array.isArray(root.scale));
        assert.ok(Math.abs(Number(root.rotation[1]) + 1) < 0.000_01);
        assert.deepEqual(
            root.scale.map((value) => Number(value).toFixed(2)),
            ['0.96', '0.90', '0.83'],
        );
        assert.equal(records(document.meshes, 'Horse.meshes').length, 37);
    });

    it('matches the manifest cache version and generated lazy registry', () => {
        const { model } = readHorseDocument();
        const version = createHash('sha256')
            .update(model)
            .digest('hex')
            .slice(0, 12);
        const manifest: unknown = JSON.parse(
            readFileSync(manifestPath, 'utf8'),
        );
        assert.ok(isRecord(manifest));
        const asset = records(manifest.assets, 'manifest.assets').find(
            (candidate) => candidate.name === assetName,
        );
        assert.ok(asset);
        assert.equal(asset.source, 'Horse.blend');
        assert.equal(asset.output, 'Horse.glb');
        assert.equal(asset.preload, 'lazy');
        assert.equal(asset.version, version);
        assert.equal(
            gameAssetModels.Horse.url,
            `/assets/models/Horse.glb?v=${version}`,
        );
        assert.ok(lazyGameAssetNames.includes(assetName));
        assert.ok(allGameAssetNames.includes(assetName));
    });
});
