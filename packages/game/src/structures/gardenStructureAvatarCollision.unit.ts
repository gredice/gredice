import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    createGardenStructureTemplateSeed,
    type GardenStructureRotation,
} from '@gredice/js/gardenStructures';
import {
    createIndexedGardenAvatarCollisionWorld,
    gardenAvatarRadius,
    gardenAvatarStandingCollisionHeight,
    getGardenAvatarCeilingY,
    getGardenAvatarCollisionCandidates,
    getGardenAvatarGroundY,
    mergeGardenAvatarCollisionWorlds,
    resolveGardenAvatarHorizontalMovement,
} from '../entities/avatar/gardenAvatarMovement';
import {
    createGardenStructureAvatarCollisionWorld,
    createGardenStructureCollectionAvatarCollisionWorld,
} from './gardenStructureAvatarCollision';
import {
    compileGardenStructurePlan,
    containsGardenStructureWorldCell,
    createWorstCaseGardenStructureCompileInput,
    debugGardenStructureKitMetadata,
    getGardenStructurePackedCell,
} from './index';

const structureBaseHeight = 0.3;

function createHousePlan(rotation: GardenStructureRotation = 0) {
    return compileGardenStructurePlan({
        structureId: 'collision-house',
        revision: 1,
        document: createGardenStructureTemplateSeed('house').document,
        placement: { anchorX: 0, anchorY: 0, rotation },
        baseHeight: structureBaseHeight,
    });
}

describe('garden structure avatar collision', () => {
    test('grounds the avatar on an explicit structure floor', () => {
        const world = createGardenStructureAvatarCollisionWorld(
            createHousePlan(),
        );

        assert.equal(
            getGardenAvatarGroundY({
                currentGroundY: 0,
                position: { x: 0, z: 0 },
                world,
            }),
            structureBaseHeight,
        );
    });

    test('blocks a solid wall while leaving the open door traversable in every rotation', () => {
        const rotations: readonly GardenStructureRotation[] = [0, 1, 2, 3];
        for (const rotation of rotations) {
            const plan = createHousePlan(rotation);
            const world = createGardenStructureAvatarCollisionWorld(plan);
            const portalFromX = plan.openPortals.adjacentCells[0];
            const portalFromZ = plan.openPortals.adjacentCells[1];
            const portalToX = plan.openPortals.adjacentCells[2];
            const portalToZ = plan.openPortals.adjacentCells[3];
            assert.ok(portalFromX !== undefined && portalFromZ !== undefined);
            assert.ok(portalToX !== undefined && portalToZ !== undefined);
            const doorCrossing = resolveGardenAvatarHorizontalMovement({
                deltaX: (portalToX - portalFromX) * 1.2,
                deltaZ: (portalToZ - portalFromZ) * 1.2,
                position: {
                    x: portalFromX,
                    y: structureBaseHeight,
                    z: portalFromZ,
                },
                world,
            });

            const blockedFromX = plan.blockedTransitions.adjacentCells[0];
            const blockedFromZ = plan.blockedTransitions.adjacentCells[1];
            const blockedToX = plan.blockedTransitions.adjacentCells[2];
            const blockedToZ = plan.blockedTransitions.adjacentCells[3];
            assert.ok(blockedFromX !== undefined && blockedFromZ !== undefined);
            assert.ok(blockedToX !== undefined && blockedToZ !== undefined);
            const fromIsInside = containsGardenStructureWorldCell(
                plan,
                blockedFromX,
                blockedFromZ,
            );
            const wallStart = fromIsInside
                ? { x: blockedFromX, z: blockedFromZ }
                : { x: blockedToX, z: blockedToZ };
            const wallEnd = fromIsInside
                ? { x: blockedToX, z: blockedToZ }
                : { x: blockedFromX, z: blockedFromZ };
            const wallCrossing = resolveGardenAvatarHorizontalMovement({
                deltaX: (wallEnd.x - wallStart.x) * 1.2,
                deltaZ: (wallEnd.z - wallStart.z) * 1.2,
                position: {
                    x: wallStart.x,
                    y: structureBaseHeight,
                    z: wallStart.z,
                },
                world,
            });

            assert.equal(wallCrossing.collided, true, `rotation ${rotation}`);
            assert.equal(doorCrossing.collided, false, `rotation ${rotation}`);
        }
    });

    test('rejects open portals narrower or shorter than the standing avatar', () => {
        const createPlan = (clearanceWidth: number, clearanceHeight: number) =>
            compileGardenStructurePlan({
                structureId: 'portal-envelope',
                revision: 1,
                document: createGardenStructureTemplateSeed('house').document,
                placement: { anchorX: 0, anchorY: 0, rotation: 0 },
                kit: Object.freeze({
                    ...debugGardenStructureKitMetadata,
                    edgeParts: Object.freeze({
                        ...debugGardenStructureKitMetadata.edgeParts,
                        'door.house-open': Object.freeze({
                            ...debugGardenStructureKitMetadata.edgeParts[
                                'door.house-open'
                            ],
                            portalClearanceWidth: clearanceWidth,
                            portalClearanceHeight: clearanceHeight,
                        }),
                    }),
                }),
            });
        const minimumWidth = gardenAvatarRadius * 2;

        assert.throws(
            () =>
                createGardenStructureAvatarCollisionWorld(
                    createPlan(
                        minimumWidth - 0.01,
                        gardenAvatarStandingCollisionHeight,
                    ),
                ),
            /does not fit the standing avatar collision envelope/u,
        );
        assert.throws(
            () =>
                createGardenStructureAvatarCollisionWorld(
                    createPlan(
                        minimumWidth,
                        gardenAvatarStandingCollisionHeight - 0.01,
                    ),
                ),
            /does not fit the standing avatar collision envelope/u,
        );
        assert.doesNotThrow(() =>
            createGardenStructureAvatarCollisionWorld(
                createPlan(minimumWidth, gardenAvatarStandingCollisionHeight),
            ),
        );
    });

    test('isolates an undersized future-kit portal with a blocked-footprint fallback', () => {
        const validPlan = createHousePlan();
        const unsafePlan = compileGardenStructurePlan({
            structureId: 'unsafe-future-kit',
            revision: 1,
            document: createGardenStructureTemplateSeed('house').document,
            placement: { anchorX: 30, anchorY: 30, rotation: 0 },
            kit: Object.freeze({
                ...debugGardenStructureKitMetadata,
                edgeParts: Object.freeze({
                    ...debugGardenStructureKitMetadata.edgeParts,
                    'door.house-open': Object.freeze({
                        ...debugGardenStructureKitMetadata.edgeParts[
                            'door.house-open'
                        ],
                        portalClearanceWidth: gardenAvatarRadius,
                    }),
                }),
            }),
        });
        const world = createGardenStructureCollectionAvatarCollisionWorld([
            unsafePlan,
            validPlan,
        ]);

        assert.ok(
            getGardenAvatarCollisionCandidates(world, { x: 0, z: 0 }).surfaces
                .length > 0,
        );
        assert.ok(
            getGardenAvatarCollisionCandidates(world, { x: 30, z: 30 })
                .blockedCells.length > 0,
        );
        assert.equal(
            world.surfaces.some((surface) =>
                surface.debugLabel?.includes('unsafe-future-kit'),
            ),
            false,
        );
    });

    test('leaves the covered outdoor porch floorless and uses underlying ground', () => {
        const structureWorld = createGardenStructureAvatarCollisionWorld(
            createHousePlan(),
        );
        const porchPosition = { x: 0, z: 3 };

        assert.equal(
            getGardenAvatarGroundY({
                currentGroundY: 0,
                position: porchPosition,
                world: structureWorld,
            }),
            0,
        );
        assert.equal(
            structureWorld.surfaces.some(
                (surface) =>
                    surface.x === porchPosition.x &&
                    surface.z === porchPosition.z &&
                    surface.debugLabel?.startsWith('floor:') === true,
            ),
            false,
        );

        const underlyingGroundHeight = 0.12;
        const underlyingWorld = createIndexedGardenAvatarCollisionWorld({
            blockedCells: [],
            surfaces: [
                {
                    kind: 'ground',
                    x: porchPosition.x,
                    y: underlyingGroundHeight,
                    z: porchPosition.z,
                },
            ],
        });
        const mergedWorld = mergeGardenAvatarCollisionWorlds(
            structureWorld,
            underlyingWorld,
        );

        assert.equal(
            getGardenAvatarGroundY({
                currentGroundY: underlyingGroundHeight,
                position: porchPosition,
                world: mergedWorld,
            }),
            underlyingGroundHeight,
        );
    });

    test('exposes the compiled roof as an overhead ceiling proxy', () => {
        const world = createGardenStructureAvatarCollisionWorld(
            createHousePlan(),
        );
        const ceilingY = getGardenAvatarCeilingY({
            collisionHeight: gardenAvatarStandingCollisionHeight,
            position: { x: 0, y: structureBaseHeight, z: 0 },
            world,
        });
        const expectedCeilingY =
            structureBaseHeight +
            2.4 -
            0.06 / 2 -
            gardenAvatarStandingCollisionHeight;

        assert.ok(ceilingY !== null);
        assert.ok(Math.abs(ceilingY - expectedCeilingY) < 0.000_001);
    });

    test('keeps nearby candidates bounded across 100-cell subcell and bucket boundaries', () => {
        const plan = compileGardenStructurePlan(
            createWorstCaseGardenStructureCompileInput(),
        );
        const world = createGardenStructureAvatarCollisionWorld(plan);
        const offsets = [-0.49, 0, 0.49];
        const candidateCounts = plan.footprint.ids.flatMap((_, index) => {
            const cell = getGardenStructurePackedCell(plan.footprint, index);
            assert.ok(cell);
            return offsets.flatMap((offsetX) =>
                offsets.map(
                    (offsetZ) =>
                        getGardenAvatarCollisionCandidates(world, {
                            x: cell.x + offsetX,
                            z: cell.y + offsetZ,
                        }).surfaces.length,
                ),
            );
        });
        const maximumCandidateCount = Math.max(...candidateCounts);

        assert.equal(plan.counts.footprintCells, 100);
        assert.ok(world.surfaces.length > 400);
        assert.ok(maximumCandidateCount <= 40);
        assert.ok(maximumCandidateCount < world.surfaces.length / 8);
    });
});
