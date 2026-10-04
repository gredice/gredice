import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

type Bounds = {
    maximum: [number, number, number];
    minimum: [number, number, number];
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function readRecords(value: unknown, label: string) {
    assert.ok(Array.isArray(value), `${label} is not an array`);
    return value.map((item, index) => {
        assert.ok(isRecord(item), `${label}[${index}] is not an object`);
        return item;
    });
}

function readGlbDocument(assetName: string) {
    const modelPath = fileURLToPath(
        new URL(
            `../../../../apps/garden/public/assets/models/${assetName}.glb`,
            import.meta.url,
        ),
    );
    const model = readFileSync(modelPath);
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return {
        accessors: readRecords(document.accessors, 'accessors'),
        materials: readRecords(document.materials, 'materials'),
        meshes: readRecords(document.meshes, 'meshes'),
    };
}

function readBounds(
    document: ReturnType<typeof readGlbDocument>,
    meshName: string,
    materialName: string,
): Bounds {
    const materialIndex = document.materials.findIndex(
        (material) => isRecord(material) && material.name === materialName,
    );
    assert.notEqual(materialIndex, -1, `Missing material ${materialName}`);
    const mesh = document.meshes.find(
        (candidate) => isRecord(candidate) && candidate.name === meshName,
    );
    assert.ok(isRecord(mesh), `Missing mesh ${meshName}`);
    assert.ok(Array.isArray(mesh.primitives));
    const primitive = mesh.primitives.find(
        (candidate) =>
            isRecord(candidate) && candidate.material === materialIndex,
    );
    assert.ok(
        isRecord(primitive),
        `${meshName} has no ${materialName} primitive`,
    );
    assert.ok(isRecord(primitive.attributes));
    const positionAccessor = primitive.attributes.POSITION;
    assert.ok(typeof positionAccessor === 'number');
    const accessor = document.accessors[positionAccessor];
    assert.ok(isRecord(accessor));
    return {
        maximum: readVector(accessor.max),
        minimum: readVector(accessor.min),
    };
}

function readMaterialVertexCount(
    document: ReturnType<typeof readGlbDocument>,
    materialName: string,
) {
    const materialIndex = document.materials.findIndex(
        (material) => material.name === materialName,
    );
    assert.notEqual(materialIndex, -1, `Missing material ${materialName}`);

    let count = 0;
    for (const mesh of document.meshes) {
        const primitives = readRecords(mesh.primitives, 'mesh primitives');
        for (const primitive of primitives) {
            if (primitive.material !== materialIndex) {
                continue;
            }
            assert.ok(isRecord(primitive.attributes));
            const positionAccessor = primitive.attributes.POSITION;
            if (typeof positionAccessor !== 'number') {
                assert.fail('POSITION accessor is not numeric');
            }
            const accessor = document.accessors[positionAccessor];
            assert.ok(isRecord(accessor));
            const accessorCount = accessor.count;
            if (typeof accessorCount !== 'number') {
                assert.fail('POSITION accessor count is not numeric');
            }
            count += accessorCount;
        }
    }
    return count;
}

function readVector(value: unknown): [number, number, number] {
    assert.ok(Array.isArray(value));
    assert.equal(value.length, 3);
    const [x, y, z] = value;
    assert.equal(typeof x, 'number');
    assert.equal(typeof y, 'number');
    assert.equal(typeof z, 'number');
    return [x, y, z];
}

function assertVectorClose(
    actual: [number, number, number],
    expected: [number, number, number],
) {
    for (const [index, value] of actual.entries()) {
        assert.ok(
            Math.abs(value - expected[index]) < 0.000_01,
            `Channel ${index} differs: ${value} != ${expected[index]}`,
        );
    }
}

describe('timber asset proportions', () => {
    it('keeps the approved low-poly bevel topology on older timber models', () => {
        const expectedWoodVertexCounts = {
            Bucket: 381,
            Composter: 388,
            Fence: 1026,
            GardenBox: 984,
            RaisedBed: 425,
            Shade: 2467,
            Stool: 271,
            WaterWell: 5005,
        } satisfies Record<string, number>;

        for (const [assetName, expectedCount] of Object.entries(
            expectedWoodVertexCounts,
        )) {
            assert.equal(
                readMaterialVertexCount(
                    readGlbDocument(assetName),
                    'Material.Planks',
                ),
                expectedCount,
                `${assetName} bevel topology drifted`,
            );
        }
    });

    it('keeps the raised-bed footprint while enlarging soil for narrower planks', () => {
        const document = readGlbDocument('RaisedBed');
        const outer = readBounds(document, 'Raised Bed O', 'Material.Planks');
        const soil = readBounds(document, 'Raised Bed O', 'Material.Dirt');

        assertVectorClose(outer.minimum, [-0.5, -1, -0.5]);
        assertVectorClose(outer.maximum, [0.5, -0.7, 0.5]);
        assertVectorClose(soil.minimum, [-0.42, -1, -0.42]);
        assertVectorClose(soil.maximum, [0.42, -0.75, 0.42]);
    });

    it('keeps connected raised-bed soil flush with every open edge', () => {
        const document = readGlbDocument('RaisedBed');
        const expected: Record<string, Bounds> = {
            'Raised Bed I': {
                maximum: [0.42, -0.75, 0.5],
                minimum: [-0.42, -1, -0.5],
            },
            'Raised Bed L': {
                maximum: [0.5, -0.75, 0.42],
                minimum: [-0.42, -1, -0.5],
            },
            'Raised Bed U': {
                maximum: [0.5, -0.75, 0.42],
                minimum: [-0.42, -1, -0.42],
            },
        };

        for (const [meshName, bounds] of Object.entries(expected)) {
            const soil = readBounds(document, meshName, 'Material.Dirt');
            assertVectorClose(soil.minimum, bounds.minimum);
            assertVectorClose(soil.maximum, bounds.maximum);
        }
    });

    it('keeps the smaller stool grounded with a 0.64-unit footprint', () => {
        const document = readGlbDocument('Stool');
        const stool = readBounds(document, 'Stool', 'Material.Planks');

        assertVectorClose(stool.minimum, [-0.32, -1.02173, -0.32]);
        assertVectorClose(stool.maximum, [0.32, -0.642588, 0.32]);
    });
});
