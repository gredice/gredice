import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    createGardenStructureTemplateSeed,
    type GardenStructureRotation,
} from '@gredice/js/gardenStructures';
import {
    gardenAvatarStandingCollisionHeight,
    getGardenAvatarGroundY,
} from '../entities/avatar/gardenAvatarMovement';
import { compileGardenStructurePlan } from './compileGardenStructurePlan';
import { debugGardenStructureKitMetadata } from './debugStructureKit';
import { createGardenStructureAvatarCollisionWorld } from './gardenStructureAvatarCollision';
import {
    emptyGardenStructureAvatarInteriorPresentation,
    findContainingGardenStructure,
    findGardenStructureAvatarSafeRelocation,
    getGardenStructureAvatarInteriorPresentation,
    resolveGardenStructureAvatarWorldChangePose,
    resolveGardenStructureThirdPersonCameraPosition,
} from './gardenStructureAvatarInterior';
import { createGardenStructureCollectionPlan } from './gardenStructureCollectionPlan';
import type { GardenStructureSemanticPlan } from './structurePlanTypes';

const rotations: readonly GardenStructureRotation[] = [0, 1, 2, 3];
const baseHeight = 0.3;

function house(
    rotation: GardenStructureRotation,
    structureId = `house-${rotation.toString()}`,
    anchorX = 10,
    anchorY = 20,
) {
    return compileGardenStructurePlan({
        baseHeight,
        document: createGardenStructureTemplateSeed('house').document,
        placement: { anchorX, anchorY, rotation },
        revision: 1,
        structureId,
    });
}

function collection(structures: readonly GardenStructureSemanticPlan[]) {
    return createGardenStructureCollectionPlan(
        structures.map((plan) => ({
            kit: debugGardenStructureKitMetadata,
            plan,
        })),
    );
}

function packedCell(
    cells: GardenStructureSemanticPlan['footprint'],
    index: number,
) {
    const x = cells.coordinates[index * 2];
    const z = cells.coordinates[index * 2 + 1];
    assert.ok(x !== undefined && z !== undefined);
    return { x, z };
}

function transitionCells(
    transitions:
        | GardenStructureSemanticPlan['blockedTransitions']
        | GardenStructureSemanticPlan['openPortals'],
    index: number,
) {
    const offset = index * 4;
    const fromX = transitions.adjacentCells[offset];
    const fromZ = transitions.adjacentCells[offset + 1];
    const toX = transitions.adjacentCells[offset + 2];
    const toZ = transitions.adjacentCells[offset + 3];
    assert.ok(
        fromX !== undefined &&
            fromZ !== undefined &&
            toX !== undefined &&
            toZ !== undefined,
    );
    return {
        from: { x: fromX, z: fromZ },
        to: { x: toX, z: toZ },
    };
}

describe('garden structure avatar containment and cutaway', () => {
    test('uses exact semantic footprints and a structure-local cutaway in every rotation', () => {
        for (const rotation of rotations) {
            const primary = house(rotation);
            const distant = house(
                rotation,
                `distant-${rotation.toString()}`,
                50,
                60,
            );
            const plan = collection([distant, primary]);
            const porchIndex = primary.footprint.spaceKinds.indexOf(1);
            assert.notEqual(porchIndex, -1);
            const porch = packedCell(primary.footprint, porchIndex);
            assert.equal(
                primary.floors.indexByKey[`${porch.x}|${porch.z}`],
                undefined,
                `rotation ${rotation.toString()} porch stays floorless`,
            );
            assert.equal(
                findContainingGardenStructure(plan, porch)?.structureId,
                primary.structureId,
            );

            const windowIndex =
                primary.blockedTransitions.edgeIds.indexOf('window-north');
            assert.notEqual(windowIndex, -1);
            const windowCells = transitionCells(
                primary.blockedTransitions,
                windowIndex,
            );
            const cameraPosition = Object.hasOwn(
                primary.footprint.indexByKey,
                `${windowCells.from.x}|${windowCells.from.z}`,
            )
                ? windowCells.to
                : windowCells.from;
            const presentation = getGardenStructureAvatarInteriorPresentation({
                avatarPosition: porch,
                cameraPosition,
                collection: plan,
            });

            assert.equal(presentation.structureId, primary.structureId);
            assert.ok(
                presentation.hiddenInstanceIds.includes(
                    `edge:${primary.structureId}:window-north`,
                ),
            );
            assert.equal(
                presentation.hiddenInstanceIds.includes(
                    `edge:${primary.structureId}:door-main`,
                ),
                false,
                'an open door has no wall instance to suppress',
            );
            assert.equal(
                presentation.hiddenInstanceIds.includes(
                    `edge:${primary.structureId}:partition-wall-north`,
                ),
                false,
                'interior partitions remain visible',
            );
            assert.ok(
                primary.batches.roof
                    .flatMap((batch) => batch.instanceIds)
                    .every((instanceId) =>
                        presentation.hiddenInstanceIds.includes(instanceId),
                    ),
            );
            assert.equal(
                presentation.hiddenInstanceIds.some((instanceId) =>
                    instanceId.includes(distant.structureId),
                ),
                false,
                'a neighboring structure is never cut away',
            );
        }
    });

    test('restores the full structure immediately outside the footprint', () => {
        const primary = house(0);
        const plan = collection([primary]);
        const outside = {
            x: primary.worldBounds.maxX + 1,
            z: primary.worldBounds.maxY + 1,
        };
        const presentation = getGardenStructureAvatarInteriorPresentation({
            avatarPosition: outside,
            cameraPosition: outside,
            collection: plan,
        });

        assert.equal(presentation.structureId, null);
        assert.deepEqual(presentation.hiddenInstanceIds, []);
    });

    test('keeps the no-structure path allocation-free', () => {
        assert.equal(
            getGardenStructureAvatarInteriorPresentation({
                avatarPosition: { x: 0, z: 0 },
                cameraPosition: { x: 0, z: 0 },
                collection: null,
            }),
            emptyGardenStructureAvatarInteriorPresentation,
        );
    });
});

describe('garden structure avatar mutation recovery', () => {
    test('keeps an airborne actor above new geometry but rejects an overlapping live envelope', () => {
        const structure = house(0);
        const world = createGardenStructureAvatarCollisionWorld(structure);
        const propBounds = structure.propCollisionBoxes.bounds;
        const minX = propBounds[0];
        const minZ = propBounds[1];
        const maxX = propBounds[2];
        const maxZ = propBounds[3];
        const maxY = propBounds[5];
        assert.ok(
            minX !== undefined &&
                minZ !== undefined &&
                maxX !== undefined &&
                maxZ !== undefined &&
                maxY !== undefined,
        );
        const position = {
            x: (minX + maxX) / 2,
            y: maxY + 0.1,
            z: (minZ + maxZ) / 2,
        };

        const clear = resolveGardenStructureAvatarWorldChangePose({
            grounded: false,
            groundY: baseHeight,
            position,
            world,
        });
        assert.equal(clear.requiresRelocation, false);
        assert.ok(clear.groundY !== null);
        assert.ok(Math.abs(clear.groundY - maxY) < 0.000_01);

        const overlapping = resolveGardenStructureAvatarWorldChangePose({
            grounded: false,
            groundY: baseHeight,
            position: { ...position, y: maxY - 0.2 },
            world,
        });
        assert.equal(overlapping.requiresRelocation, true);
    });

    test('relocates an invalid actor to the nearest deterministic cardinal portal or perimeter point', () => {
        for (const rotation of rotations) {
            const structure = house(rotation);
            const plan = collection([structure]);
            const world = createGardenStructureAvatarCollisionWorld(structure);
            const propBounds = structure.propCollisionBoxes.bounds;
            const position = {
                x: ((propBounds[0] ?? 0) + (propBounds[2] ?? 0)) / 2,
                y: baseHeight,
                z: ((propBounds[1] ?? 0) + (propBounds[3] ?? 0)) / 2,
            };
            assert.equal(
                getGardenAvatarGroundY({
                    currentGroundY: position.y,
                    position,
                    world,
                }),
                null,
                `rotation ${rotation.toString()} starts blocked by the prop`,
            );
            const first = findGardenStructureAvatarSafeRelocation({
                collection: plan,
                position,
                preferredStructureId: structure.structureId,
                world,
            });
            const second = findGardenStructureAvatarSafeRelocation({
                collection: plan,
                position,
                preferredStructureId: structure.structureId,
                world,
            });
            assert.ok(first);
            assert.deepEqual(first, second);
            assert.notEqual(
                getGardenAvatarGroundY({
                    collisionHeight: gardenAvatarStandingCollisionHeight,
                    currentGroundY: first.y,
                    position: first,
                    world,
                }),
                null,
            );

            const portalCells = structure.openPortals.ids.flatMap(
                (_, index) => {
                    const cells = transitionCells(structure.openPortals, index);
                    return [cells.from, cells.to];
                },
            );
            const isPortalCell = portalCells.some(
                (cell) => cell.x === first.x && cell.z === first.z,
            );
            const isCardinalPerimeterCell = structure.footprint.ids.some(
                (_, index) => {
                    const cell = packedCell(structure.footprint, index);
                    return (
                        Math.abs(cell.x - first.x) +
                            Math.abs(cell.z - first.z) ===
                            1 &&
                        structure.footprint.indexByKey[
                            `${first.x}|${first.z}`
                        ] === undefined
                    );
                },
            );
            assert.equal(isPortalCell || isCardinalPerimeterCell, true);
        }
    });
});

describe('garden structure avatar camera wall policy', () => {
    test('keeps partitions camera-solid but permits a suppressed exterior window', () => {
        const structure = house(0);
        const partitionIndex = structure.blockedTransitions.edgeIds.indexOf(
            'partition-wall-north',
        );
        const windowIndex =
            structure.blockedTransitions.edgeIds.indexOf('window-north');
        assert.notEqual(partitionIndex, -1);
        assert.notEqual(windowIndex, -1);
        const partition = transitionCells(
            structure.blockedTransitions,
            partitionIndex,
        );
        const window = transitionCells(
            structure.blockedTransitions,
            windowIndex,
        );
        const partitionResult = resolveGardenStructureThirdPersonCameraPosition(
            {
                desiredPosition: { ...partition.to, y: 1.4 },
                hiddenInstanceIds: new Set(),
                structure,
                targetPosition: { ...partition.from, y: 1.4 },
            },
        );
        assert.ok(
            Math.hypot(
                partitionResult.x - partition.from.x,
                partitionResult.z - partition.from.z,
            ) <
                Math.hypot(
                    partition.to.x - partition.from.x,
                    partition.to.z - partition.from.z,
                ),
        );

        const windowResult = resolveGardenStructureThirdPersonCameraPosition({
            desiredPosition: { ...window.to, y: 1.4 },
            hiddenInstanceIds: new Set([
                `edge:${structure.structureId}:window-north`,
            ]),
            structure,
            targetPosition: { ...window.from, y: 1.4 },
        });
        assert.deepEqual(windowResult, { ...window.to, y: 1.4 });
    });

    test('lets a pitched third-person camera ray pass above the wall height', () => {
        const structure = house(0);
        const partitionIndex = structure.blockedTransitions.edgeIds.indexOf(
            'partition-wall-north',
        );
        assert.notEqual(partitionIndex, -1);
        const partition = transitionCells(
            structure.blockedTransitions,
            partitionIndex,
        );
        const collisionIndex = structure.wallCollisionBoxes.sourceIds.findIndex(
            (sourceIds) => sourceIds.includes('partition-wall-north'),
        );
        assert.notEqual(collisionIndex, -1);
        const wallMaxY =
            structure.wallCollisionBoxes.bounds[collisionIndex * 6 + 5];
        assert.ok(wallMaxY !== undefined);
        const desiredPosition = {
            ...partition.to,
            y: wallMaxY + 6,
        };

        const result = resolveGardenStructureThirdPersonCameraPosition({
            desiredPosition,
            hiddenInstanceIds: new Set(),
            structure,
            targetPosition: { ...partition.from, y: 1.4 },
        });

        assert.deepEqual(result, desiredPosition);
    });
});
