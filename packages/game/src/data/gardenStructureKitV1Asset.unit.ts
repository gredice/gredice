import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    gardenStructureKitV1AssetManifest,
    getGardenStructureKitV1NodeNames,
    validateGardenStructureKitV1Manifest,
} from '../structures/gardenStructureKitV1Manifest';
import {
    allGameAssetNames,
    gameAssetModels,
    lazyGameAssetNames,
} from './gameAssetModels.generated';

type JsonRecord = Record<string, unknown>;

const assetManifestPath = fileURLToPath(
    new URL('../../../../assets/game-assets.json', import.meta.url),
);
const generatorPath = fileURLToPath(
    new URL(
        '../../../../assets/scripts/generate-garden-structure-kit-v1.py',
        import.meta.url,
    ),
);
const sourcePath = fileURLToPath(
    new URL(
        '../../../../assets/game-assets/GardenStructureKitV1.blend',
        import.meta.url,
    ),
);
const modelPath = fileURLToPath(
    new URL(
        '../../../../apps/garden/public/assets/models/GardenStructureKitV1.glb',
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

function strings(value: unknown, label: string) {
    assert.ok(Array.isArray(value), `${label} must be an array`);
    return value.map((item, index) => {
        if (typeof item !== 'string') {
            assert.fail(`${label}[${index}] must be a string`);
        }
        return item;
    });
}

function numeric(value: unknown, label: string) {
    if (typeof value !== 'number') {
        assert.fail(`${label} must be numeric`);
    }
    return value;
}

function numericArray(value: unknown, label: string) {
    assert.ok(Array.isArray(value), `${label} must be an array`);
    assert.equal(value.length, 3, `${label} must have three channels`);
    return value.map((item, index) => numeric(item, `${label}[${index}]`));
}

function readGlbDocument() {
    const model = readFileSync(modelPath);
    assert.equal(model.subarray(0, 4).toString('utf8'), 'glTF');
    const jsonLength = model.readUInt32LE(12);
    const document: unknown = JSON.parse(
        model.subarray(20, 20 + jsonLength).toString('utf8'),
    );
    assert.ok(isRecord(document));
    return { document, model };
}

function sortedNames(value: unknown, label: string) {
    return records(value, label)
        .map((item, index) => {
            if (typeof item.name !== 'string') {
                assert.fail(`${label}[${index}].name must be a string`);
            }
            return item.name;
        })
        .toSorted((left, right) => left.localeCompare(right));
}

function deepFrozen(value: unknown, seen = new Set<unknown>()): boolean {
    if (
        (typeof value !== 'object' && typeof value !== 'function') ||
        value === null
    ) {
        return true;
    }
    if (seen.has(value)) return true;
    seen.add(value);
    return (
        Object.isFrozen(value) &&
        Object.values(value).every((child) => deepFrozen(child, seen))
    );
}

function getNodeBindings() {
    const manifest = gardenStructureKitV1AssetManifest;
    return [
        ...Object.values(manifest.floorParts),
        ...Object.values(manifest.edgeParts),
        ...Object.values(manifest.roofStyles),
        ...Object.values(manifest.propParts),
    ].flatMap(({ nodes }) => nodes);
}

function getNodeBounds(document: JsonRecord, nodeName: string) {
    const nodes = records(document.nodes, 'nodes');
    const meshes = records(document.meshes, 'meshes');
    const accessors = records(document.accessors, 'accessors');
    const node = nodes.find((candidate) => candidate.name === nodeName);
    assert.ok(node, `Missing node ${nodeName}`);
    assert.equal(node.translation, undefined, `${nodeName} translation`);
    assert.equal(node.rotation, undefined, `${nodeName} rotation`);
    assert.equal(node.scale, undefined, `${nodeName} scale`);
    assert.equal(node.matrix, undefined, `${nodeName} matrix`);
    const meshIndex = numeric(node.mesh, `${nodeName}.mesh`);
    const mesh = meshes[meshIndex];
    assert.ok(mesh, `Missing mesh ${meshIndex}`);
    const primitives = records(mesh.primitives, `${nodeName}.primitives`);
    const minimum = [
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
    ];
    const maximum = [
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
    ];

    for (const [primitiveIndex, primitive] of primitives.entries()) {
        assert.ok(isRecord(primitive.attributes));
        const accessorIndex = numeric(
            primitive.attributes.POSITION,
            `${nodeName}.primitives[${primitiveIndex}].POSITION`,
        );
        const accessor = accessors[accessorIndex];
        assert.ok(accessor, `Missing accessor ${accessorIndex}`);
        const accessorMinimum = numericArray(
            accessor.min,
            `${nodeName}.accessor.minimum`,
        );
        const accessorMaximum = numericArray(
            accessor.max,
            `${nodeName}.accessor.maximum`,
        );
        for (const axis of [0, 1, 2]) {
            minimum[axis] = Math.min(
                minimum[axis] ?? Number.POSITIVE_INFINITY,
                accessorMinimum[axis] ?? Number.POSITIVE_INFINITY,
            );
            maximum[axis] = Math.max(
                maximum[axis] ?? Number.NEGATIVE_INFINITY,
                accessorMaximum[axis] ?? Number.NEGATIVE_INFINITY,
            );
        }
    }

    // Blender exports +Z-up source coordinates into glTF +Y-up coordinates;
    // source +Y (front) becomes glTF -Z.
    return {
        maximum: [maximum[0], -minimum[2], maximum[1]],
        minimum: [minimum[0], -maximum[2], minimum[1]],
    };
}

function getNodeMaterialNames(document: JsonRecord, nodeName: string) {
    const nodes = records(document.nodes, 'nodes');
    const meshes = records(document.meshes, 'meshes');
    const materials = records(document.materials, 'materials');
    const node = nodes.find((candidate) => candidate.name === nodeName);
    assert.ok(node, `Missing node ${nodeName}`);
    const mesh = meshes[numeric(node.mesh, `${nodeName}.mesh`)];
    assert.ok(mesh);
    return [
        ...new Set(
            records(mesh.primitives, `${nodeName}.primitives`).map(
                (primitive, index) => {
                    const material =
                        materials[
                            numeric(
                                primitive.material,
                                `${nodeName}.primitives[${index}].material`,
                            )
                        ];
                    assert.ok(material);
                    if (typeof material.name !== 'string') {
                        assert.fail(`${nodeName} material must have a name`);
                    }
                    return material.name;
                },
            ),
        ),
    ].toSorted((left, right) => left.localeCompare(right));
}

function countTriangles(document: JsonRecord) {
    const accessors = records(document.accessors, 'accessors');
    return records(document.meshes, 'meshes').reduce(
        (meshTotal, mesh, meshIndex) =>
            meshTotal +
            records(mesh.primitives, `meshes[${meshIndex}].primitives`).reduce(
                (primitiveTotal, primitive, primitiveIndex) => {
                    const accessor =
                        accessors[
                            numeric(
                                primitive.indices,
                                `meshes[${meshIndex}].primitives[${primitiveIndex}].indices`,
                            )
                        ];
                    assert.ok(accessor);
                    return (
                        primitiveTotal +
                        numeric(accessor.count, 'index accessor count') / 3
                    );
                },
                0,
            ),
        0,
    );
}

describe('GardenStructureKitV1 production asset', () => {
    test('keeps the renderer-free semantic manifest immutable and valid', () => {
        const first = validateGardenStructureKitV1Manifest();
        const second = validateGardenStructureKitV1Manifest();

        assert.deepEqual(first, []);
        assert.deepEqual(second, first);
        assert.equal(deepFrozen(gardenStructureKitV1AssetManifest), true);

        const source = readFileSync(
            fileURLToPath(
                new URL(
                    '../structures/gardenStructureKitV1Manifest.ts',
                    import.meta.url,
                ),
            ),
            'utf8',
        );
        assert.doesNotMatch(
            source,
            /(?:from|import\()\s*['"](?:three|react|@react-three)/,
        );
    });

    test('rejects semantic material and edge collision drift', () => {
        const manifest = gardenStructureKitV1AssetManifest;
        const malformedManifest = {
            ...manifest,
            edgeParts: {
                ...manifest.edgeParts,
                'door.greenhouse-open': {
                    ...manifest.edgeParts['door.greenhouse-open'],
                    collisionHeight: 3,
                    collisionThickness: 2,
                },
            },
            materials: {
                ...manifest.materials,
                'floor.timber': {
                    ...manifest.materials['floor.timber'],
                    nodeMaterialNames: [
                        ...(manifest.materials['floor.timber']
                            ?.nodeMaterialNames ?? []),
                        'Material.GardenStructureKitV1.DarkWood',
                    ],
                },
            },
        };

        const issues = validateGardenStructureKitV1Manifest(malformedManifest);
        assert.ok(
            issues.some(
                ({ code, path }) =>
                    code === 'material-reference' &&
                    path === 'materials.floor.timber',
            ),
        );
        assert.ok(
            issues.some(
                ({ code, path }) =>
                    code === 'collision' &&
                    path === 'edgeParts.door.greenhouse-open',
            ),
        );
    });

    test('matches the editable source, lazy registry, and pinned GLB hash', () => {
        const { document, model } = readGlbDocument();
        const assetManifest: unknown = JSON.parse(
            readFileSync(assetManifestPath, 'utf8'),
        );
        assert.ok(isRecord(assetManifest));
        const asset = records(assetManifest.assets, 'asset manifest').find(
            (candidate) => candidate.name === 'GardenStructureKitV1',
        );
        assert.ok(asset);

        const version = createHash('sha256')
            .update(model)
            .digest('hex')
            .slice(0, 12);
        const expectedNodes = getGardenStructureKitV1NodeNames();

        assert.equal(asset.source, 'GardenStructureKitV1.blend');
        assert.equal(asset.output, 'GardenStructureKitV1.glb');
        assert.equal(asset.preload, 'lazy');
        assert.equal(asset.version, version);
        assert.deepEqual(
            strings(asset.objects, 'asset.objects').toSorted((left, right) =>
                left.localeCompare(right),
            ),
            expectedNodes,
        );
        assert.deepEqual(sortedNames(document.nodes, 'nodes'), expectedNodes);
        assert.equal(existsSync(sourcePath), true);
        assert.equal(existsSync(generatorPath), true);
        assert.ok(statSync(sourcePath).size <= 260_000);
        assert.ok(model.length <= 600_000);
        assert.equal(
            gameAssetModels.GardenStructureKitV1.url,
            `/assets/models/GardenStructureKitV1.glb?v=${version}`,
        );
        assert.ok(lazyGameAssetNames.includes('GardenStructureKitV1'));
        assert.ok(allGameAssetNames.includes('GardenStructureKitV1'));
    });

    test('keeps node pivots, bounds, materials, and glass paths synchronized', () => {
        const { document } = readGlbDocument();
        const manifest = gardenStructureKitV1AssetManifest;
        const bindings = getNodeBindings();

        assert.equal(bindings.length, 23);
        assert.equal(countTriangles(document), 6_064);
        assert.deepEqual(
            sortedNames(document.materials, 'materials'),
            Object.keys(manifest.nodeMaterials).toSorted((left, right) =>
                left.localeCompare(right),
            ),
        );

        for (const binding of bindings) {
            assert.deepEqual(
                getNodeMaterialNames(document, binding.nodeName),
                [...binding.nodeMaterialNames].toSorted((left, right) =>
                    left.localeCompare(right),
                ),
            );
        }

        const parts = [
            ...Object.values(manifest.floorParts),
            ...Object.values(manifest.edgeParts),
            ...Object.values(manifest.roofStyles),
            ...Object.values(manifest.propParts),
        ];
        for (const part of parts) {
            for (const binding of part.nodes) {
                const actual = getNodeBounds(document, binding.nodeName);
                for (const axis of [0, 1, 2]) {
                    assert.ok(
                        (actual.minimum[axis] ?? 0) >=
                            (part.bounds.minimum[axis] ?? 0) - 0.000_1,
                        `${binding.nodeName} minimum axis ${axis}`,
                    );
                    assert.ok(
                        (actual.maximum[axis] ?? 0) <=
                            (part.bounds.maximum[axis] ?? 0) + 0.000_1,
                        `${binding.nodeName} maximum axis ${axis}`,
                    );
                }
            }
        }

        const glassMaterial = records(document.materials, 'materials').find(
            (material) =>
                material.name === 'Material.GardenStructureKitV1.Glass',
        );
        assert.ok(glassMaterial);
        assert.equal(glassMaterial.alphaMode, 'BLEND');
        const glassNodes = bindings
            .filter(({ transparency }) => transparency === 'transparent')
            .map(({ nodeName }) => nodeName);
        assert.deepEqual(glassNodes, [
            'GardenStructureKitV1_WallGreenhouseGlass',
            'GardenStructureKitV1_WindowHouseGlass',
            'GardenStructureKitV1_DoorGreenhouseOpenGlass',
            'GardenStructureKitV1_RoofGreenhouseGableGlass',
        ]);
    });
});
