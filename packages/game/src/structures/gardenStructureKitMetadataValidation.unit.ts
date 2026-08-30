import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import {
    compileGardenStructurePlan,
    compileSavedGardenStructureCollection,
    createGardenStructureAvatarCollisionWorld,
    debugGardenStructureKitMetadata,
    decodeSavedGardenStructureRecord,
    type GardenStructureKitMetadata,
    GardenStructureKitMetadataValidationCache,
    GardenStructurePlanCache,
    type GardenStructurePropPartMetadata,
    GardenStructureSceneCache,
    gardenStructureKitMetadataValidationIssueLimit,
    gardenStructureKitV1Metadata,
    getGardenStructurePlanCacheKey,
    hasFatalGardenStructureKitResolutionIssue,
    resolveGardenStructureRuntimeKit,
    validateGardenStructureDocumentKitMetadata,
    validateGardenStructureKitMetadata,
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

function kitWithInvalidPropEntries(count: number): GardenStructureKitMetadata {
    const table = debugGardenStructureKitMetadata.propParts['prop.table'];
    assert.ok(table);
    const invalidProps = Object.fromEntries(
        Array.from({ length: count }, (_, index) => [
            `prop.invalid-${index.toString()}`,
            Object.freeze({ ...table, collisionWidth: 2 }),
        ]),
    );
    return Object.freeze({
        ...debugGardenStructureKitMetadata,
        propParts: Object.freeze({
            ...debugGardenStructureKitMetadata.propParts,
            ...invalidProps,
        }),
    });
}

function houseInput(kit: GardenStructureKitMetadata, structureId: string) {
    return {
        structureId,
        revision: 1,
        document: createGardenStructureTemplateSeed('house').document,
        placement: { anchorX: 4, anchorY: -2, rotation: 0 as const },
        kit,
    };
}

function savedHouse(id: string) {
    const seed = createGardenStructureTemplateSeed('house');
    return {
        anchorX: 4,
        anchorY: -2,
        deleted: false,
        document: seed.document,
        id,
        kitKey: seed.kitKey,
        kitVersion: seed.kitVersion,
        revision: 1,
        rotation: 0,
    };
}

function allPlanNumbersAreFinite(
    plan: ReturnType<typeof compileGardenStructurePlan>,
) {
    const arrays = [
        plan.footprint.coordinates,
        plan.floors.coordinates,
        plan.walkable.coordinates,
        plan.openPortals.adjacentCells,
        plan.openPortals.segments,
        plan.openPortals.clearances,
        plan.blockedTransitions.adjacentCells,
        plan.blockedTransitions.segments,
        plan.wallCollisionBoxes.bounds,
        plan.propCollisionBoxes.bounds,
        plan.ceilingProxies.bounds,
    ];
    return (
        Object.values(plan.worldBounds).every(Number.isFinite) &&
        arrays.every((array) => [...array].every(Number.isFinite))
    );
}

describe('garden structure runtime kit metadata validation', () => {
    test('accepts and caches the immutable production kit', () => {
        const cache = new GardenStructureKitMetadataValidationCache();
        const first = cache.validate(gardenStructureKitV1Metadata);
        const repeated = cache.validate(gardenStructureKitV1Metadata);
        const plan = compileGardenStructurePlan(
            houseInput(gardenStructureKitV1Metadata, 'production-kit'),
        );

        assert.equal(first.valid, true);
        assert.equal(repeated, first);
        assert.deepEqual(cache.snapshot(), { hitCount: 1, missCount: 1 });
        assert.equal(plan.runtimeSafety.collisionMode, 'semantic');
        assert.equal(plan.runtimeSafety.issueSampleTruncated, false);
        assert.deepEqual(plan.runtimeSafety.issues, []);
        assert.equal(allPlanNumbersAreFinite(plan), true);
        assert.ok(plan.batches.props.length > 0);
    });

    test('turns NaN prop collision metadata into a finite blocked-footprint plan', () => {
        const kit = kitWithTableMetadata({ collisionWidth: Number.NaN });
        const input = houseInput(kit, 'nan-prop');
        const validation = validateGardenStructureDocumentKitMetadata(
            input.document,
            kit,
        );
        const plan = compileGardenStructurePlan(input);
        const collisionWorld = createGardenStructureAvatarCollisionWorld(plan);

        assert.equal(validation.valid, false);
        assert.deepEqual(validation.issues[0], {
            code: 'kit-prop-non-finite',
            path: 'propParts.prop.table.collision',
            message: 'Kit prop collision dimensions must be finite.',
        });
        assert.equal(plan.runtimeSafety.collisionMode, 'blocked-footprint');
        assert.equal(allPlanNumbersAreFinite(plan), true);
        assert.equal(plan.counts.renderBatches, 0);
        assert.equal(plan.counts.propCollisionBoxes, 0);
        assert.equal(collisionWorld.surfaces.length, 0);
        assert.equal(
            collisionWorld.blockedCells.length,
            plan.footprint.ids.length,
        );
        assert.equal(
            getGardenStructurePlanCacheKey(input).includes('NaN'),
            false,
        );
    });

    test('rejects width 2 and huge finite widths before packing or spatial indexing', () => {
        for (const [label, collisionWidth] of [
            ['width-two', 2],
            ['maximum-finite', Number.MAX_VALUE],
        ] as const) {
            const kit = kitWithTableMetadata({ collisionWidth });
            const input = houseInput(kit, label);
            const validation = validateGardenStructureKitMetadata(kit);
            const plan = compileGardenStructurePlan(input);

            assert.equal(validation.valid, false, label);
            assert.ok(
                validation.issues.some(
                    ({ code, message, path }) =>
                        code === 'kit-prop-out-of-cell' &&
                        path === 'propParts.prop.table.collision' &&
                        message.includes('inside its cell'),
                ),
                label,
            );
            assert.equal(
                plan.runtimeSafety.collisionMode,
                'blocked-footprint',
                label,
            );
            assert.equal(allPlanNumbersAreFinite(plan), true, label);
            assert.equal(plan.spatialBuckets.length, plan.footprint.ids.length);
            assert.deepEqual(
                {
                    depth: plan.worldBounds.depth,
                    height: plan.worldBounds.height,
                    width: plan.worldBounds.width,
                },
                {
                    depth: plan.footprint.bounds.depth,
                    height: 0.025,
                    width: plan.footprint.bounds.width,
                },
                label,
            );
        }
    });

    test('fails closed for malformed geometry and missing document metadata', () => {
        const malformedGeometry = Object.freeze({
            ...debugGardenStructureKitMetadata,
            floorThickness: Number.POSITIVE_INFINITY,
        });
        const { 'prop.table': _missingTable, ...remainingProps } =
            debugGardenStructureKitMetadata.propParts;
        const missingDocumentPart = Object.freeze({
            ...debugGardenStructureKitMetadata,
            propParts: Object.freeze(remainingProps),
        });
        const geometryValidation =
            validateGardenStructureKitMetadata(malformedGeometry);
        const referenceValidation = validateGardenStructureDocumentKitMetadata(
            createGardenStructureTemplateSeed('house').document,
            missingDocumentPart,
        );

        assert.ok(
            geometryValidation.issues.some(
                ({ code, message }) =>
                    code === 'kit-geometry-non-finite' &&
                    message.includes('finite'),
            ),
        );
        assert.ok(
            referenceValidation.issues.some(
                ({ code, path }) =>
                    code === 'kit-document-reference-missing' &&
                    path === 'document.props.prop.table',
            ),
        );
        assert.equal(
            compileGardenStructurePlan(
                houseInput(malformedGeometry, 'malformed-geometry'),
            ).runtimeSafety.collisionMode,
            'blocked-footprint',
        );
        assert.equal(
            compileGardenStructurePlan(
                houseInput(missingDocumentPart, 'missing-part'),
            ).runtimeSafety.collisionMode,
            'blocked-footprint',
        );
    });

    test('fails closed for malformed collections, accessors, and hidden referenced entries', () => {
        const malformedCollection = {
            ...debugGardenStructureKitMetadata,
        };
        Object.defineProperty(malformedCollection, 'materials', {
            configurable: false,
            enumerable: true,
            value: Object.freeze([]),
            writable: false,
        });
        const malformedKit = Object.freeze(malformedCollection);
        const malformedValidation =
            validateGardenStructureKitMetadata(malformedKit);

        let accessorReadCount = 0;
        const accessorMetadata = {
            ...debugGardenStructureKitMetadata,
        };
        Object.defineProperty(accessorMetadata, 'propParts', {
            configurable: false,
            enumerable: true,
            get: () => {
                accessorReadCount += 1;
                return debugGardenStructureKitMetadata.propParts;
            },
        });
        const accessorKit = Object.freeze(accessorMetadata);
        const accessorPlan = compileGardenStructurePlan(
            houseInput(accessorKit, 'accessor-kit'),
        );

        const table = debugGardenStructureKitMetadata.propParts['prop.table'];
        assert.ok(table);
        const hiddenPropParts = {
            ...debugGardenStructureKitMetadata.propParts,
        };
        Object.defineProperty(hiddenPropParts, 'prop.table', {
            configurable: false,
            enumerable: false,
            value: Object.freeze({
                ...table,
                collisionWidth: Number.NaN,
            }),
            writable: false,
        });
        const hiddenEntryKit = Object.freeze({
            ...debugGardenStructureKitMetadata,
            propParts: Object.freeze(hiddenPropParts),
        });
        const hiddenEntryInput = houseInput(hiddenEntryKit, 'hidden-entry-kit');
        const hiddenEntryValidation =
            validateGardenStructureDocumentKitMetadata(
                hiddenEntryInput.document,
                hiddenEntryKit,
            );
        const hiddenEntryPlan = compileGardenStructurePlan(hiddenEntryInput);

        assert.ok(
            malformedValidation.issues.some(
                ({ code, path }) =>
                    code === 'kit-metadata-collection-invalid' &&
                    path === 'materials',
            ),
        );
        assert.equal(accessorReadCount, 0);
        assert.ok(
            accessorPlan.runtimeSafety.issues.some(
                ({ code, path }) =>
                    code === 'kit-metadata-unreadable' &&
                    path === 'kit.propParts',
            ),
        );
        assert.equal(
            accessorPlan.runtimeSafety.collisionMode,
            'blocked-footprint',
        );
        assert.ok(
            hiddenEntryValidation.issues.some(
                ({ code, path }) =>
                    code === 'kit-document-reference-missing' &&
                    path === 'document.props.prop.table',
            ),
        );
        assert.equal(
            hiddenEntryPlan.runtimeSafety.collisionMode,
            'blocked-footprint',
        );
        assert.equal(allPlanNumbersAreFinite(hiddenEntryPlan), true);
    });

    test('bounds invalid-kit diagnostics before scene aggregation', () => {
        const kit = kitWithInvalidPropEntries(20);
        const definition = resolveGardenStructureRuntimeKit(
            kit.kitKey,
            kit.kitVersion,
        );
        assert.ok(definition);
        const resolveKit = () =>
            Object.freeze({ ...definition, metadata: kit });
        const validation = validateGardenStructureKitMetadata(kit);
        const plan = compileGardenStructurePlan(
            houseInput(kit, 'bounded-diagnostics'),
        );
        const scene = new GardenStructureSceneCache().resolve({
            gardenId: 8,
            records: [savedHouse('bounded-diagnostics')],
            resolveKit,
        });

        assert.equal(validation.valid, false);
        assert.equal(validation.issueSampleTruncated, true);
        assert.equal(
            validation.issues.length,
            gardenStructureKitMetadataValidationIssueLimit,
        );
        assert.ok(validation.issues.every(({ path }) => path.length <= 160));
        assert.equal(plan.runtimeSafety.issueSampleTruncated, true);
        assert.equal(
            plan.runtimeSafety.issues.length,
            gardenStructureKitMetadataValidationIssueLimit,
        );
        assert.equal(scene.diagnostics.issueSampleTruncated, true);
    });

    test('retains fatal resolution state beyond the diagnostic sample', () => {
        const manyIssues = kitWithInvalidPropEntries(20);
        const lateFatalKit = Object.freeze({
            ...manyIssues,
            roofStyles: {
                ...manyIssues.roofStyles,
            },
        });
        const validation = validateGardenStructureKitMetadata(lateFatalKit);
        const definition = resolveGardenStructureRuntimeKit(
            lateFatalKit.kitKey,
            lateFatalKit.kitVersion,
        );
        assert.ok(definition);
        const decoded = decodeSavedGardenStructureRecord(
            savedHouse('late-fatal-kit'),
            {
                resolveKit: () =>
                    Object.freeze({
                        ...definition,
                        metadata: lateFatalKit,
                    }),
            },
        );

        assert.equal(validation.issueSampleTruncated, true);
        assert.equal(
            validation.issues.some(
                ({ code }) => code === 'kit-metadata-not-immutable',
            ),
            false,
        );
        assert.equal(
            hasFatalGardenStructureKitResolutionIssue(validation),
            true,
        );
        assert.equal(decoded.valid, false);
        assert.equal(decoded.issues[0]?.code, 'kit-metadata-incomplete');
    });

    test('keeps direct invalid documents throwing before kit fallback', () => {
        const seed = createGardenStructureTemplateSeed('house');
        const firstProp = seed.document.props[0];
        assert.ok(firstProp);
        const invalidDocument = {
            ...seed.document,
            props: [...seed.document.props, firstProp],
        };
        const input = {
            ...houseInput(
                kitWithTableMetadata({ collisionWidth: 2 }),
                'invalid-document',
            ),
            document: invalidDocument,
        };

        assert.throws(
            () => compileGardenStructurePlan(input),
            /Cannot compile an invalid garden structure document/u,
        );
    });

    test('validates before a same-identity plan-cache lookup', () => {
        const cache = new GardenStructurePlanCache();
        const validInput = houseInput(
            debugGardenStructureKitMetadata,
            'cache-boundary',
        );
        const invalidKit = kitWithTableMetadata({ collisionWidth: 2 });
        const invalidInput = houseInput(invalidKit, 'cache-boundary');

        const valid = cache.getOrCompile(validInput);
        const fallback = cache.getOrCompile(invalidInput);
        const repeatedFallback = cache.getOrCompile(invalidInput);

        assert.notEqual(valid.cacheKey, fallback.cacheKey);
        assert.match(fallback.cacheKey, /kit=fallback:kit-prop-out-of-cell/u);
        assert.equal(repeatedFallback, fallback);
        assert.equal(fallback.runtimeSafety.collisionMode, 'blocked-footprint');
        assert.deepEqual(
            {
                entries: cache.snapshot().entryCount,
                hits: cache.snapshot().hitCount,
                misses: cache.snapshot().missCount,
                writes: cache.snapshot().writeCount,
            },
            { entries: 2, hits: 1, misses: 2, writes: 2 },
        );
    });

    test('keeps the saved structure visible, blocked, and diagnosed', () => {
        const invalidKit = kitWithTableMetadata({ collisionWidth: 2 });
        const definition = resolveGardenStructureRuntimeKit(
            invalidKit.kitKey,
            invalidKit.kitVersion,
        );
        assert.ok(definition);
        const resolveKit = () =>
            Object.freeze({ ...definition, metadata: invalidKit });
        const record = savedHouse('saved-invalid-kit');
        const collection = compileSavedGardenStructureCollection([record], {
            resolveKit,
        });
        const scene = new GardenStructureSceneCache().resolve({
            gardenId: 7,
            records: [record],
            resolveKit,
        });

        assert.equal(collection.rejectedRecords.length, 0);
        assert.equal(collection.plan.structures.length, 1);
        assert.ok(
            collection.plan.batches.transparent.some(
                ({ geometryId }) => geometryId === 'semantic-footprint',
            ),
        );
        assert.equal(
            scene.collisionWorld?.blockedCells.length,
            collection.plan.structures[0]?.footprint.ids.length,
        );
        assert.equal(scene.collisionWorld?.surfaces.length, 0);
        assert.equal(scene.diagnostics.status, 'rendered-with-diagnostics');
        assert.deepEqual(scene.diagnostics.sampledIssueCodes, [
            'kit-prop-out-of-cell',
        ]);
    });
});
