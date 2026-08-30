import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type {
    GardenStructureDocumentV1,
    GardenStructureFootprintCell,
    GardenStructureRotation,
    GardenStructureTemplateKey,
} from '@gredice/js/gardenStructures';
import {
    createGardenStructureTemplateSeed,
    gardenStructureSchemaVersion,
} from '@gredice/js/gardenStructures';
import type {
    GardenStructureBatchDescription,
    GardenStructureCompileInput,
    GardenStructureSemanticPlan,
} from './index';
import {
    benchmarkWorstCaseGardenStructureCompiler,
    compileGardenStructurePlan,
    containsGardenStructureWorldCell,
    containsGardenStructureWorldPoint,
    createWorstCaseGardenStructureCompileInput,
    createWorstCaseGardenStructureDocument,
    debugGardenStructureKitMetadata,
    gardenStructureKitMetadataRegistry,
    getGardenStructureCollisionBoxBounds,
    getGardenStructureNearbySpatialBuckets,
    getGardenStructurePackedCell,
} from './index';

const rotations: readonly GardenStructureRotation[] = [0, 1, 2, 3];

function documentForCells(
    cells: readonly GardenStructureFootprintCell[],
): GardenStructureDocumentV1 {
    return {
        schemaVersion: gardenStructureSchemaVersion,
        footprint: { cells },
        floors: cells.map((cell) => ({
            cell: { x: cell.x, y: cell.y },
            materialId: 'floor.timber',
        })),
        edges: [],
        roofRegions: [],
        props: [],
    };
}

function packedCoordinates(plan: GardenStructureSemanticPlan['footprint']) {
    return plan.ids.map((_, index) => {
        const cell = getGardenStructurePackedCell(plan, index);
        assert.ok(cell);
        return [cell.x, cell.y];
    });
}

function allBatches(plan: GardenStructureSemanticPlan) {
    return [
        ...plan.batches.opaque,
        ...plan.batches.transparent,
        ...plan.batches.roof,
        ...plan.batches.props,
    ];
}

function getBatchTransform(
    batches: readonly GardenStructureBatchDescription[],
    instanceId: string,
) {
    for (const batch of batches) {
        const index = batch.instanceIds.indexOf(instanceId);
        if (index < 0) {
            continue;
        }
        const offset = index * batch.transformStride;
        return [
            batch.transforms[offset],
            batch.transforms[offset + 1],
            batch.transforms[offset + 2],
        ];
    }
    return undefined;
}

describe('garden structure semantic coordinate compilation', () => {
    test('rejects duplicate roof cells before compiling collision IDs', () => {
        const document = createGardenStructureTemplateSeed('house').document;
        const firstRegion = document.roofRegions[0];
        const firstCell = firstRegion?.cells[0];
        assert.ok(firstRegion);
        assert.ok(firstCell);
        const invalidDocument: GardenStructureDocumentV1 = {
            ...document,
            roofRegions: [
                {
                    ...firstRegion,
                    cells: [...firstRegion.cells, firstCell],
                },
                ...document.roofRegions.slice(1),
            ],
        };

        assert.throws(
            () =>
                compileGardenStructurePlan({
                    structureId: 'duplicate-roof-cell',
                    revision: 1,
                    document: invalidDocument,
                    placement: { anchorX: 0, anchorY: 0, rotation: 0 },
                }),
            /duplicate-roof-cell/u,
        );
    });

    test('keeps integer anchor cells aligned with garden stack centers', () => {
        const plan = compileGardenStructurePlan({
            structureId: 'anchor-alignment',
            revision: 1,
            document: createGardenStructureTemplateSeed('barn').document,
            placement: { anchorX: 4, anchorY: -3, rotation: 0 },
        });

        assert.equal(containsGardenStructureWorldCell(plan, 4, -3), true);
        assert.deepEqual(plan.footprint.bounds, {
            minX: 3.5,
            minY: -3.5,
            maxX: 7.5,
            maxY: -0.5,
            width: 4,
            depth: 3,
        });
        assert.deepEqual(
            getBatchTransform(allBatches(plan), 'floor:anchor-alignment:4|-3'),
            [4, -3, 0],
        );
        assert.deepEqual(
            getBatchTransform(
                allBatches(plan),
                'roof:anchor-alignment:roof-main:4|-3',
            ),
            [4, -3, 0],
        );
        assert.deepEqual(
            getBatchTransform(
                allBatches(plan),
                'prop:anchor-alignment:prop-workbench',
            ),
            [4, -2, 1],
        );
        assert.deepEqual(
            [...plan.openPortals.segments],
            [4.5, -0.5, 5.5, -0.5],
        );
    });

    test('emits the exact normalized world footprint in all four rotations', () => {
        const document = documentForCells([
            { x: 0, y: 0, spaceKind: 'interior' },
            { x: 1, y: 0, spaceKind: 'interior' },
            { x: 0, y: 1, spaceKind: 'interior' },
        ]);
        const expected = [
            [
                [10, 20],
                [11, 20],
                [10, 21],
            ],
            [
                [10, 20],
                [11, 20],
                [11, 21],
            ],
            [
                [11, 20],
                [10, 21],
                [11, 21],
            ],
            [
                [10, 20],
                [10, 21],
                [11, 21],
            ],
        ];

        for (const rotation of rotations) {
            const plan = compileGardenStructurePlan({
                structureId: `rotation-${rotation.toString()}`,
                revision: 1,
                document,
                placement: { anchorX: 10, anchorY: 20, rotation },
            });
            assert.deepEqual(
                packedCoordinates(plan.footprint),
                expected[rotation],
            );
            assert.equal(plan.counts.floorSurfaces, 3);
            for (const coordinate of expected[rotation] ?? []) {
                const [x, y] = coordinate;
                assert.equal(
                    x === undefined || y === undefined
                        ? false
                        : containsGardenStructureWorldCell(plan, x, y),
                    true,
                );
            }
        }
    });

    test('keeps a starter open doorway passable in all four rotations', () => {
        const barn = createGardenStructureTemplateSeed('barn').document;
        for (const rotation of rotations) {
            const plan = compileGardenStructurePlan({
                structureId: `portal-${rotation.toString()}`,
                revision: 1,
                document: barn,
                placement: { anchorX: 0, anchorY: 0, rotation },
            });
            assert.deepEqual(plan.openPortals.edgeIds, ['door-main']);
            assert.equal(
                plan.blockedTransitions.edgeIds.includes('door-main'),
                false,
            );
            assert.equal(
                plan.wallCollisionBoxes.sourceIds.some((sourceIds) =>
                    sourceIds.includes('door-main'),
                ),
                false,
            );

            const [startX, startY, endX, endY] = plan.openPortals.segments;
            assert.equal(rotation === 0 || rotation === 2, startY === endY);
            assert.equal(rotation === 1 || rotation === 3, startX === endX);
            assert.ok(plan.openPortals.clearances[0] > 0);
            assert.ok(plan.openPortals.clearances[1] > 0);
        }
    });
});

describe('garden structure navigation semantics', () => {
    test('rejects concave gaps after the bounds broad phase', () => {
        const document = documentForCells([
            { x: 0, y: 0, spaceKind: 'interior' },
            { x: 1, y: 0, spaceKind: 'interior' },
            { x: 0, y: 1, spaceKind: 'interior' },
        ]);
        const gapByRotation = [
            [11, 21],
            [10, 21],
            [10, 20],
            [11, 20],
        ];

        for (const rotation of rotations) {
            const plan = compileGardenStructurePlan({
                structureId: `concave-${rotation.toString()}`,
                revision: 1,
                document,
                placement: { anchorX: 10, anchorY: 20, rotation },
            });
            const gap = gapByRotation[rotation];
            assert.ok(gap);
            assert.equal(
                containsGardenStructureWorldCell(
                    plan,
                    gap[0] ?? 0,
                    gap[1] ?? 0,
                ),
                false,
            );
            assert.equal(
                containsGardenStructureWorldPoint(
                    plan,
                    (gap[0] ?? 0) + 0.1,
                    (gap[1] ?? 0) + 0.1,
                ),
                false,
            );
            assert.equal(
                gap[0] !== undefined &&
                    gap[1] !== undefined &&
                    gap[0] > plan.footprint.bounds.minX &&
                    gap[0] < plan.footprint.bounds.maxX &&
                    gap[1] > plan.footprint.bounds.minY &&
                    gap[1] < plan.footprint.bounds.maxY,
                true,
            );
        }
    });

    test('keeps a roof-only porch walkable without a phantom floor', () => {
        const plan = compileGardenStructurePlan({
            structureId: 'roof-only-porch',
            revision: 1,
            document: createGardenStructureTemplateSeed('house').document,
            placement: { anchorX: 8, anchorY: -2, rotation: 0 },
        });

        const porchIndices = [...plan.footprint.spaceKinds.entries()]
            .filter(([, kind]) => kind === 1)
            .map(([index]) => index);
        assert.equal(porchIndices.length, 3);
        for (const index of porchIndices) {
            const cell = getGardenStructurePackedCell(plan.footprint, index);
            assert.ok(cell);
            const key = `${cell.x.toString()}|${cell.y.toString()}`;
            assert.equal(Object.hasOwn(plan.floors.indexByKey, key), false);
            assert.equal(plan.walkable.groundingKinds[index], 1);
            const buckets = getGardenStructureNearbySpatialBuckets(
                plan,
                cell.x,
                cell.y,
                0,
            );
            assert.equal(buckets.length, 1);
            assert.ok((buckets[0]?.ceilingProxyIndices.length ?? 0) > 0);
        }
    });

    test('blocks walls, windows, and a closed door but not an open door', () => {
        const house = createGardenStructureTemplateSeed('house').document;
        const openPlan = compileGardenStructurePlan({
            structureId: 'open-house',
            revision: 1,
            document: house,
            placement: { anchorX: 0, anchorY: 0, rotation: 0 },
        });
        assert.ok(openPlan.blockedTransitions.kinds.includes('wall'));
        assert.equal(
            openPlan.blockedTransitions.edgeIds.includes('window-north'),
            true,
        );
        assert.equal(
            openPlan.blockedTransitions.kinds[
                openPlan.blockedTransitions.edgeIds.indexOf('window-north')
            ],
            'window',
        );
        const eastWindowIndex =
            openPlan.blockedTransitions.edgeIds.indexOf('window-east');
        assert.ok(eastWindowIndex >= 0);
        assert.deepEqual(
            [
                ...openPlan.blockedTransitions.segments.slice(
                    eastWindowIndex * 4,
                    eastWindowIndex * 4 + 4,
                ),
            ],
            [2.5, 0.5, 2.5, 1.5],
        );
        assert.deepEqual(openPlan.openPortals.edgeIds, [
            'door-main',
            'partition-door',
        ]);
        assert.ok(
            openPlan.blockedTransitions.edgeIds.includes(
                'partition-wall-north',
            ),
        );
        assert.ok(
            openPlan.blockedTransitions.edgeIds.includes(
                'partition-wall-south',
            ),
        );

        const closedDocument: GardenStructureDocumentV1 = {
            ...house,
            edges: house.edges.map((edge) =>
                edge.id === 'door-main'
                    ? { ...edge, partId: 'door.debug-closed' }
                    : edge,
            ),
        };
        const closedPlan = compileGardenStructurePlan({
            structureId: 'closed-house',
            revision: 1,
            document: closedDocument,
            placement: { anchorX: 0, anchorY: 0, rotation: 0 },
        });
        assert.deepEqual(closedPlan.openPortals.edgeIds, ['partition-door']);
        const doorIndex =
            closedPlan.blockedTransitions.edgeIds.indexOf('door-main');
        assert.ok(doorIndex >= 0);
        assert.equal(
            closedPlan.blockedTransitions.kinds[doorIndex],
            'closed-door',
        );
        assert.equal(
            closedPlan.wallCollisionBoxes.sourceIds.some((sourceIds) =>
                sourceIds.includes('door-main'),
            ),
            true,
        );

        for (
            let index = 0;
            index < closedPlan.wallCollisionBoxes.ids.length;
            index++
        ) {
            const bounds = getGardenStructureCollisionBoxBounds(
                closedPlan.wallCollisionBoxes,
                index,
            );
            assert.ok(bounds);
            assert.ok(bounds.maxX > bounds.minX);
            assert.ok(bounds.maxY > bounds.minY);
            assert.ok(bounds.maxHeight > bounds.minHeight);
        }
    });
});

describe('garden structure batching and locality', () => {
    test('uses immutable debug metadata for current templates and greenhouse transparency', () => {
        assert.equal(Object.isFrozen(debugGardenStructureKitMetadata), true);
        assert.equal(
            Object.isFrozen(debugGardenStructureKitMetadata.edgeParts),
            true,
        );
        assert.equal(Object.isFrozen(gardenStructureKitMetadataRegistry), true);

        const templateKeys: readonly GardenStructureTemplateKey[] = [
            'barn',
            'house',
            'greenhouse',
            'blank',
        ];
        for (const template of templateKeys) {
            assert.doesNotThrow(() =>
                compileGardenStructurePlan({
                    structureId: template,
                    revision: 1,
                    document:
                        createGardenStructureTemplateSeed(template).document,
                    placement: { anchorX: 0, anchorY: 0, rotation: 0 },
                }),
            );
        }

        const greenhouse = compileGardenStructurePlan({
            structureId: 'greenhouse',
            revision: 1,
            document: createGardenStructureTemplateSeed('greenhouse').document,
            placement: { anchorX: 0, anchorY: 0, rotation: 0 },
        });
        assert.ok(greenhouse.batches.transparent.length > 0);
        assert.ok(
            greenhouse.batches.transparent.every(
                (batch) => batch.transparency === 'transparent',
            ),
        );
        assert.ok(
            greenhouse.batches.roof.some(
                (batch) => batch.transparency === 'transparent',
            ),
        );
    });

    test('produces byte-for-byte deterministic columnar output', () => {
        const original = createGardenStructureTemplateSeed('house').document;
        const reordered: GardenStructureDocumentV1 = {
            ...original,
            footprint: { cells: [...original.footprint.cells].reverse() },
            floors: [...original.floors].reverse(),
            edges: [...original.edges].reverse(),
            roofRegions: [...original.roofRegions].reverse().map((region) => ({
                ...region,
                cells: [...region.cells].reverse(),
            })),
            props: [...original.props].reverse(),
        };
        const input: Omit<GardenStructureCompileInput, 'document'> = {
            structureId: 'deterministic',
            revision: 7,
            placement: { anchorX: -4, anchorY: 11, rotation: 3 },
        };

        assert.deepEqual(
            compileGardenStructurePlan({ ...input, document: original }),
            compileGardenStructurePlan({ ...input, document: reordered }),
        );
    });

    test('preserves prop variants as distinct batch geometry identities', () => {
        const original = createGardenStructureTemplateSeed('house').document;
        const document: GardenStructureDocumentV1 = {
            ...original,
            props: original.props.map((prop) => ({
                ...prop,
                variantId: 'variant.oak',
            })),
        };
        const plan = compileGardenStructurePlan({
            structureId: 'prop-variant',
            revision: 1,
            document,
            placement: { anchorX: 0, anchorY: 0, rotation: 0 },
        });
        const propBatch = plan.batches.props[0];

        assert.ok(propBatch);
        assert.equal(propBatch.geometryId, 'prop.table');
        assert.equal(propBatch.variantId, 'variant.oak');
        assert.match(propBatch.id, /"variant\.oak"/u);
    });

    test('keeps an absent prop variant distinct from the literal default id', () => {
        const original = createGardenStructureTemplateSeed('house').document;
        const originalProp = original.props[0];
        assert.ok(originalProp);
        const plan = compileGardenStructurePlan({
            structureId: 'default-variant-identity',
            revision: 1,
            document: {
                ...original,
                props: [
                    originalProp,
                    {
                        ...originalProp,
                        id: 'prop-table-literal-default',
                        x: 2,
                        variantId: 'default',
                    },
                ],
            },
            placement: { anchorX: 0, anchorY: 0, rotation: 0 },
        });

        assert.equal(plan.batches.props.length, 2);
        assert.equal(
            new Set(plan.batches.props.map((batch) => batch.id)).size,
            2,
        );
        assert.equal(
            plan.batches.props.some((batch) => batch.variantId === undefined),
            true,
        );
        assert.equal(
            plan.batches.props.some((batch) => batch.variantId === 'default'),
            true,
        );
    });

    test('world bounds contain visual padding and every semantic proxy', () => {
        const plan = compileGardenStructurePlan({
            structureId: 'complete-bounds',
            revision: 1,
            document: createGardenStructureTemplateSeed('house').document,
            placement: { anchorX: 4, anchorY: -2, rotation: 0 },
            baseHeight: 0.3,
        });

        assert.ok(plan.worldBounds.minX < plan.footprint.bounds.minX);
        assert.ok(plan.worldBounds.minY < plan.footprint.bounds.minY);
        assert.ok(plan.worldBounds.maxX > plan.footprint.bounds.maxX);
        assert.ok(plan.worldBounds.maxY > plan.footprint.bounds.maxY);
        assert.equal(
            plan.worldBounds.minHeight,
            0.3 - debugGardenStructureKitMetadata.floorThickness,
        );
        for (const packed of [
            plan.wallCollisionBoxes.bounds,
            plan.propCollisionBoxes.bounds,
            plan.ceilingProxies.bounds,
        ]) {
            for (let offset = 0; offset < packed.length; offset += 6) {
                assert.ok((packed[offset] ?? 0) >= plan.worldBounds.minX);
                assert.ok((packed[offset + 1] ?? 0) >= plan.worldBounds.minY);
                assert.ok((packed[offset + 2] ?? 0) <= plan.worldBounds.maxX);
                assert.ok((packed[offset + 3] ?? 0) <= plan.worldBounds.maxY);
                assert.ok(
                    (packed[offset + 4] ?? 0) >= plan.worldBounds.minHeight,
                );
                assert.ok(
                    (packed[offset + 5] ?? 0) <= plan.worldBounds.maxHeight,
                );
            }
        }
    });

    test('indexes collision proxies only into intersecting nearby buckets', () => {
        const document: GardenStructureDocumentV1 = {
            ...documentForCells(
                Array.from({ length: 5 }, (_, x) => ({
                    x,
                    y: 0,
                    spaceKind: 'interior',
                })),
            ),
            edges: [
                {
                    id: 'near-wall',
                    from: { x: 0, y: 0 },
                    direction: 'north',
                    partId: 'wall.timber',
                    kind: 'wall',
                },
            ],
            props: [
                {
                    id: 'far-table',
                    partId: 'prop.table',
                    x: 4,
                    y: 0,
                    rotation: 0,
                },
            ],
        };
        const plan = compileGardenStructurePlan({
            structureId: 'locality',
            revision: 1,
            document,
            placement: { anchorX: 0, anchorY: 0, rotation: 0 },
        });

        const near = getGardenStructureNearbySpatialBuckets(plan, 0, 0, 0);
        assert.equal(near.length, 1);
        assert.deepEqual([...(near[0]?.wallBoxIndices ?? [])], [0]);
        assert.deepEqual([...(near[0]?.propBoxIndices ?? [])], []);

        const far = getGardenStructureNearbySpatialBuckets(plan, 4, 0, 0);
        assert.equal(far.length, 1);
        assert.deepEqual([...(far[0]?.wallBoxIndices ?? [])], []);
        assert.deepEqual([...(far[0]?.propBoxIndices ?? [])], [0]);

        const nearby = getGardenStructureNearbySpatialBuckets(plan, 0, 0, 1);
        assert.ok(nearby.every((bucket) => Math.abs(bucket.x) <= 1));
        assert.equal(
            nearby.some((bucket) => bucket.x === 4),
            false,
        );
    });
});

describe('garden structure worst-case compiler budget', () => {
    test('keeps the valid 100-cell fixture within deterministic plan bounds', () => {
        const document = createWorstCaseGardenStructureDocument();
        assert.equal(document.footprint.cells.length, 100);
        assert.equal(document.edges.length, 301);
        assert.equal(document.roofRegions.length, 100);
        assert.equal(document.props.length, 100);

        const plan = compileGardenStructurePlan(
            createWorstCaseGardenStructureCompileInput(),
        );
        assert.deepEqual(
            {
                footprintCells: plan.counts.footprintCells,
                floorSurfaces: plan.counts.floorSurfaces,
                walkableCells: plan.counts.walkableCells,
                openPortals: plan.counts.openPortals,
                blockedTransitions: plan.counts.blockedTransitions,
                propCollisionBoxes: plan.counts.propCollisionBoxes,
                ceilingProxies: plan.counts.ceilingProxies,
                renderInstances: plan.counts.renderInstances,
                interactionIds: plan.counts.interactionIds,
            },
            {
                footprintCells: 100,
                floorSurfaces: 100,
                walkableCells: 100,
                openPortals: 38,
                blockedTransitions: 263,
                propCollisionBoxes: 100,
                ceilingProxies: 100,
                renderInstances: 601,
                interactionIds: 601,
            },
        );
        assert.ok(plan.counts.wallCollisionBoxes <= 263);
        assert.ok(plan.counts.spatialBuckets <= 220);
        assert.ok(plan.counts.renderBatches <= 24);
    });

    test('reports repeatable benchmark counts separately from timing', () => {
        let clock = 10;
        const result = benchmarkWorstCaseGardenStructureCompiler({
            iterations: 2,
            now: () => {
                const current = clock;
                clock += 4;
                return current;
            },
        });

        assert.equal(result.iterations, 2);
        assert.equal(result.totalDurationMs, 4);
        assert.equal(result.averageDurationMs, 2);
        assert.equal(result.counts.footprintCells, 100);
        assert.equal(result.counts.renderInstances, 601);
    });
});
