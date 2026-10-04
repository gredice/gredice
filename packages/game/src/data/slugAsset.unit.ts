import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gameAssetModels } from './gameAssetModels.generated';

type JsonRecord = Record<string, unknown>;

const modelPath = fileURLToPath(
    new URL(
        '../../../../apps/garden/public/assets/models/Slug.glb',
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

function readDocument() {
    const model = readFileSync(modelPath);
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return document;
}

describe('Slug environment-animal asset', () => {
    it('exports a lightweight, forward-facing rig with animal-specific pivots', () => {
        const document = readDocument();
        const nodes = records(document.nodes, 'Slug.nodes');
        const nodeNames = new Set(nodes.map((node) => node.name));
        for (const expectedName of [
            'Slug_Root',
            'Slug_FootPivot',
            'Slug_RearPivot',
            'Slug_MiddlePivot',
            'Slug_MantlePivot',
            'Slug_HeadPivot',
            'Slug_UpperFeelerPivot_L',
            'Slug_UpperFeelerPivot_R',
            'Slug_LowerFeelerPivot_L',
            'Slug_LowerFeelerPivot_R',
        ]) {
            assert.ok(nodeNames.has(expectedName), `Missing ${expectedName}`);
        }
        const root = nodes.find((node) => node.name === 'Slug_Root');
        assert.ok(root);
        assert.ok(Array.isArray(root.rotation));
        assert.ok(Math.abs(Number(root.rotation[1])) > 0.999);

        const meshes = records(document.meshes, 'Slug.meshes');
        assert.ok(meshes.length >= 12);
        assert.ok(meshes.length <= 24);
    });

    it('keeps distinct cozy anatomy materials', () => {
        const materials = records(readDocument().materials, 'Slug.materials');
        const names = new Set(materials.map((material) => material.name));
        for (const expectedName of [
            'Material.Slug.Body',
            'Material.Slug.BodyLight',
            'Material.Slug.Foot',
            'Material.Slug.Mantle',
            'Material.Slug.MantleSpot',
            'Material.Slug.Eye',
        ]) {
            assert.ok(names.has(expectedName), `Missing ${expectedName}`);
        }
    });

    it('matches the manifest and generated cache-busted registry', () => {
        const expectedVersion = createHash('sha256')
            .update(readFileSync(modelPath))
            .digest('hex')
            .slice(0, 12);
        const manifest: unknown = JSON.parse(
            readFileSync(manifestPath, 'utf8'),
        );
        assert.ok(isRecord(manifest));
        const slug = records(manifest.assets, 'manifest.assets').find(
            (asset) => asset.name === 'Slug',
        );

        assert.ok(slug);
        assert.equal(slug.version, expectedVersion);
        assert.equal(
            gameAssetModels.Slug.url,
            `/assets/models/Slug.glb?v=${expectedVersion}`,
        );
    });
});
