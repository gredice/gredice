import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

type JsonRecord = Record<string, unknown>;

const manifestPath = fileURLToPath(
    new URL('../../../../assets/game-assets.json', import.meta.url),
);
const gateNames = [
    'FenceGate',
    'WhiteFenceGate',
    'StoneFenceGate',
    'PolishedStoneFenceGate',
] as const;
const gateFamilyMaterials = {
    FenceGate: [
        {
            gate: 'Material.Planks',
            referenceAsset: 'Fence',
            reference: 'Material.Planks',
        },
    ],
    WhiteFenceGate: [
        {
            gate: 'Material.WhitePaint',
            referenceAsset: 'WhiteFence',
            reference: 'Material.WhitePaint',
        },
    ],
    StoneFenceGate: [
        {
            gate: 'Material.StoneFence.Large',
            referenceAsset: 'StoneFence',
            reference: 'Material.StoneFence.Large',
        },
        {
            gate: 'Material.StoneFence.Mid',
            referenceAsset: 'StoneFence',
            reference: 'Material.StoneFence.Mid',
        },
        {
            gate: 'Material.StoneFence.Dark',
            referenceAsset: 'StoneFence',
            reference: 'Material.StoneFence.Dark',
        },
    ],
    PolishedStoneFenceGate: [
        {
            gate: 'Material.PolishedStoneFence.Surface',
            referenceAsset: 'PolishedStoneFence',
            reference: 'Material.PolishedStoneFence.Surface',
        },
        {
            gate: 'Material.WhitePaint',
            referenceAsset: 'WhiteFence',
            reference: 'Material.WhitePaint',
        },
    ],
} as const;
const gateLeafFamilyMaterials = {
    FenceGate: ['Material.Planks'],
    WhiteFenceGate: ['Material.WhitePaint'],
    StoneFenceGate: [
        'Material.StoneFence.Large',
        'Material.StoneFence.Mid',
        'Material.StoneFence.Dark',
    ],
    PolishedStoneFenceGate: ['Material.WhitePaint'],
} as const;

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

function readAsset(name: string) {
    const model = readFileSync(
        fileURLToPath(
            new URL(
                `../../../../apps/garden/public/assets/models/${name}.glb`,
                import.meta.url,
            ),
        ),
    );
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return { document, model };
}

function findNamedRecord(value: unknown, label: string, name: string) {
    const record = records(value, label).find((item) => item.name === name);
    assert.ok(record, `${label} must include ${name}`);
    return record;
}

describe('fence gate assets', () => {
    for (const name of gateNames) {
        it(`${name} exports stationary posts and a separately hinged leaf`, () => {
            const { document } = readAsset(name);
            assert.deepEqual(
                records(document.nodes, 'nodes').map((node) => node.name),
                [`${name}_Posts`, `${name}_Leaf`],
            );

            const meshes = records(document.meshes, 'meshes');
            assert.ok(
                meshes.some((mesh) => mesh.name === `${name}_Posts_Mesh`),
            );
            assert.ok(meshes.some((mesh) => mesh.name === `${name}_Leaf_Mesh`));
        });

        it(`${name} uses a cache version matching its exported GLB`, () => {
            const { model } = readAsset(name);
            const manifest: unknown = JSON.parse(
                readFileSync(manifestPath, 'utf8'),
            );
            assert.ok(isRecord(manifest));
            const manifestAsset = records(
                manifest.assets,
                'manifest.assets',
            ).find((asset) => asset.name === name);
            assert.ok(manifestAsset);
            assert.equal(
                manifestAsset.version,
                createHash('sha256').update(model).digest('hex').slice(0, 12),
            );
        });

        it(`${name} matches its fence family materials`, () => {
            const { document } = readAsset(name);
            const gateMaterials = records(document.materials, 'materials');

            for (const materialContract of gateFamilyMaterials[name]) {
                const gateMaterial = findNamedRecord(
                    gateMaterials,
                    'materials',
                    materialContract.gate,
                );
                const { document: referenceDocument } = readAsset(
                    materialContract.referenceAsset,
                );
                const referenceMaterial = findNamedRecord(
                    referenceDocument.materials,
                    'reference materials',
                    materialContract.reference,
                );
                assert.deepEqual(
                    gateMaterial.pbrMetallicRoughness,
                    referenceMaterial.pbrMetallicRoughness,
                );
            }

            const materialNames = gateMaterials.map(
                (material) => material.name,
            );
            const leafMesh = findNamedRecord(
                document.meshes,
                'meshes',
                `${name}_Leaf_Mesh`,
            );
            const leafMaterialNames = records(
                leafMesh.primitives,
                'leaf primitives',
            ).map((primitive) => {
                const materialIndex = primitive.material;
                if (typeof materialIndex !== 'number') {
                    assert.fail('leaf primitive material must be a number');
                }
                return materialNames[materialIndex];
            });
            for (const materialName of gateLeafFamilyMaterials[name]) {
                assert.ok(
                    leafMaterialNames.includes(materialName),
                    `${name} leaf must use ${materialName}`,
                );
            }
        });
    }
});
