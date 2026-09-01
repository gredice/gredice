import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    createGardenStructureTemplateSeed,
    type GardenStructureCoordinate,
    type GardenStructureRotation,
    gardenStructureCellKey,
    gardenStructureMaxCoordinateMagnitude,
    getGardenStructureWorldFootprintCells,
} from '@gredice/js/gardenStructures';
import {
    gardenStructureLocalPointToWorld,
    gardenStructureWorldCellToLocal,
    getCoalescedGardenStructureGridStroke,
    getGardenStructureCanvasEdgeAtWorldPoint,
    getGardenStructureCanvasEdgeChain,
} from './gardenStructureCanvasInteraction';
import type { GardenStructureCellSide } from './gardenStructureDocumentEdits';

const rotations = [0, 1, 2, 3] satisfies readonly GardenStructureRotation[];
const localEdgePoints = [
    { local: { x: 0, y: -0.49 }, side: 'N' },
    { local: { x: 0.49, y: 0 }, side: 'E' },
    { local: { x: 0, y: 0.49 }, side: 'S' },
    { local: { x: -0.49, y: 0 }, side: 'W' },
] satisfies readonly Readonly<{
    local: GardenStructureCoordinate;
    side: GardenStructureCellSide;
}>[];

describe('garden structure canvas interaction', () => {
    test('round-trips every footprint cell through all placement rotations', () => {
        const document = createGardenStructureTemplateSeed('house').document;
        for (const rotation of rotations) {
            const placement = { anchorX: -7, anchorY: 11, rotation };
            const worldCells = getGardenStructureWorldFootprintCells(
                document,
                placement,
            );
            const localKeys = new Set(
                worldCells.map((world) => {
                    const local = gardenStructureWorldCellToLocal({
                        document,
                        placement,
                        world,
                    });
                    assert.ok(local);
                    return gardenStructureCellKey(local);
                }),
            );
            assert.deepEqual(
                localKeys,
                new Set(document.footprint.cells.map(gardenStructureCellKey)),
            );

            for (const local of document.footprint.cells) {
                const world = gardenStructureLocalPointToWorld({
                    document,
                    local,
                    placement,
                });
                assert.ok(world);
                assert.ok(
                    worldCells.some(
                        (candidate) =>
                            candidate.x === world.x && candidate.y === world.y,
                    ),
                );
            }
        }
    });

    test('fills skipped pointer cells exactly once in either drag direction', () => {
        assert.deepEqual(
            getCoalescedGardenStructureGridStroke(
                { x: -2, y: 1 },
                { x: 3, y: 1 },
            ),
            [
                { x: -2, y: 1 },
                { x: -1, y: 1 },
                { x: 0, y: 1 },
                { x: 1, y: 1 },
                { x: 2, y: 1 },
                { x: 3, y: 1 },
            ],
        );
        assert.deepEqual(
            getCoalescedGardenStructureGridStroke(
                { x: 2, y: 3 },
                { x: -1, y: 0 },
            ),
            [
                { x: 2, y: 3 },
                { x: 1, y: 2 },
                { x: 0, y: 1 },
                { x: -1, y: 0 },
            ],
        );
    });

    test('rejects non-integer or out-of-domain stroke coordinates without iterating', () => {
        const invalidCoordinates = [
            { x: 0.5, y: 0 },
            { x: Number.POSITIVE_INFINITY, y: 0 },
            { x: gardenStructureMaxCoordinateMagnitude + 1, y: 0 },
        ] satisfies readonly GardenStructureCoordinate[];
        for (const coordinate of invalidCoordinates) {
            assert.deepEqual(
                getCoalescedGardenStructureGridStroke(coordinate, {
                    x: 0,
                    y: 0,
                }),
                [],
            );
            assert.deepEqual(
                getCoalescedGardenStructureGridStroke(
                    { x: 0, y: 0 },
                    coordinate,
                ),
                [],
            );
        }

        const boundedStroke = getCoalescedGardenStructureGridStroke(
            { x: -gardenStructureMaxCoordinateMagnitude, y: 0 },
            { x: gardenStructureMaxCoordinateMagnitude, y: 0 },
        );
        assert.equal(
            boundedStroke.length,
            gardenStructureMaxCoordinateMagnitude * 2 + 1,
        );
    });

    test('resolves every local edge through every placement rotation', () => {
        const document = createGardenStructureTemplateSeed('blank').document;
        for (const rotation of rotations) {
            const placement = { anchorX: 4, anchorY: -3, rotation };
            for (const { local, side } of localEdgePoints) {
                const world = gardenStructureLocalPointToWorld({
                    document,
                    local,
                    placement,
                });
                assert.ok(world);
                assert.deepEqual(
                    getGardenStructureCanvasEdgeAtWorldPoint({
                        document,
                        placement,
                        world,
                    }),
                    { cell: { x: 0, y: 0 }, side },
                );
            }
        }
    });

    test('builds inclusive collinear chains and rejects turns or gaps', () => {
        const document = createGardenStructureTemplateSeed('blank').document;
        const horizontal = getGardenStructureCanvasEdgeChain(
            document,
            { cell: { x: 0, y: 0 }, side: 'N' },
            { cell: { x: 1, y: 0 }, side: 'N' },
        );
        assert.equal(horizontal.ok, true);
        if (horizontal.ok) {
            assert.deepEqual(horizontal.edges, [
                { cell: { x: 0, y: 0 }, side: 'N' },
                { cell: { x: 1, y: 0 }, side: 'N' },
            ]);
        }

        assert.deepEqual(
            getGardenStructureCanvasEdgeChain(
                document,
                { cell: { x: 0, y: 0 }, side: 'N' },
                { cell: { x: 0, y: 0 }, side: 'E' },
            ),
            { ok: false, reason: 'not-collinear' },
        );
        assert.deepEqual(
            getGardenStructureCanvasEdgeChain(
                document,
                { cell: { x: 0, y: 0 }, side: 'N' },
                { cell: { x: 3, y: 0 }, side: 'N' },
            ),
            { ok: false, reason: 'outside-footprint' },
        );
    });
});
