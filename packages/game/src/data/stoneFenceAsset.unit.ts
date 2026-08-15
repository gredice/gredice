import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

type JsonRecord = Record<string, unknown>;

const manifestPath = fileURLToPath(
    new URL('../../../../assets/game-assets.json', import.meta.url),
);

const fenceAssets = [
    {
        materialNames: [
            'Material.StoneFence.Large',
            'Material.StoneFence.Mid',
            'Material.StoneFence.Dark',
        ],
        name: 'StoneFence',
        roughness: [0.88, 0.91, 0.94],
        soloMaximum: [0.16, -0.32, 0.16],
        soloMinimum: [-0.16, -1, -0.16],
    },
    {
        materialNames: ['Material.PolishedStoneFence.Surface'],
        name: 'PolishedStoneFence',
        roughness: [0.58],
        soloMaximum: [0.14, -0.32, 0.14],
        soloMinimum: [-0.14, -1, -0.14],
    },
] as const;

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

function vector(value: unknown, label: string) {
    assert.ok(Array.isArray(value), `${label} must be an array`);
    assert.equal(value.length, 3, `${label} must have three channels`);
    return value.map((channel, index) =>
        numberValue(channel, `${label}[${index}]`),
    ) as [number, number, number];
}

function close(actual: number, expected: number) {
    assert.ok(
        Math.abs(actual - expected) < 0.000_01,
        `${actual} differs from ${expected}`,
    );
}

function readAsset(name: string) {
    const path = fileURLToPath(
        new URL(
            `../../../../apps/garden/public/assets/models/${name}.glb`,
            import.meta.url,
        ),
    );
    const model = readFileSync(path);
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return {
        document: {
            accessors: records(document.accessors, 'accessors'),
            materials: records(document.materials, 'materials'),
            meshes: records(document.meshes, 'meshes'),
            nodes: records(document.nodes, 'nodes'),
        },
        model,
        path,
    };
}

function meshBounds(
    document: ReturnType<typeof readAsset>['document'],
    meshName: string,
) {
    const mesh = document.meshes.find((item) => item.name === meshName);
    assert.ok(mesh, `Missing mesh ${meshName}`);
    const primitives = records(mesh.primitives, `${meshName}.primitives`);
    const bounds = primitives.map((primitive, index) => {
        assert.ok(isRecord(primitive.attributes));
        const accessorIndex = numberValue(
            primitive.attributes.POSITION,
            `${meshName}.primitives[${index}].POSITION`,
        );
        const accessor = document.accessors[accessorIndex];
        assert.ok(accessor, `Missing ${meshName} accessor`);
        return {
            maximum: vector(accessor.max, `${meshName}.max`),
            minimum: vector(accessor.min, `${meshName}.min`),
        };
    });

    return {
        maximum: [0, 1, 2].map((channel) =>
            Math.max(...bounds.map((bound) => bound.maximum[channel] ?? 0)),
        ) as [number, number, number],
        minimum: [0, 1, 2].map((channel) =>
            Math.min(...bounds.map((bound) => bound.minimum[channel] ?? 0)),
        ) as [number, number, number],
        primitiveCount: primitives.length,
    };
}

describe('stone fence assets', () => {
    for (const asset of fenceAssets) {
        it(`${asset.name} exports the six connected topologies and an isolated pillar`, () => {
            const { document } = readAsset(asset.name);
            assert.deepEqual(
                document.nodes.map((node) => node.name),
                ['Solo', 'Single', 'Middle', 'Corner', 'T', 'Cross'].map(
                    (variant) => `${asset.name}_${variant}`,
                ),
            );

            const solo = meshBounds(document, `${asset.name}_Solo_Mesh`);
            const middle = meshBounds(document, `${asset.name}_Middle_Mesh`);
            const cross = meshBounds(document, `${asset.name}_Cross_Mesh`);

            asset.soloMinimum.forEach((expected, index) => {
                close(solo.minimum[index] ?? 0, expected);
            });
            asset.soloMaximum.forEach((expected, index) => {
                close(solo.maximum[index] ?? 0, expected);
            });
            close(middle.minimum[2], -0.5);
            close(middle.maximum[2], 0.5);
            close(cross.minimum[0], -0.5);
            close(cross.maximum[0], 0.5);
            close(cross.minimum[2], -0.5);
            close(cross.maximum[2], 0.5);
            assert.equal(solo.primitiveCount, asset.materialNames.length);
        });

        it(`${asset.name} preserves its intended surface profile`, () => {
            const { document } = readAsset(asset.name);
            assert.deepEqual(
                document.materials.map((material) => material.name),
                asset.materialNames,
            );
            document.materials.forEach((material, index) => {
                assert.ok(isRecord(material.pbrMetallicRoughness));
                assert.equal(material.pbrMetallicRoughness.metallicFactor, 0);
                close(
                    numberValue(
                        material.pbrMetallicRoughness.roughnessFactor,
                        `${asset.name}.roughness`,
                    ),
                    asset.roughness[index] ?? 0,
                );
            });
        });

        it(`${asset.name} uses a cache version matching its exported GLB`, () => {
            const { model } = readAsset(asset.name);
            const manifest: unknown = JSON.parse(
                readFileSync(manifestPath, 'utf8'),
            );
            assert.ok(isRecord(manifest));
            const manifestAsset = records(
                manifest.assets,
                'manifest.assets',
            ).find((item) => item.name === asset.name);
            assert.ok(manifestAsset);
            assert.equal(
                manifestAsset.version,
                createHash('sha256').update(model).digest('hex').slice(0, 12),
            );
        });
    }
});
