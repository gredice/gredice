import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

type JsonRecord = Record<string, unknown>;

const modelPath = fileURLToPath(
    new URL(
        '../../../../apps/garden/public/assets/models/WhiteFence.glb',
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

function numberValue(value: unknown, label: string) {
    if (typeof value !== 'number') {
        throw new TypeError(`${label} must be numeric`);
    }
    return value;
}

function vector(value: unknown, label: string) {
    assert.ok(Array.isArray(value), `${label} must be an array`);
    assert.equal(value.length, 3, `${label} must have three channels`);
    return [
        numberValue(value[0], `${label}[0]`),
        numberValue(value[1], `${label}[1]`),
        numberValue(value[2], `${label}[2]`),
    ] satisfies [number, number, number];
}

function close(actual: number, expected: number) {
    assert.ok(
        Math.abs(actual - expected) < 0.000_01,
        `${actual} differs from ${expected}`,
    );
}

function readWhiteFenceDocument() {
    const model = readFileSync(modelPath);
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return {
        accessors: records(document.accessors, 'accessors'),
        materials: records(document.materials, 'materials'),
        meshes: records(document.meshes, 'meshes'),
        nodes: records(document.nodes, 'nodes'),
    };
}

function meshBounds(
    document: ReturnType<typeof readWhiteFenceDocument>,
    meshName: string,
) {
    const mesh = document.meshes.find((item) => item.name === meshName);
    assert.ok(mesh, `Missing mesh ${meshName}`);
    const [primitive] = records(mesh.primitives, `${meshName}.primitives`);
    assert.ok(primitive);
    assert.ok(isRecord(primitive.attributes));
    const accessorIndex = numberValue(
        primitive.attributes.POSITION,
        `${meshName}.POSITION`,
    );
    const accessor = document.accessors[accessorIndex];
    assert.ok(accessor, `Missing ${meshName} accessor`);
    return {
        maximum: vector(accessor.max, `${meshName}.max`),
        minimum: vector(accessor.min, `${meshName}.min`),
        vertexCount: numberValue(accessor.count, `${meshName}.count`),
    };
}

describe('white fence asset', () => {
    it('exports every connected topology with repeated grounded pickets', () => {
        const document = readWhiteFenceDocument();
        assert.deepEqual(
            document.nodes.map((node) => node.name),
            [
                'WhiteFence_Solo',
                'WhiteFence_Single',
                'WhiteFence_Middle',
                'WhiteFence_Corner',
                'WhiteFence_T',
                'WhiteFence_Cross',
            ],
        );

        const solo = meshBounds(document, 'WhiteFence_Solo_Mesh');
        const middle = meshBounds(document, 'WhiteFence_Middle_Mesh');
        const cross = meshBounds(document, 'WhiteFence_Cross_Mesh');
        close(solo.minimum[0], -0.3575);
        close(solo.maximum[0], 0.3575);
        close(solo.minimum[1], -1);
        close(solo.maximum[1], -0.28);
        close(solo.minimum[2], -0.0225);
        close(solo.maximum[2], 0.0225);
        close(middle.minimum[2], -0.6075);
        close(middle.maximum[2], 0.6075);
        close(cross.minimum[0], -0.6075);
        close(cross.maximum[0], 0.6075);
        close(cross.minimum[2], -0.6075);
        close(cross.maximum[2], 0.6075);
        assert.equal(solo.vertexCount, 282);
        assert.equal(middle.vertexCount, 534);
        assert.equal(cross.vertexCount, 1038);
    });

    it('uses matte warm-white paint', () => {
        const document = readWhiteFenceDocument();
        const material = document.materials.find(
            (item) => item.name === 'Material.WhitePaint',
        );
        assert.ok(material);
        assert.ok(isRecord(material.pbrMetallicRoughness));
        const profile = material.pbrMetallicRoughness;
        assert.equal(profile.metallicFactor, 0);
        close(numberValue(profile.roughnessFactor, 'roughness'), 0.82);
        assert.ok(Array.isArray(profile.baseColorFactor));
        close(numberValue(profile.baseColorFactor[0], 'red'), 0.904661);
        close(numberValue(profile.baseColorFactor[1], 'green'), 0.887923);
        close(numberValue(profile.baseColorFactor[2], 'blue'), 0.822786);
    });

    it('uses a cache version matching the exported GLB', () => {
        const manifest: unknown = JSON.parse(
            readFileSync(manifestPath, 'utf8'),
        );
        assert.ok(isRecord(manifest));
        const assets = records(manifest.assets, 'manifest.assets');
        const asset = assets.find((item) => item.name === 'WhiteFence');
        assert.ok(asset);
        const expectedVersion = createHash('sha256')
            .update(readFileSync(modelPath))
            .digest('hex')
            .slice(0, 12);

        assert.equal(asset.version, expectedVersion);
    });
});
