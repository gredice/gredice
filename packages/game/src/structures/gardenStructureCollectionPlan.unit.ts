import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    createGardenStructureTemplateSeed,
    type GardenStructureDocumentV1,
    type GardenStructureRotation,
    type GardenStructureTemplateKey,
} from '@gredice/js/gardenStructures';
import { getGardenAvatarCollisionCandidates } from '../entities/avatar/gardenAvatarMovement';
import {
    compileGardenStructurePlan,
    compileSavedGardenStructureCollection,
    containsGardenStructureWorldCell,
    createGardenStructureCollectionAvatarCollisionWorld,
    createGardenStructureCollectionPlan,
    debugGardenStructureKitMetadata,
    decodeSavedGardenStructureRecord,
    GardenStructureCollectionCache,
    type GardenStructureCollectionCacheDisposalReason,
    type GardenStructureCollectionPlan,
    type GardenStructureKitMetadata,
    type GardenStructurePropPartMetadata,
    gardenStructureCollectionTransformStride,
    getNearbyGardenStructureCollectionBuckets,
    getVisibleGardenStructureIds,
    resolveGardenStructureCollectionSpatialEntry,
    resolveGardenStructureRuntimeKit,
    type SerializedGardenStructureRecord,
} from './index';

function kitWithTableMetadata(
    overrides: Partial<GardenStructurePropPartMetadata>,
): GardenStructureKitMetadata {
    const table = debugGardenStructureKitMetadata.propParts['prop.table'];
    assert.ok(table);
    return Object.freeze({
        ...debugGardenStructureKitMetadata,
        propParts: Object.freeze({
            ...debugGardenStructureKitMetadata.propParts,
            'prop.table': Object.freeze({ ...table, ...overrides }),
        }),
    });
}

function savedStructure(
    templateKey: GardenStructureTemplateKey,
    id: string,
    options: Partial<SerializedGardenStructureRecord> = {},
): SerializedGardenStructureRecord {
    const seed = createGardenStructureTemplateSeed(templateKey);
    return {
        id,
        revision: 1,
        anchorX: 0,
        anchorY: 0,
        rotation: 0,
        kitKey: seed.kitKey,
        kitVersion: seed.kitVersion,
        document: seed.document,
        deleted: false,
        ...options,
    };
}

function batchSnapshot(plan: GardenStructureCollectionPlan) {
    return [
        ...plan.batches.opaque,
        ...plan.batches.transparent,
        ...plan.batches.roof,
        ...plan.batches.props,
    ].map((batch) => ({
        id: batch.id,
        instanceIds: batch.instanceIds,
        structureIds: batch.structureIds,
        transforms: [...batch.transforms],
    }));
}

describe('saved garden structure runtime adapter', () => {
    test('decodes a serialized record against the immutable kit definition', () => {
        const result = decodeSavedGardenStructureRecord(
            savedStructure('house', 'saved-house', {
                anchorX: 7,
                anchorY: -2,
                rotation: 3,
                revision: 8,
            }),
            { resolveBaseHeight: () => 0.25 },
        );

        assert.equal(result.valid, true);
        if (!result.valid) {
            return;
        }
        assert.equal(result.input.structureId, 'saved-house');
        assert.equal(result.input.revision, 8);
        assert.deepEqual(result.input.placement, {
            anchorX: 7,
            anchorY: -2,
            rotation: 3,
        });
        assert.equal(result.input.baseHeight, 0.25);
        assert.equal(result.input.kit.kitKey, 'gredice-buildings');
        assert.equal(Object.isFrozen(result.input.document), true);
        assert.equal(
            Object.isFrozen(result.input.document.footprint.cells),
            true,
        );
    });

    test('fails closed for unknown kits, invalid references, deletion, and malformed records', () => {
        const unknownKit = decodeSavedGardenStructureRecord(
            savedStructure('barn', 'unknown-kit', { kitVersion: '404' }),
        );
        assert.equal(unknownKit.valid, false);
        assert.equal(unknownKit.issues[0]?.code, 'kit-unavailable');

        const seed = createGardenStructureTemplateSeed('house');
        const invalidReference: GardenStructureDocumentV1 = {
            ...seed.document,
            floors: seed.document.floors.map((floor, index) =>
                index === 0
                    ? { ...floor, materialId: 'floor.unpublished' }
                    : floor,
            ),
        };
        const invalidDocument = decodeSavedGardenStructureRecord(
            savedStructure('house', 'invalid-part', {
                document: invalidReference,
            }),
        );
        assert.equal(invalidDocument.valid, false);
        assert.ok(
            invalidDocument.issues.some(
                ({ code }) => code === 'invalid-part-reference',
            ),
        );

        const deleted = decodeSavedGardenStructureRecord(
            savedStructure('barn', 'deleted', { deleted: true }),
        );
        assert.equal(deleted.valid, false);
        assert.ok(deleted.issues.some(({ code }) => code === 'deleted-record'));

        const malformed = decodeSavedGardenStructureRecord({
            id: 'malformed',
        });
        assert.equal(malformed.valid, false);
        assert.ok(malformed.issues.length > 1);

        const immutableDefinition = resolveGardenStructureRuntimeKit(
            'gredice-buildings',
            '1',
        );
        assert.ok(immutableDefinition);
        const mutableKit = decodeSavedGardenStructureRecord(
            savedStructure('barn', 'mutable-kit'),
            {
                resolveKit: () => ({
                    ...immutableDefinition,
                    metadata: { ...immutableDefinition.metadata },
                }),
            },
        );
        assert.equal(mutableKit.valid, false);
        assert.equal(mutableKit.issues[0]?.code, 'kit-metadata-incomplete');
    });
});

describe('garden structure collection plans', () => {
    test('separates batches for distinct same-identity kit definitions', () => {
        const document = createGardenStructureTemplateSeed('house').document;
        const narrowKit = kitWithTableMetadata({ collisionWidth: 0.7 });
        const wideKit = kitWithTableMetadata({ collisionWidth: 0.71 });
        const narrowPlan = compileGardenStructurePlan({
            structureId: 'narrow-table',
            revision: 1,
            document,
            placement: { anchorX: 0, anchorY: 0, rotation: 0 },
            kit: narrowKit,
        });
        const widePlan = compileGardenStructurePlan({
            structureId: 'wide-table',
            revision: 1,
            document,
            placement: { anchorX: 5, anchorY: 0, rotation: 0 },
            kit: wideKit,
        });

        assert.notEqual(
            narrowPlan.kitDefinitionFingerprint,
            widePlan.kitDefinitionFingerprint,
        );
        assert.throws(
            () =>
                createGardenStructureCollectionPlan([
                    { kit: wideKit, plan: narrowPlan },
                ]),
            /compiled immutable kit definition/u,
        );

        const collection = createGardenStructureCollectionPlan([
            { kit: narrowKit, plan: narrowPlan },
            { kit: wideKit, plan: widePlan },
        ]);
        const tableBatches = collection.batches.props.filter(
            ({ geometryId }) => geometryId === 'prop.table',
        );

        assert.equal(tableBatches.length, 2);
        assert.deepEqual(
            tableBatches
                .map(({ fallbackGeometry }) => fallbackGeometry.width)
                .sort((left, right) => left - right),
            [0.7, 0.71],
        );
        assert.equal(
            new Set(
                tableBatches.map(
                    ({ kitDefinitionFingerprint }) => kitDefinitionFingerprint,
                ),
            ).size,
            2,
        );
        assert.deepEqual(
            new Set(tableBatches.flatMap(({ structureIds }) => structureIds)),
            new Set(['narrow-table', 'wide-table']),
        );
        assert.ok(
            tableBatches.every(
                ({ structureIds }) => new Set(structureIds).size === 1,
            ),
        );
    });

    test('renders an empty valid structure as a semantic footprint fallback', () => {
        const result = compileSavedGardenStructureCollection([
            savedStructure('blank', 'blank-fallback', {
                anchorX: 4,
                anchorY: 6,
            }),
        ]);
        const semanticBatch = result.plan.batches.transparent.find(
            ({ geometryId }) => geometryId === 'semantic-footprint',
        );

        assert.ok(semanticBatch);
        assert.equal(semanticBatch.instanceIds.length, 4);
        assert.deepEqual(
            [...new Set(semanticBatch.structureIds)],
            ['blank-fallback'],
        );
        assert.equal(semanticBatch.fallbackGeometry.kind, 'box');
        assert.deepEqual(
            Array.from(semanticBatch.transforms),
            [4, 6, 0, 0, 5, 6, 0, 0, 4, 7, 0, 0, 5, 7, 0, 0],
        );
    });

    test('keeps an open-portal-only structure visible through its open-door asset batch', () => {
        const seed = createGardenStructureTemplateSeed('blank');
        const result = compileSavedGardenStructureCollection([
            savedStructure('blank', 'portal-only-fallback', {
                document: {
                    ...seed.document,
                    edges: [
                        {
                            id: 'only-open-portal',
                            from: { x: 0, y: 0 },
                            direction: 'north',
                            partId: 'door.timber-wide-open',
                            kind: 'door',
                        },
                    ],
                },
            }),
        ]);
        const openDoorBatch = result.plan.batches.opaque.find(
            ({ geometryId }) => geometryId === 'door.timber-wide-open',
        );

        assert.equal(result.rejectedRecords.length, 0);
        assert.ok(openDoorBatch);
        assert.deepEqual(openDoorBatch.instanceIds, [
            'edge:portal-only-fallback:only-open-portal',
        ]);
        assert.equal(
            batchSnapshot(result.plan).some(({ instanceIds }) =>
                instanceIds.includes(
                    'edge:portal-only-fallback:only-open-portal',
                ),
            ),
            true,
        );
        assert.equal(
            result.plan.batches.transparent.some(
                ({ geometryId }) => geometryId === 'semantic-footprint',
            ),
            false,
        );
    });

    test('is stable across source order and batches compatible instances across structures', () => {
        const house = savedStructure('house', 'b-house', {
            anchorX: 10,
            anchorY: 3,
            rotation: 1,
        });
        const barn = savedStructure('barn', 'a-barn', {
            anchorX: -4,
            anchorY: 8,
            rotation: 2,
        });

        const forward = compileSavedGardenStructureCollection([house, barn]);
        const reverse = compileSavedGardenStructureCollection([barn, house]);

        assert.equal(forward.plan.cacheKey, reverse.plan.cacheKey);
        assert.deepEqual(
            forward.plan.structures.map(({ structureId }) => structureId),
            ['a-barn', 'b-house'],
        );
        assert.deepEqual(
            batchSnapshot(forward.plan),
            batchSnapshot(reverse.plan),
        );
        assert.equal(
            batchSnapshot(forward.plan).some(({ instanceIds }) =>
                instanceIds.includes('edge:b-house:door-main'),
            ),
            true,
        );
        assert.ok(
            batchSnapshot(forward.plan).some(
                ({ structureIds }) => new Set(structureIds).size > 1,
            ),
        );
        assert.deepEqual(
            [
                ...getVisibleGardenStructureIds(
                    forward.plan,
                    (bounds) => bounds.maxX < 5,
                ),
            ],
            ['a-barn'],
        );
        for (const batch of [
            ...forward.plan.batches.opaque,
            ...forward.plan.batches.transparent,
            ...forward.plan.batches.roof,
            ...forward.plan.batches.props,
        ]) {
            assert.equal(
                batch.transforms.length,
                batch.instanceIds.length *
                    gardenStructureCollectionTransformStride,
            );
            assert.equal(batch.instanceIds.length, batch.structureIds.length);
            assert.equal(batch.fallbackGeometry.kind, 'box');
        }
    });

    test('keeps material batches spatially local for whole-chunk frustum culling', () => {
        const result = compileSavedGardenStructureCollection([
            savedStructure('house', 'far-west', { anchorX: -96 }),
            savedStructure('house', 'far-east', { anchorX: 96 }),
        ]);
        const batches = [
            ...result.plan.batches.opaque,
            ...result.plan.batches.transparent,
            ...result.plan.batches.roof,
            ...result.plan.batches.props,
        ];

        assert.ok(batches.length > 0);
        assert.ok(
            batches.every((batch) => new Set(batch.structureIds).size === 1),
        );
        assert.deepEqual(
            new Set(batches.flatMap((batch) => batch.structureIds)),
            new Set(['far-east', 'far-west']),
        );
    });

    test('preserves a rotated concave footprint and exposes nearby semantic buckets', () => {
        const document: GardenStructureDocumentV1 = {
            schemaVersion: 1,
            footprint: {
                cells: [
                    { x: 0, y: 0, spaceKind: 'interior' },
                    { x: 1, y: 0, spaceKind: 'interior' },
                    { x: 0, y: 1, spaceKind: 'covered-outdoor' },
                ],
            },
            floors: [
                { cell: { x: 0, y: 0 }, materialId: 'floor.timber' },
                { cell: { x: 1, y: 0 }, materialId: 'floor.timber' },
            ],
            edges: [],
            roofRegions: [
                {
                    id: 'roof-l',
                    cells: [
                        { x: 0, y: 0 },
                        { x: 1, y: 0 },
                        { x: 0, y: 1 },
                    ],
                    styleId: 'roof.gable',
                    materialId: 'roof.clay',
                    rotation: 0,
                },
            ],
            props: [],
        };
        const rotations: readonly GardenStructureRotation[] = [0, 1, 2, 3];
        const missingCells = [
            { x: 6, y: 8 },
            { x: 5, y: 8 },
            { x: 5, y: 7 },
            { x: 6, y: 7 },
        ];
        for (const rotation of rotations) {
            const rotated = compileSavedGardenStructureCollection([
                savedStructure('blank', `concave-${rotation.toString()}`, {
                    anchorX: 5,
                    anchorY: 7,
                    document,
                    rotation,
                }),
            ]).plan.structures[0];
            const missing = missingCells[rotation];
            assert.ok(rotated && missing);
            assert.equal(rotated.counts.footprintCells, 3);
            assert.equal(
                containsGardenStructureWorldCell(rotated, missing.x, missing.y),
                false,
            );
        }

        const result = compileSavedGardenStructureCollection([
            savedStructure('blank', 'concave', {
                anchorX: 5,
                anchorY: 7,
                document,
                rotation: 1,
            }),
        ]);
        const structure = result.plan.structures[0];
        assert.ok(structure);
        assert.equal(containsGardenStructureWorldCell(structure, 5, 7), true);
        assert.equal(containsGardenStructureWorldCell(structure, 6, 7), true);
        assert.equal(containsGardenStructureWorldCell(structure, 6, 8), true);
        assert.equal(containsGardenStructureWorldCell(structure, 5, 8), false);

        const nearby = getNearbyGardenStructureCollectionBuckets(
            result.plan,
            5,
            7,
            0,
        );
        assert.equal(nearby.length, 1);
        const resolved = nearby[0]?.entries.map((entry) =>
            resolveGardenStructureCollectionSpatialEntry(result.plan, entry),
        );
        assert.equal(resolved?.[0]?.structure.structureId, 'concave');
        assert.equal(resolved?.[0]?.bucket.key, '5|7');
    });

    test('isolates invalid and duplicate records without rendering partial data', () => {
        const valid = savedStructure('barn', 'valid');
        const unknownKit = savedStructure('house', 'unknown', {
            kitVersion: 'missing',
        });
        const duplicate = savedStructure('greenhouse', 'valid', {
            anchorX: 8,
        });

        const result = compileSavedGardenStructureCollection([
            valid,
            unknownKit,
            duplicate,
        ]);

        assert.equal(result.plan.structures.length, 0);
        assert.deepEqual(
            result.rejectedRecords.map(({ structureId }) => structureId),
            ['unknown', 'valid', 'valid'],
        );
        assert.equal(result.plan.worldBounds, null);
    });

    test('rejects a collection beyond its explicit defensive record bound', () => {
        assert.throws(
            () =>
                compileSavedGardenStructureCollection(
                    [
                        savedStructure('barn', 'bounded-one'),
                        savedStructure('house', 'bounded-two'),
                    ],
                    { maxStructureCount: 1 },
                ),
            /at most 1 records/u,
        );
    });
});

describe('garden structure collection cache lifecycle', () => {
    test('reuses stable plans and disposes replacements, evictions, and clear', () => {
        const disposals: Array<{
            key: string;
            reason: GardenStructureCollectionCacheDisposalReason;
        }> = [];
        const cache = new GardenStructureCollectionCache({
            maxCollectionEntryCount: 1,
            maxCollectionEstimatedBytes: 64 * 1024 * 1024,
            dispose: (plan, reason) =>
                disposals.push({ key: plan.cacheKey, reason }),
        });
        const first = cache.getOrCompile([
            savedStructure('barn', 'first-cache'),
        ]);
        const firstAgain = cache.getOrCompile([
            savedStructure('barn', 'first-cache'),
        ]);
        assert.equal(firstAgain.plan, first.plan);
        assert.equal(cache.snapshot().hitCount, 1);

        const collisionReplacement = Object.freeze({
            ...first.plan,
            structurePlanKeys: Object.freeze([
                ...first.plan.structurePlanKeys,
                'simulated-fingerprint-collision',
            ]),
        });
        cache.set(collisionReplacement);
        assert.equal(disposals.at(-1)?.reason, 'replaced');

        const second = cache.getOrCompile([
            savedStructure('house', 'second-cache'),
        ]);
        assert.notEqual(second.plan.cacheKey, first.plan.cacheKey);
        assert.equal(disposals.at(-1)?.reason, 'evicted');
        assert.equal(cache.snapshot().entryCount, 1);

        cache.clear();
        assert.equal(disposals.at(-1)?.reason, 'cleared');
        assert.equal(cache.snapshot().entryCount, 0);
        assert.equal(cache.snapshot().estimatedBytes, 0);
    });
});

describe('garden structure collection collision aggregation', () => {
    test('builds one bounded spatial world for owned/public avatar consumers', () => {
        const result = compileSavedGardenStructureCollection([
            savedStructure('house', 'near-house', {
                anchorX: 0,
                anchorY: 0,
                rotation: 3,
            }),
            savedStructure('barn', 'far-barn', {
                anchorX: 30,
                anchorY: 30,
                rotation: 2,
            }),
        ]);
        const world = createGardenStructureCollectionAvatarCollisionWorld(
            result.plan,
        );

        const near = getGardenAvatarCollisionCandidates(world, {
            x: 0,
            z: 0,
        });
        const far = getGardenAvatarCollisionCandidates(world, {
            x: 30,
            z: 30,
        });
        assert.ok(near.surfaces.length > 0);
        assert.ok(far.surfaces.length > 0);
        assert.equal(
            near.surfaces.some((surface) =>
                surface.debugLabel?.includes('far-barn'),
            ),
            false,
        );
        assert.equal(
            far.surfaces.some((surface) =>
                surface.debugLabel?.includes('near-house'),
            ),
            false,
        );
        assert.ok(near.surfaces.length < world.surfaces.length);
        assert.ok(far.surfaces.length < world.surfaces.length);
    });
});
