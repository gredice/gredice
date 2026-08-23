import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gameAssetModels } from './gameAssetModels.generated';

type JsonRecord = Record<string, unknown>;

const farmAssetNames = [
    'Chicken',
    'Goat',
    'Piglet',
    'ChickenCoop',
    'PigletPen',
    'Sheep',
] as const;
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

function numberValue(value: unknown, label: string) {
    if (typeof value !== 'number') {
        throw new TypeError(`${label} must be numeric`);
    }
    return value;
}

function modelPath(assetName: (typeof farmAssetNames)[number]) {
    return fileURLToPath(
        new URL(
            `../../../../apps/garden/public/assets/models/${assetName}.glb`,
            import.meta.url,
        ),
    );
}

function readDocument(assetName: (typeof farmAssetNames)[number]) {
    const model = readFileSync(modelPath(assetName));
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return document;
}

function nodeChildrenNames(document: JsonRecord, nodeName: string) {
    const nodes = records(document.nodes, 'nodes');
    const node = nodes.find((candidate) => candidate.name === nodeName);
    assert.ok(node, `Missing ${nodeName}`);
    const children = node.children;
    assert.ok(Array.isArray(children), `${nodeName}.children must be an array`);
    return children.map((childIndex) => {
        assert.equal(typeof childIndex, 'number');
        const child = nodes[childIndex];
        assert.ok(child, `Missing ${nodeName} child ${childIndex}`);
        assert.equal(typeof child.name, 'string');
        return child.name;
    });
}

function close(actual: number, expected: number) {
    assert.ok(
        Math.abs(actual - expected) < 0.000_01,
        `${actual} differs from ${expected}`,
    );
}

function srgbChannelToLinear(value: number) {
    if (value <= 0.04045) {
        return value / 12.92;
    }
    return ((value + 0.055) / 1.055) ** 2.4;
}

function assertLinearMaterial(
    assetName: (typeof farmAssetNames)[number],
    materialName: string,
    srgb: readonly [number, number, number],
) {
    const document = readDocument(assetName);
    const material = records(document.materials, `${assetName}.materials`).find(
        (candidate) => candidate.name === materialName,
    );
    assert.ok(material, `Missing ${materialName}`);
    assert.ok(isRecord(material.pbrMetallicRoughness));
    const color = material.pbrMetallicRoughness.baseColorFactor;
    assert.ok(Array.isArray(color));
    assert.equal(color.length, 4);
    for (const [index, expected] of srgb.map(srgbChannelToLinear).entries()) {
        close(
            numberValue(color[index], `${materialName}.color[${index}]`),
            expected,
        );
    }
    close(numberValue(color[3], `${materialName}.alpha`), 1);
}

describe('farm animal assets', () => {
    it('exports every animal facing the runtime movement direction', () => {
        for (const assetName of [
            'Chicken',
            'Goat',
            'Piglet',
            'Sheep',
        ] as const) {
            const document = readDocument(assetName);
            const root = records(document.nodes, `${assetName}.nodes`).find(
                (candidate) => candidate.name === `${assetName}_Root`,
            );
            assert.ok(root, `Missing ${assetName}_Root`);
            assert.ok(Array.isArray(root.rotation));
            assert.equal(root.rotation.length, 4);
            close(numberValue(root.rotation[0], 'rotation.x'), 0);
            close(numberValue(root.rotation[1], 'rotation.y'), -1);
            close(numberValue(root.rotation[2], 'rotation.z'), 0);
            close(numberValue(root.rotation[3], 'rotation.w'), 0);
        }
    });

    it('stores authored display colors as linear GLB factors', () => {
        assertLinearMaterial(
            'Chicken',
            'Material.Chicken.Cream',
            [0.92, 0.79, 0.52],
        );
        assertLinearMaterial('Goat', 'Material.Goat.Cream', [0.86, 0.79, 0.63]);
        assertLinearMaterial(
            'Piglet',
            'Material.Piglet.Pink',
            [0.94, 0.52, 0.55],
        );
        assertLinearMaterial(
            'ChickenCoop',
            'Material.ChickenCoop.Oak',
            [0.42, 0.23, 0.1],
        );
        assertLinearMaterial(
            'PigletPen',
            'Material.PigletPen.Oak',
            [0.43, 0.25, 0.12],
        );
        assertLinearMaterial(
            'Sheep',
            'Material.Sheep.Wool',
            [0.91, 0.84, 0.68],
        );
    });

    it('exports the sheep with stable animal-specific animation pivots', () => {
        const document = readDocument('Sheep');
        const nodeNames = new Set(
            records(document.nodes, 'Sheep.nodes').map((node) => node.name),
        );
        const meshNames = new Set(
            records(document.meshes, 'Sheep.meshes').map((mesh) => mesh.name),
        );
        for (const name of [
            'Sheep_Root',
            'Sheep_BodyPivot',
            'Sheep_HeadPivot',
            'Sheep_JawPivot',
            'Sheep_EarPivot_L',
            'Sheep_EarPivot_R',
            'Sheep_TailPivot',
            'Sheep_LegPivot_FL',
            'Sheep_LegPivot_FR',
            'Sheep_LegPivot_RL',
            'Sheep_LegPivot_RR',
            'Sheep_WoolBody',
            'Sheep_Head',
            'Sheep_Muzzle',
        ]) {
            assert.ok(nodeNames.has(name), `Missing Sheep rig node ${name}`);
        }
        for (const name of [
            'Sheep_WoolBody',
            'Sheep_WoolChest',
            'Sheep_Tail',
        ]) {
            assert.ok(meshNames.has(name), `Missing Sheep mesh role ${name}`);
        }
    });

    it('keeps the goat animation rig and readable anatomy in the exported GLB', () => {
        const document = readDocument('Goat');
        const nodeNames = new Set(
            records(document.nodes, 'Goat.nodes').map(
                (candidate) => candidate.name,
            ),
        );

        for (const nodeName of [
            'Goat_BodyPivot',
            'Goat_NeckPivot',
            'Goat_HeadPivot',
            'Goat_JawPivot',
            'Goat_EarPivot_L',
            'Goat_EarPivot_R',
            'Goat_TailPivot',
            'Goat_LegPivot_FL',
            'Goat_LegPivot_FR',
            'Goat_LegPivot_RL',
            'Goat_LegPivot_RR',
            'Goat_Horn_L',
            'Goat_Horn_R',
            'Goat_Beard',
            'Goat_Hoof_FL',
            'Goat_Hoof_FR',
            'Goat_Hoof_RL',
            'Goat_Hoof_RR',
        ]) {
            assert.equal(nodeNames.has(nodeName), true, nodeName);
        }

        const neckChildren = nodeChildrenNames(document, 'Goat_NeckPivot');
        assert.equal(neckChildren.includes('Goat_Collar'), true);
        assert.equal(neckChildren.includes('Goat_SunflowerCharm'), true);
    });

    it('cache-busts every corrected farm GLB by its content hash', () => {
        const manifest: unknown = JSON.parse(
            readFileSync(manifestPath, 'utf8'),
        );
        assert.ok(isRecord(manifest));
        const assets = records(manifest.assets, 'manifest.assets');

        for (const assetName of farmAssetNames) {
            const expectedVersion = createHash('sha256')
                .update(readFileSync(modelPath(assetName)))
                .digest('hex')
                .slice(0, 12);
            const asset = assets.find(
                (candidate) => candidate.name === assetName,
            );
            assert.ok(asset, `Missing ${assetName} manifest entry`);
            assert.equal(asset.version, expectedVersion);
            assert.ok(
                gameAssetModels[assetName].url.endsWith(
                    `?v=${expectedVersion}`,
                ),
            );
        }
    });
});
