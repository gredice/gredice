import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    createGardenStructureTemplateSeed,
    type GardenStructureDocumentV1,
    type GardenStructureRotation,
    gardenStructureSchemaVersion,
} from '@gredice/js/gardenStructures';
import {
    findGardenAvatarSpawnPoint,
    gardenAvatarStandingCollisionHeight,
    getGardenAvatarGroundY,
    mergeGardenAvatarCollisionWorlds,
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

function customDocument({
    cells,
    edges,
}: {
    cells: GardenStructureDocumentV1['footprint']['cells'];
    edges: GardenStructureDocumentV1['edges'];
}): GardenStructureDocumentV1 {
    return {
        schemaVersion: gardenStructureSchemaVersion,
        footprint: { cells },
        floors: cells.map((cell) => ({
            cell: { x: cell.x, y: cell.y },
            materialId: 'floor.timber',
        })),
        edges,
        roofRegions: [],
        props: [],
    };
}

function compileCustomStructure({
    document,
    rotation,
    structureId,
}: {
    document: GardenStructureDocumentV1;
    rotation: GardenStructureRotation;
    structureId: string;
}) {
    return compileGardenStructurePlan({
        baseHeight,
        document,
        placement: { anchorX: 0, anchorY: 0, rotation },
        revision: 1,
        structureId,
    });
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

describe('garden structure avatar preferred spawn', () => {
    test('keeps a preferred interior spawn below a high roof and rejects solid structure volumes', () => {
        const structure = house(0, 'spawn-house', 0, 0);
        const terrainWorld = {
            blockedCells: [],
            surfaces: Array.from({ length: 20 * 20 }, (_, index) => ({
                kind: 'ground' as const,
                roamable: true,
                x: index % 20,
                y: 0,
                z: Math.floor(index / 20),
            })),
        };
        const world = mergeGardenAvatarCollisionWorlds(
            terrainWorld,
            createGardenStructureAvatarCollisionWorld(structure),
        );
        const preferredInterior = { x: 1, z: 2 };

        assert.deepEqual(
            findGardenAvatarSpawnPoint(world, preferredInterior),
            { ...preferredInterior, y: baseHeight },
            'the roof remains an overhead ceiling rather than a 2D spawn blocker',
        );

        const propSpawn = findGardenAvatarSpawnPoint(world, { x: 1, z: 1 });
        assert.ok(propSpawn);
        assert.notDeepEqual(
            { x: propSpawn.x, z: propSpawn.z },
            { x: 1, z: 1 },
            'a preferred spawn cannot stand on or intersect a non-roamable prop',
        );

        const windowIndex =
            structure.blockedTransitions.edgeIds.indexOf('window-north');
        assert.notEqual(windowIndex, -1);
        const segmentOffset = windowIndex * 4;
        const startX = structure.blockedTransitions.segments[segmentOffset];
        const startZ = structure.blockedTransitions.segments[segmentOffset + 1];
        const endX = structure.blockedTransitions.segments[segmentOffset + 2];
        const endZ = structure.blockedTransitions.segments[segmentOffset + 3];
        assert.ok(
            startX !== undefined &&
                startZ !== undefined &&
                endX !== undefined &&
                endZ !== undefined,
        );
        const wallPosition = {
            x: (startX + endX) / 2,
            z: (startZ + endZ) / 2,
        };
        const wallSpawn = findGardenAvatarSpawnPoint(world, wallPosition);
        assert.ok(wallSpawn);
        assert.notDeepEqual(
            { x: wallSpawn.x, z: wallSpawn.z },
            wallPosition,
            'a preferred spawn cannot intersect a wall volume',
        );

        const lowCeilingPosition = { x: 10, z: 10 };
        const lowCeilingWorld = mergeGardenAvatarCollisionWorlds(terrainWorld, {
            blockedCells: [],
            surfaces: [
                {
                    bottomY: 0.8,
                    halfDepth: 0.5,
                    halfWidth: 0.5,
                    kind: 'ground',
                    roamable: false,
                    x: lowCeilingPosition.x,
                    y: 0.86,
                    z: lowCeilingPosition.z,
                },
            ],
        });
        const lowCeilingSpawn = findGardenAvatarSpawnPoint(
            lowCeilingWorld,
            lowCeilingPosition,
        );
        assert.ok(lowCeilingSpawn);
        assert.notDeepEqual(
            { x: lowCeilingSpawn.x, z: lowCeilingSpawn.z },
            lowCeilingPosition,
            'a preferred spawn still requires standing headroom',
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

    test('requests relocation when a structure edit seals a collision-free actor inside', () => {
        const sealedRoom = compileCustomStructure({
            document: customDocument({
                cells: [
                    { x: 0, y: 0, spaceKind: 'interior' },
                    { x: 1, y: 0, spaceKind: 'interior' },
                    { x: 0, y: 1, spaceKind: 'interior' },
                    { x: 1, y: 1, spaceKind: 'interior' },
                ],
                edges: [
                    ...[0, 1].flatMap((x) => [
                        {
                            id: `sealed-north-${x.toString()}`,
                            direction: 'north' as const,
                            from: { x, y: 0 },
                            kind: 'wall' as const,
                            partId: 'wall.timber',
                        },
                        {
                            id: `sealed-south-${x.toString()}`,
                            direction: 'north' as const,
                            from: { x, y: 2 },
                            kind: 'wall' as const,
                            partId: 'wall.timber',
                        },
                    ]),
                    ...[0, 1].flatMap((y) => [
                        {
                            id: `sealed-west-${y.toString()}`,
                            direction: 'east' as const,
                            from: { x: -1, y },
                            kind: 'wall' as const,
                            partId: 'wall.timber',
                        },
                        {
                            id: `sealed-east-${y.toString()}`,
                            direction: 'east' as const,
                            from: { x: 1, y },
                            kind: 'wall' as const,
                            partId: 'wall.timber',
                        },
                    ]),
                ],
            }),
            rotation: 0,
            structureId: 'sealed-room',
        });
        const plan = collection([sealedRoom]);
        const world = createGardenStructureAvatarCollisionWorld(sealedRoom);
        const position = { x: 0, y: baseHeight, z: 0 };

        assert.equal(
            resolveGardenStructureAvatarWorldChangePose({
                grounded: true,
                groundY: baseHeight,
                position,
                world,
            }).requiresRelocation,
            false,
            'the actor envelope itself remains clear',
        );
        assert.equal(
            resolveGardenStructureAvatarWorldChangePose({
                collection: plan,
                grounded: true,
                groundY: baseHeight,
                position,
                world,
            }).requiresRelocation,
            true,
            'bounded topology validation detects the missing exit route',
        );
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

    test('rejects an enclosed concave footprint gap as a safe relocation', () => {
        const ringDocument = customDocument({
            cells: [
                { x: 0, y: 0, spaceKind: 'interior' },
                { x: 1, y: 0, spaceKind: 'interior' },
                { x: 2, y: 0, spaceKind: 'interior' },
                { x: 0, y: 1, spaceKind: 'interior' },
                { x: 2, y: 1, spaceKind: 'interior' },
                { x: 0, y: 2, spaceKind: 'interior' },
                { x: 1, y: 2, spaceKind: 'interior' },
                { x: 2, y: 2, spaceKind: 'interior' },
            ],
            edges: [
                {
                    id: 'hole-north',
                    direction: 'north',
                    from: { x: 1, y: 1 },
                    kind: 'wall',
                    partId: 'wall.timber',
                },
                {
                    id: 'hole-south',
                    direction: 'north',
                    from: { x: 1, y: 2 },
                    kind: 'wall',
                    partId: 'wall.timber',
                },
                {
                    id: 'hole-west',
                    direction: 'east',
                    from: { x: 0, y: 1 },
                    kind: 'wall',
                    partId: 'wall.timber',
                },
                {
                    id: 'hole-east',
                    direction: 'east',
                    from: { x: 1, y: 1 },
                    kind: 'wall',
                    partId: 'wall.timber',
                },
            ],
        });

        for (const rotation of rotations) {
            const structure = compileCustomStructure({
                document: ringDocument,
                rotation,
                structureId: `ring-${rotation.toString()}`,
            });
            const plan = collection([structure]);
            const world = createGardenStructureAvatarCollisionWorld(structure);
            const hole = {
                x:
                    (structure.footprint.bounds.minX +
                        structure.footprint.bounds.maxX) /
                    2,
                z:
                    (structure.footprint.bounds.minY +
                        structure.footprint.bounds.maxY) /
                    2,
            };
            const start = packedCell(
                structure.footprint,
                structure.footprint.ids.findIndex((_, index) => {
                    const cell = packedCell(structure.footprint, index);
                    return (
                        Math.abs(cell.x - hole.x) +
                            Math.abs(cell.z - hole.z) ===
                        1
                    );
                }),
            );
            const relocation = findGardenStructureAvatarSafeRelocation({
                collection: plan,
                position: { ...start, y: baseHeight },
                preferredStructureId: structure.structureId,
                world,
            });

            assert.ok(relocation);
            assert.notDeepEqual(
                { x: relocation.x, z: relocation.z },
                hole,
                `rotation ${rotation.toString()} avoids the enclosed hole`,
            );
            assert.equal(
                relocation.x < Math.ceil(structure.footprint.bounds.minX) ||
                    relocation.x >
                        Math.floor(structure.footprint.bounds.maxX) ||
                    relocation.z < Math.ceil(structure.footprint.bounds.minY) ||
                    relocation.z > Math.floor(structure.footprint.bounds.maxY),
                true,
                `rotation ${rotation.toString()} relocates to an exterior roam point`,
            );
        }
    });
});

describe('garden structure avatar camera wall policy', () => {
    test('separates adjacent exterior and partition camera collision in every rotation', () => {
        const mixedWallDocument = customDocument({
            cells: [
                { x: 0, y: 0, spaceKind: 'interior' },
                { x: 0, y: 1, spaceKind: 'interior' },
                { x: 1, y: 1, spaceKind: 'interior' },
            ],
            edges: [
                {
                    id: 'mixed-partition',
                    direction: 'north',
                    from: { x: 0, y: 1 },
                    kind: 'wall',
                    partId: 'wall.timber',
                },
                {
                    id: 'mixed-exterior',
                    direction: 'north',
                    from: { x: 1, y: 1 },
                    kind: 'wall',
                    partId: 'wall.timber',
                },
            ],
        });

        for (const rotation of rotations) {
            const structure = compileCustomStructure({
                document: mixedWallDocument,
                rotation,
                structureId: `mixed-wall-${rotation.toString()}`,
            });
            const partitionIndex =
                structure.blockedTransitions.edgeIds.indexOf('mixed-partition');
            const exteriorIndex =
                structure.blockedTransitions.edgeIds.indexOf('mixed-exterior');
            assert.notEqual(partitionIndex, -1);
            assert.notEqual(exteriorIndex, -1);
            assert.equal(
                structure.wallCollisionBoxes.sourceIds.some(
                    (sourceIds) =>
                        sourceIds.includes('mixed-partition') &&
                        sourceIds.includes('mixed-exterior'),
                ),
                false,
                `rotation ${rotation.toString()} keeps cutaway classes separate`,
            );

            const exterior = transitionCells(
                structure.blockedTransitions,
                exteriorIndex,
            );
            const exteriorFromInside = Object.hasOwn(
                structure.footprint.indexByKey,
                `${exterior.from.x}|${exterior.from.z}`,
            );
            const exteriorInside = exteriorFromInside
                ? exterior.from
                : exterior.to;
            const exteriorOutside = exteriorFromInside
                ? exterior.to
                : exterior.from;
            const presentation = getGardenStructureAvatarInteriorPresentation({
                avatarPosition: exteriorInside,
                cameraPosition: exteriorOutside,
                collection: collection([structure]),
            });
            assert.ok(
                presentation.hiddenInstanceIds.includes(
                    `edge:${structure.structureId}:mixed-exterior`,
                ),
            );
            const hiddenInstanceIds = new Set(presentation.hiddenInstanceIds);
            const exteriorDesired = { ...exteriorOutside, y: 1.4 };
            assert.deepEqual(
                resolveGardenStructureThirdPersonCameraPosition({
                    desiredPosition: exteriorDesired,
                    hiddenInstanceIds,
                    structure,
                    targetPosition: { ...exteriorInside, y: 1.4 },
                }),
                exteriorDesired,
                `rotation ${rotation.toString()} permits the hidden exterior segment`,
            );

            const partition = transitionCells(
                structure.blockedTransitions,
                partitionIndex,
            );
            const partitionResult =
                resolveGardenStructureThirdPersonCameraPosition({
                    desiredPosition: { ...partition.to, y: 1.4 },
                    hiddenInstanceIds,
                    structure,
                    targetPosition: { ...partition.from, y: 1.4 },
                });
            assert.ok(
                Math.hypot(
                    partitionResult.x - partition.from.x,
                    partitionResult.z - partition.from.z,
                ) <
                    Math.hypot(
                        partition.to.x - partition.from.x,
                        partition.to.z - partition.from.z,
                    ),
                `rotation ${rotation.toString()} keeps the adjacent partition solid`,
            );
        }
    });

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
