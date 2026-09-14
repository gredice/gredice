import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import type { AnimalMovementSurface } from '../animals/animalMovementTerrain';
import {
    createGardenAvatarCollisionWorld,
    createIndexedGardenAvatarCollisionWorld,
    findGardenAvatarRoute,
    findGardenAvatarSpawnPoint,
    type GardenAvatarCollisionWorld,
    gardenAvatarCrouchingCollisionHeight,
    getGardenAvatarCeilingY,
    getGardenAvatarCollisionCandidates,
    getGardenAvatarGroundY,
    getGardenAvatarNextJumpCount,
    getGardenAvatarRoamBlockedCells,
    getGardenAvatarRoamTargets,
    getGardenAvatarSurfaceY,
    resolveGardenAvatarHorizontalMovement,
} from './gardenAvatarMovement';

function ground(x: number, z: number, y = 0): AnimalMovementSurface {
    return { kind: 'ground', x, y, z };
}

function grid({
    maxX,
    maxZ,
    minX,
    minZ,
}: {
    maxX: number;
    maxZ: number;
    minX: number;
    minZ: number;
}) {
    const surfaces: AnimalMovementSurface[] = [];
    for (let x = minX; x <= maxX; x += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
            surfaces.push(ground(x, z));
        }
    }
    return surfaces;
}

test('stops the avatar radius before occupied garden cells', () => {
    const world: GardenAvatarCollisionWorld = {
        blockedCells: [{ x: 1, z: 0 }],
        surfaces: grid({ minX: -1, maxX: 2, minZ: -1, maxZ: 1 }),
    };
    const result = resolveGardenAvatarHorizontalMovement({
        deltaX: 2,
        deltaZ: 0,
        position: { x: 0, y: 0, z: 0 },
        world,
    });

    assert.equal(result.collided, true);
    assert.ok(result.position.x <= 0.32);
});

test('slides along obstacles instead of cancelling all movement', () => {
    const world: GardenAvatarCollisionWorld = {
        blockedCells: [{ x: 1, z: 0 }],
        surfaces: grid({ minX: -1, maxX: 2, minZ: -2, maxZ: 2 }),
    };
    const result = resolveGardenAvatarHorizontalMovement({
        deltaX: 1,
        deltaZ: 1,
        position: { x: 0, y: 0, z: 0 },
        world,
    });

    assert.equal(result.collided, true);
    assert.ok(result.position.x > 0);
    assert.ok(result.position.z > 0.8);
});

test('allows the avatar to walk beyond placed terrain onto the base plane', () => {
    const world: GardenAvatarCollisionWorld = {
        blockedCells: [],
        surfaces: [ground(0, 0)],
    };
    const result = resolveGardenAvatarHorizontalMovement({
        deltaX: 1,
        deltaZ: 0,
        position: { x: 0, y: 0, z: 0 },
        world,
    });

    assert.equal(result.collided, false);
    assert.ok(Math.abs(result.position.x - 1) < 0.000_001);
    assert.equal(result.position.y, 0);
});

test('accepts ordinary terrain steps and rejects tall ledges', () => {
    const stepWorld: GardenAvatarCollisionWorld = {
        blockedCells: [],
        surfaces: [ground(0, 0), ground(1, 0, 0.3)],
    };
    const ledgeWorld: GardenAvatarCollisionWorld = {
        blockedCells: [],
        surfaces: [ground(0, 0), ground(1, 0, 0.8)],
    };

    assert.equal(
        getGardenAvatarGroundY({
            currentGroundY: 0,
            position: { x: 0.55, z: 0 },
            world: stepWorld,
        }),
        0.3,
    );
    assert.equal(
        getGardenAvatarGroundY({
            currentGroundY: 0,
            position: { x: 0.55, z: 0 },
            world: ledgeWorld,
        }),
        null,
    );
});

test('allows a ledge within jump reach while airborne', () => {
    const world: GardenAvatarCollisionWorld = {
        blockedCells: [],
        surfaces: [ground(0, 0), ground(1, 0, 0.8)],
    };
    const result = resolveGardenAvatarHorizontalMovement({
        deltaX: 0.7,
        deltaZ: 0,
        maxStepHeight: 0.9,
        position: { x: 0, y: 0, z: 0 },
        world,
    });

    assert.equal(result.collided, false);
    assert.equal(result.position.y, 0.8);
});

test('allows descending from a ledge without treating the drop as a wall', () => {
    const world: GardenAvatarCollisionWorld = {
        blockedCells: [],
        surfaces: [ground(0, 0, 0.8)],
    };
    const result = resolveGardenAvatarHorizontalMovement({
        deltaX: 1,
        deltaZ: 0,
        position: { x: 0, y: 0.8, z: 0 },
        world,
    });

    assert.equal(result.collided, false);
    assert.equal(result.position.y, 0);
});

test('uses complete stack heights as walkable avatar terrain', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [
                    { id: 'grass-1', name: 'Block_Grass', rotation: 0 },
                    { id: 'grass-2', name: 'Block_Grass', rotation: 0 },
                ],
                position: new Vector3(2, 0, -1),
            },
        ],
    });

    assert.equal(world.blockedCells.length, 0);
    assert.equal(Math.max(...world.surfaces.map((surface) => surface.y)), 0.8);
    assert.deepEqual(getGardenAvatarRoamTargets(world), [
        { x: 2, y: 0.8, z: -1 },
    ]);
});

test('follows angled terrain height continuously instead of flattening it', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [
                    { id: 'slope', name: 'Block_Grass_Angle', rotation: 0 },
                ],
                position: new Vector3(0, 0, 0),
            },
        ],
    });
    const slope = world.surfaces[0];

    assert.ok(slope);
    assert.equal(getGardenAvatarSurfaceY({ x: -0.5, z: 0 }, slope), 0);
    assert.equal(getGardenAvatarSurfaceY({ x: 0, z: 0 }, slope), 0.2);
    assert.equal(getGardenAvatarSurfaceY({ x: 0.5, z: 0 }, slope), 0.4);
});

test('walks smoothly from the base plane across a slope onto raised terrain', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [
                    { id: 'slope', name: 'Block_Grass_Angle', rotation: 0 },
                ],
                position: new Vector3(0, 0, 0),
            },
            {
                blocks: [{ id: 'upper', name: 'Block_Grass', rotation: 0 }],
                position: new Vector3(1, 0, 0),
            },
        ],
    });
    const halfway = resolveGardenAvatarHorizontalMovement({
        deltaX: 0.5,
        deltaZ: 0,
        position: { x: -0.5, y: 0, z: 0 },
        world,
    });
    const upper = resolveGardenAvatarHorizontalMovement({
        deltaX: 1,
        deltaZ: 0,
        position: halfway.position,
        world,
    });

    assert.equal(halfway.collided, false);
    assert.ok(Math.abs(halfway.position.y - 0.2) < 0.000_001);
    assert.equal(upper.collided, false);
    assert.ok(Math.abs(upper.position.x - 1) < 0.000_001);
    assert.equal(upper.position.y, 0.4);
});

test('matches the rendered orientation of a quarter-turned slope', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [
                    { id: 'slope', name: 'Block_Sand_Angle', rotation: 1 },
                ],
                position: new Vector3(0, 0, 0),
            },
        ],
    });
    const slope = world.surfaces[0];

    assert.ok(slope);
    assert.equal(getGardenAvatarSurfaceY({ x: 0, z: -0.5 }, slope), 0.4);
    assert.equal(getGardenAvatarSurfaceY({ x: 0, z: 0.5 }, slope), 0);
});

test('matches corner and reverse-corner terrain silhouettes', () => {
    const corner = {
        bottomY: 0,
        kind: 'ground',
        slopeBlockName: 'Block_Grass_Corner',
        x: 0,
        y: 0.4,
        z: 0,
    } satisfies GardenAvatarCollisionWorld['surfaces'][number];
    const reverseCorner = {
        ...corner,
        slopeBlockName: 'Block_Grass_Reverse_Corner',
    };

    assert.equal(getGardenAvatarSurfaceY({ x: 0.5, z: 0.5 }, corner), 0.4);
    assert.equal(getGardenAvatarSurfaceY({ x: 0.5, z: -0.5 }, corner), 0);
    assert.equal(
        getGardenAvatarSurfaceY({ x: -0.5, z: -0.5 }, reverseCorner),
        0,
    );
    assert.equal(
        getGardenAvatarSurfaceY({ x: 0.5, z: -0.5 }, reverseCorner),
        0.4,
    );
});

test('follows the middle and top levels of two-step stone stairs', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [
                    {
                        id: 'stone-stairs',
                        name: 'Block_Stone_Stairs',
                        rotation: 0,
                    },
                ],
                position: new Vector3(0, 0, 0),
            },
        ],
    });
    const stairs = world.surfaces[0];

    assert.ok(stairs);
    assert.equal(getGardenAvatarSurfaceY({ x: -0.5, z: 0 }, stairs), 0.2);
    assert.equal(getGardenAvatarSurfaceY({ x: -0.01, z: 0 }, stairs), 0.2);
    assert.equal(getGardenAvatarSurfaceY({ x: 0, z: 0 }, stairs), 0.4);
    assert.equal(getGardenAvatarSurfaceY({ x: 0.5, z: 0 }, stairs), 0.4);
});

test('follows full-tile corner stair levels across rotations and aliases', () => {
    for (const name of [
        'Block_Stone_Stairs_Corner',
        'Block_Polished_Stone_Stairs_Corner',
        'Block_Stone_Stairs_Half',
    ]) {
        for (const rotation of [0, 1, 2, 3]) {
            const surface = createGardenAvatarCollisionWorld({
                blockData: getLocalSandboxBlockData(),
                stacks: [
                    {
                        blocks: [{ id: `${name}-${rotation}`, name, rotation }],
                        position: new Vector3(0, 0, 0),
                    },
                ],
            }).surfaces[0];
            const angle = rotation * (Math.PI / 2);
            const worldPoint = (localX: number, localZ: number) => ({
                x: localX * Math.cos(angle) + localZ * Math.sin(angle),
                z: -localX * Math.sin(angle) + localZ * Math.cos(angle),
            });

            assert.ok(surface);
            assert.equal(surface.halfWidth, 0.5);
            assert.equal(surface.halfDepth, 0.5);
            assert.equal(surface.x, 0);
            assert.equal(surface.z, 0);
            assert.equal(
                getGardenAvatarSurfaceY(worldPoint(0.25, -0.25), surface),
                0.4,
            );
            for (const [localX, localZ] of [
                [-0.25, -0.25],
                [-0.25, 0.25],
                [0.25, 0.25],
            ] satisfies readonly [number, number][]) {
                assert.equal(
                    getGardenAvatarSurfaceY(
                        worldPoint(localX, localZ),
                        surface,
                    ),
                    0.2,
                );
            }
        }
    }
});

test('allows one grounded jump and one airborne jump', () => {
    assert.equal(
        getGardenAvatarNextJumpCount({ grounded: true, jumpsUsed: 0 }),
        1,
    );
    assert.equal(
        getGardenAvatarNextJumpCount({ grounded: false, jumpsUsed: 1 }),
        2,
    );
    assert.equal(
        getGardenAvatarNextJumpCount({ grounded: false, jumpsUsed: 2 }),
        null,
    );
    assert.equal(
        getGardenAvatarNextJumpCount({ grounded: false, jumpsUsed: 0 }),
        2,
    );
});

test('walks on the support below water instead of the water surface', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [
                    { id: 'grass', name: 'Block_Grass', rotation: 0 },
                    { id: 'water', name: 'Block_Water', rotation: 0 },
                ],
                position: new Vector3(0, 0, 0),
            },
        ],
    });
    const water = world.surfaces.find((surface) => surface.kind === 'water');

    assert.equal(water?.y, 0.4);
    assert.equal(
        getGardenAvatarGroundY({
            currentGroundY: 0.4,
            position: { x: 0, z: 0 },
            world,
        }),
        0.4,
    );
    assert.equal(findGardenAvatarSpawnPoint(world), null);
    assert.equal(findGardenAvatarSpawnPoint(world, { x: 0, z: 0 }), null);
});

test('uses narrow trunk collision instead of a tree canopy-sized box', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [{ id: 'tree', name: 'Tree', rotation: 0 }],
                position: new Vector3(0, 0, 0),
            },
        ],
    });
    const tree = world.surfaces[0];

    assert.equal(tree?.halfWidth, 0.21);
    assert.equal(tree?.halfDepth, 0.21);
    assert.equal(
        getGardenAvatarGroundY({
            currentGroundY: 0,
            position: { x: 0.45, z: 0 },
            world,
        }),
        0,
    );
});

test('uses model-sized fence posts and leaves disconnected gaps walkable', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [{ id: 'fence-a', name: 'Fence', rotation: 0 }],
                position: new Vector3(0, 0, 0),
            },
            {
                blocks: [{ id: 'fence-b', name: 'Fence', rotation: 0 }],
                position: new Vector3(1, 0, 1),
            },
        ],
    });
    const result = resolveGardenAvatarHorizontalMovement({
        deltaX: 0,
        deltaZ: 2.5,
        position: { x: 0.4, y: 0, z: -1 },
        world,
    });

    assert.equal(world.surfaces.length, 2);
    assert.ok(
        world.surfaces.every(
            (surface) =>
                surface.halfWidth === 0.075 && surface.halfDepth === 0.075,
        ),
    );
    assert.equal(result.collided, false);
    assert.ok(Math.abs(result.position.z - 1.5) < 0.000_001);
});

test('adds narrow rails only between connected fence posts', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [{ id: 'fence-a', name: 'Fence', rotation: 0 }],
                position: new Vector3(0, 0, 0),
            },
            {
                blocks: [{ id: 'fence-b', name: 'Fence', rotation: 0 }],
                position: new Vector3(1, 0, 0),
            },
        ],
    });

    assert.equal(world.surfaces.length, 4);
    assert.equal(
        world.surfaces.filter(
            (surface) =>
                surface.halfWidth === 0.2125 && surface.halfDepth === 0.075,
        ).length,
        2,
    );
});

test('models an isolated white fence as three pointed pickets', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [
                    { id: 'white-fence', name: 'WhiteFence', rotation: 0 },
                ],
                position: new Vector3(0, 0, 0),
            },
        ],
    });

    assert.equal(world.surfaces.length, 4);
    assert.deepEqual(
        world.surfaces
            .filter(
                (surface) =>
                    surface.halfWidth === 0.1075 &&
                    surface.halfDepth === 0.0225,
            )
            .map((surface) => surface.x)
            .sort((left, right) => left - right),
        [-0.25, 0, 0.25],
    );
    assert.equal(
        world.surfaces.filter(
            (surface) =>
                surface.halfWidth === 0.25 && surface.halfDepth === 0.02,
        ).length,
        1,
    );

    const rotatedWorld = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [
                    {
                        id: 'white-fence-rotated',
                        name: 'WhiteFence',
                        rotation: 1,
                    },
                ],
                position: new Vector3(0, 0, 0),
            },
        ],
    });
    assert.equal(
        rotatedWorld.surfaces.filter(
            (surface) =>
                surface.halfWidth === 0.0225 && surface.halfDepth === 0.1075,
        ).length,
        3,
    );
});

test('uses repeated plank pickets and rails for connected white fences', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [
                    { id: 'white-fence-a', name: 'WhiteFence', rotation: 0 },
                ],
                position: new Vector3(0, 0, 0),
            },
            {
                blocks: [
                    { id: 'white-fence-b', name: 'WhiteFence', rotation: 0 },
                ],
                position: new Vector3(1, 0, 0),
            },
        ],
    });

    assert.equal(world.surfaces.length, 8);
    assert.equal(
        world.surfaces.filter(
            (surface) =>
                surface.halfWidth === 0.1075 &&
                surface.halfDepth === 0.0225 &&
                surface.y === 0.72,
        ).length,
        4,
    );
    assert.equal(
        world.surfaces.filter(
            (surface) =>
                surface.halfWidth === 0.0225 &&
                surface.halfDepth === 0.1075 &&
                surface.y === 0.72,
        ).length,
        2,
    );
    assert.equal(
        world.surfaces.filter(
            (surface) =>
                surface.halfWidth === 0.19625 && surface.halfDepth === 0.02,
        ).length,
        2,
    );
});

test('rotates a white fence center picket with its resolved corner', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [
                    {
                        id: 'white-fence-center',
                        name: 'WhiteFence',
                        rotation: 0,
                    },
                ],
                position: new Vector3(0, 0, 0),
            },
            {
                blocks: [
                    {
                        id: 'white-fence-south',
                        name: 'WhiteFence',
                        rotation: 0,
                    },
                ],
                position: new Vector3(-1, 0, 0),
            },
            {
                blocks: [
                    { id: 'white-fence-east', name: 'WhiteFence', rotation: 0 },
                ],
                position: new Vector3(0, 0, -1),
            },
        ],
    });
    const centerPicket = world.surfaces.find(
        (surface) =>
            surface.x === 0 &&
            surface.z === 0 &&
            surface.roamBlockedCells?.some(
                (cell) => cell.x === 0 && cell.z === 0,
            ),
    );

    assert.equal(centerPicket?.halfWidth, 0.0225);
    assert.equal(centerPicket?.halfDepth, 0.1075);
});

test('uses the brown fence for the full span to a white pole', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [
                    { id: 'white-fence', name: 'WhiteFence', rotation: 0 },
                ],
                position: new Vector3(0, 0, 0),
            },
            {
                blocks: [{ id: 'brown-fence', name: 'Fence', rotation: 0 }],
                position: new Vector3(1, 0, 0),
            },
        ],
    });

    assert.equal(world.surfaces.length, 4);
    assert.deepEqual(
        world.surfaces
            .filter(
                (surface) =>
                    surface.y === 0.55 && (surface.halfWidth ?? 0) > 0.1,
            )
            .map((surface) => surface.halfWidth ?? 0)
            .sort(),
        [0.2125, 0.25],
    );
});

test('models isolated stone fences as pillars without connecting walls', () => {
    for (const name of ['StoneFence', 'PolishedStoneFence']) {
        const world = createGardenAvatarCollisionWorld({
            blockData: getLocalSandboxBlockData(),
            stacks: [
                {
                    blocks: [{ id: `${name}-solo`, name, rotation: 0 }],
                    position: new Vector3(0, 0, 0),
                },
            ],
        });

        assert.equal(world.surfaces.length, 1);
        assert.equal(world.surfaces[0]?.halfDepth, 0.14);
        assert.equal(world.surfaces[0]?.halfWidth, 0.14);
        assert.equal(world.surfaces[0]?.y, 0.68);
    }
});

test('uses material-specific wall thickness for connected stone fences', () => {
    for (const { name, wallHalfThickness } of [
        { name: 'StoneFence', wallHalfThickness: 0.08 },
        { name: 'PolishedStoneFence', wallHalfThickness: 0.14 },
    ]) {
        const world = createGardenAvatarCollisionWorld({
            blockData: getLocalSandboxBlockData(),
            stacks: [
                {
                    blocks: [{ id: `${name}-a`, name, rotation: 0 }],
                    position: new Vector3(0, 0, 0),
                },
                {
                    blocks: [{ id: `${name}-b`, name, rotation: 0 }],
                    position: new Vector3(1, 0, 0),
                },
            ],
        });
        const walls = world.surfaces.filter(
            (surface) =>
                surface.halfWidth === 0.18 &&
                surface.halfDepth === wallHalfThickness,
        );

        assert.equal(world.surfaces.length, 4);
        assert.equal(walls.length, 2);
        assert.ok(walls.every((surface) => surface.y === 0.48));
    }
});

test('connects rough and polished stone fence walls together', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [
                    { id: 'rough-stone', name: 'StoneFence', rotation: 0 },
                ],
                position: new Vector3(0, 0, 0),
            },
            {
                blocks: [
                    {
                        id: 'polished-stone',
                        name: 'PolishedStoneFence',
                        rotation: 0,
                    },
                ],
                position: new Vector3(1, 0, 0),
            },
        ],
    });

    assert.equal(world.surfaces.length, 4);
    assert.deepEqual(
        world.surfaces
            .filter((surface) => surface.y === 0.48)
            .map(
                (surface) =>
                    [surface.halfWidth ?? 0, surface.halfDepth ?? 0] satisfies [
                        number,
                        number,
                    ],
            )
            .sort(([left], [right]) => left - right),
        [
            [0.18, 0.08],
            [0.25, 0.08],
        ],
    );
});

test('closed gates block the avatar and open gates leave a center passage', () => {
    for (const name of [
        'FenceGate',
        'WhiteFenceGate',
        'StoneFenceGate',
        'PolishedStoneFenceGate',
    ]) {
        const createWorld = (variant: number) =>
            createGardenAvatarCollisionWorld({
                blockData: getLocalSandboxBlockData(),
                stacks: [
                    {
                        blocks: [
                            {
                                id: `${name}-ground`,
                                name: 'Block_Grass',
                                rotation: 0,
                            },
                            {
                                id: `${name}-gate`,
                                name,
                                rotation: 0,
                                variant,
                            },
                        ],
                        position: new Vector3(0, 0, 0),
                    },
                ],
            });
        const closedWorld = createWorld(0);
        const openWorld = createWorld(1);
        const moveThrough = (world: ReturnType<typeof createWorld>) =>
            resolveGardenAvatarHorizontalMovement({
                deltaX: 0,
                deltaZ: 1.6,
                position: { x: 0, y: 0.4, z: -0.8 },
                world,
            });

        assert.equal(moveThrough(closedWorld).collided, true, name);
        assert.equal(moveThrough(openWorld).collided, false, name);
        assert.deepEqual(getGardenAvatarRoamBlockedCells(closedWorld), [
            { x: 0, z: 0 },
        ]);
        assert.deepEqual(getGardenAvatarRoamBlockedCells(openWorld), []);
    }
});

test('open gate leaf collision follows the rendered hinge through every rotation', () => {
    const expectedCenters = [
        { x: -0.43, z: 0.43 },
        { x: 0.43, z: 0.43 },
        { x: 0.43, z: -0.43 },
        { x: -0.43, z: -0.43 },
    ];

    for (const [rotation, expected] of expectedCenters.entries()) {
        const world = createGardenAvatarCollisionWorld({
            blockData: [],
            stacks: [
                {
                    blocks: [
                        {
                            id: 'gate',
                            name: 'FenceGate',
                            rotation,
                            variant: 1,
                        },
                    ],
                    position: new Vector3(0, 0, 0),
                },
            ],
        });
        const leaf = world.surfaces.find(
            (surface) =>
                surface.debugLabel === 'FenceGate' &&
                Math.abs(surface.x) > 0.2 &&
                Math.abs(surface.z) > 0.2,
        );

        assert.ok(leaf, `Missing open leaf for rotation ${rotation}`);
        assert.ok(Math.abs(leaf.x - expected.x) < 0.000_01);
        assert.ok(Math.abs(leaf.z - expected.z) < 0.000_01);
    }
});

test('stone gate collision encloses the masonry leaf when closed and open', () => {
    for (const rotation of [0, 1, 2, 3]) {
        for (const variant of [0, 1]) {
            const world = createGardenAvatarCollisionWorld({
                blockData: [],
                stacks: [
                    {
                        blocks: [
                            {
                                id: 'stone-gate',
                                name: 'StoneFenceGate',
                                rotation,
                                variant,
                            },
                        ],
                        position: new Vector3(0, 0, 0),
                    },
                ],
            });
            const leaf = world.surfaces.find((surface) => {
                if (surface.debugLabel !== 'StoneFenceGate') return false;
                return variant === 0
                    ? surface.x === 0 && surface.z === 0
                    : Math.abs(surface.x) > 0.2 && Math.abs(surface.z) > 0.2;
            });

            assert.ok(
                leaf,
                `Missing stone leaf for rotation ${rotation}, variant ${variant}`,
            );
            assert.deepEqual(
                [leaf.halfWidth, leaf.halfDepth].sort(
                    (left, right) => (left ?? 0) - (right ?? 0),
                ),
                [0.09, 0.43],
            );
        }
    }
});

test('normal fences connect to gate posts without filling the gate tile', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [{ id: 'fence', name: 'Fence', rotation: 0 }],
                position: new Vector3(-1, 0, 0),
            },
            {
                blocks: [{ id: 'gate', name: 'WhiteFenceGate', rotation: 0 }],
                position: new Vector3(0, 0, 0),
            },
        ],
    });
    const woodenRails = world.surfaces.filter(
        (surface) =>
            surface.debugLabel === 'Fence' &&
            surface.halfWidth === 0.2125 &&
            surface.halfDepth === 0.075,
    );

    assert.equal(woodenRails.length, 1);
    assert.equal(woodenRails[0]?.x, -0.7125);
});

test('centers multi-cell collisions and blocks their complete roaming footprint', () => {
    const decorationWorld = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [{ id: 'cart', name: 'IceCreamCart', rotation: 0 }],
                position: new Vector3(1, 0, 0),
            },
        ],
    });
    const cart = decorationWorld.surfaces[0];

    assert.equal(cart?.x, 2);
    assert.equal(cart?.z, 0.5);
    assert.equal(cart?.halfWidth, 1.44);
    assert.equal(cart?.halfDepth, 0.94);
    assert.deepEqual(getGardenAvatarRoamBlockedCells(decorationWorld), [
        { x: 1, z: 0 },
        { x: 1, z: 1 },
        { x: 2, z: 0 },
        { x: 2, z: 1 },
        { x: 3, z: 0 },
        { x: 3, z: 1 },
    ]);

    const rotatedWorld = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [{ id: 'cart', name: 'IceCreamCart', rotation: 1 }],
                position: new Vector3(1, 0, 0),
            },
        ],
    });
    const rotatedCart = rotatedWorld.surfaces[0];
    assert.equal(rotatedCart?.x, 1.5);
    assert.equal(rotatedCart?.z, 1);
    assert.equal(rotatedCart?.rotation, Math.PI / 2);
    assert.deepEqual(getGardenAvatarRoamBlockedCells(rotatedWorld), [
        { x: 1, z: 0 },
        { x: 1, z: 1 },
        { x: 1, z: 2 },
        { x: 2, z: 0 },
        { x: 2, z: 1 },
        { x: 2, z: 2 },
    ]);

    const world: GardenAvatarCollisionWorld = {
        blockedCells: [],
        surfaces: [
            ...grid({ minX: 0, maxX: 4, minZ: 0, maxZ: 2 }),
            ...decorationWorld.surfaces,
        ],
    };
    const route = findGardenAvatarRoute({
        from: { x: 0, y: 0, z: 0 },
        to: { x: 4, y: 0, z: 0 },
        world,
    });

    assert.ok(route.some((point) => point.z === 2));
    assert.equal(
        route.some(
            (point) =>
                point.x >= 1 && point.x <= 3 && point.z >= 0 && point.z <= 1,
        ),
        false,
    );
});

test('does not leave a static collision where a roaming Cow was placed', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [
                    { id: 'grass', name: 'Block_Grass', rotation: 0 },
                    { id: 'cow', name: 'Cow', rotation: 0 },
                ],
                position: new Vector3(2, 0, 3),
            },
        ],
    });

    assert.equal(
        world.surfaces.some((surface) => surface.debugLabel === 'Cow'),
        false,
    );
    assert.equal(
        world.surfaces.some(
            (surface) =>
                surface.roamable === true && surface.x === 2 && surface.z === 3,
        ),
        true,
    );
});

test('keeps HazelLightArch centered in one cell and lets the avatar pass between its posts', () => {
    const blockData = getLocalSandboxBlockData();

    for (const walkwayName of ['StoneWalkway', 'WoodenWalkway']) {
        for (const rotation of [0, 1, 2, 3]) {
            const world = createGardenAvatarCollisionWorld({
                blockData,
                stacks: [
                    {
                        blocks: [
                            {
                                id: 'grass',
                                name: 'Block_Grass',
                                rotation: 0,
                            },
                            {
                                id: 'walkway',
                                name: walkwayName,
                                rotation: 0,
                            },
                            {
                                id: 'arch',
                                name: 'HazelLightArch',
                                rotation,
                            },
                        ],
                        position: new Vector3(2, 0, -1),
                    },
                ],
            });
            const posts = world.surfaces.filter((surface) =>
                surface.debugLabel?.startsWith('HazelLightArch.Post.'),
            );
            const walkway = world.surfaces.find(
                (surface) => surface.roamable === true && surface.y > 0.4,
            );
            const archAxisIsZ = rotation % 2 === 0;
            const postCoordinates = posts
                .map((surface) => (archAxisIsZ ? surface.z + 1 : surface.x - 2))
                .toSorted((left, right) => left - right);

            assert.equal(posts.length, 2);
            assert.ok(Math.abs(postCoordinates[0] + 0.443) < 0.000_001);
            assert.ok(Math.abs(postCoordinates[1] - 0.443) < 0.000_001);
            assert.ok(posts.every((surface) => surface.halfWidth === 0.052));
            assert.ok(posts.every((surface) => surface.halfDepth === 0.052));
            assert.deepEqual(getGardenAvatarRoamBlockedCells(world), []);
            assert.ok(walkway?.roamable);

            const throughCenter = resolveGardenAvatarHorizontalMovement({
                deltaX: archAxisIsZ ? 1.4 : 0,
                deltaZ: archAxisIsZ ? 0 : 1.4,
                position: {
                    x: archAxisIsZ ? 1.3 : 2,
                    y: walkway?.y ?? 0,
                    z: archAxisIsZ ? -1 : -1.7,
                },
                world,
            });

            assert.equal(throughCenter.collided, false);
            assert.ok(
                archAxisIsZ
                    ? Math.abs(throughCenter.position.x - 2.7) < 0.000_001
                    : Math.abs(throughCenter.position.z + 0.3) < 0.000_001,
            );
        }
    }
});

test('HazelLightArch posts remain solid while its center passage stays open', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [
                    { id: 'grass', name: 'Block_Grass', rotation: 0 },
                    { id: 'arch', name: 'HazelLightArch', rotation: 0 },
                ],
                position: new Vector3(0, 0, 0),
            },
        ],
    });
    const aimedAtPost = resolveGardenAvatarHorizontalMovement({
        deltaX: 1.4,
        deltaZ: 0,
        position: { x: -0.7, y: 0.4, z: 0.443 },
        world,
    });

    assert.equal(aimedAtPost.collided, true);
    assert.ok(aimedAtPost.position.x < 0);
});

for (const supportName of ['Block_Grass', 'Block_Water', 'Block_Swamp_Water']) {
    test(`routes autonomously across a ${supportName} walkway beneath HazelLightArch`, () => {
        const world = createGardenAvatarCollisionWorld({
            blockData: getLocalSandboxBlockData(),
            stacks: [-1, 0, 1].map((x) => ({
                blocks: [
                    {
                        id: `grass-${x}`,
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                    ...(supportName !== 'Block_Grass'
                        ? [
                              {
                                  id: `water-${x}`,
                                  name: supportName,
                                  rotation: 0,
                              },
                          ]
                        : []),
                    {
                        id: `walkway-${x}`,
                        name: 'StoneWalkway',
                        rotation: 0,
                    },
                    ...(x === 0
                        ? [
                              {
                                  id: 'arch',
                                  name: 'HazelLightArch',
                                  rotation: 0,
                              },
                          ]
                        : []),
                ],
                position: new Vector3(x, 0, 0),
            })),
        });
        const route = findGardenAvatarRoute({
            from: { x: -1, y: 0.4, z: 0 },
            to: { x: 1, y: 0.4, z: 0 },
            world,
        });

        assert.deepEqual(
            route.map(({ x, z }) => ({ x, z })),
            [
                { x: -1, z: 0 },
                { x: 0, z: 0 },
                { x: 1, z: 0 },
            ],
        );
    });
}

test('lets the shorter crouching collider pass under overhead geometry', () => {
    const world: GardenAvatarCollisionWorld = {
        blockedCells: [],
        surfaces: [
            {
                bottomY: 0.9,
                halfDepth: 0.5,
                halfWidth: 0.5,
                kind: 'ground',
                x: 0,
                y: 1.2,
                z: 0,
            },
        ],
    };

    assert.equal(
        getGardenAvatarGroundY({
            currentGroundY: 0,
            position: { x: 0, z: 0 },
            world,
        }),
        null,
    );
    assert.equal(
        getGardenAvatarGroundY({
            collisionHeight: gardenAvatarCrouchingCollisionHeight,
            currentGroundY: 0,
            position: { x: 0, z: 0 },
            world,
        }),
        0,
    );
    assert.ok(
        Math.abs(
            (getGardenAvatarCeilingY({
                collisionHeight: gardenAvatarCrouchingCollisionHeight,
                position: { x: 0, y: 0, z: 0 },
                world,
            }) ?? 0) -
                (0.9 - gardenAvatarCrouchingCollisionHeight),
        ) < 0.000_001,
    );
});

test('routes roaming around blockers without cutting diagonal corners', () => {
    const world: GardenAvatarCollisionWorld = {
        blockedCells: [{ x: 1, z: 0 }],
        surfaces: grid({ minX: 0, maxX: 2, minZ: -1, maxZ: 1 }),
    };
    const route = findGardenAvatarRoute({
        from: { x: 0, y: 0, z: 0 },
        to: { x: 2, y: 0, z: 0 },
        world,
    });

    assert.ok(route.length >= 5);
    assert.equal(
        route.some((point) => point.x === 1 && point.z === 0),
        false,
    );
});

test('routes roaming around precise decoration footprints', () => {
    const world: GardenAvatarCollisionWorld = {
        blockedCells: [],
        surfaces: [
            ...grid({ minX: 0, maxX: 2, minZ: -1, maxZ: 1 }),
            {
                halfDepth: 0.21,
                halfWidth: 0.21,
                kind: 'ground',
                roamable: false,
                x: 1,
                y: 2.4,
                z: 0,
            },
        ],
    };
    const route = findGardenAvatarRoute({
        from: { x: 0, y: 0, z: 0 },
        to: { x: 2, y: 0, z: 0 },
        world,
    });

    assert.ok(route.length > 2);
    assert.equal(
        route.some((point) => point.x === 1 && point.z === 0),
        false,
    );
});

test('routes a roaming avatar back from the base plane', () => {
    const world: GardenAvatarCollisionWorld = {
        blockedCells: [],
        surfaces: grid({ minX: 0, maxX: 2, minZ: 0, maxZ: 2 }),
    };
    const route = findGardenAvatarRoute({
        from: { x: 4, y: 0, z: 1 },
        to: { x: 0, y: 0, z: 1 },
        world,
    });

    assert.deepEqual(route[0], { x: 4, y: 0, z: 1 });
    assert.deepEqual(route[1], { x: 2, y: 0, z: 1 });
    assert.deepEqual(route.at(-1), { x: 0, y: 0, z: 1 });
});

test('routes base-plane re-entry around a blocked garden edge', () => {
    const world: GardenAvatarCollisionWorld = {
        blockedCells: [],
        surfaces: [
            ...grid({ minX: 0, maxX: 2, minZ: 0, maxZ: 0 }),
            {
                halfDepth: 0.21,
                halfWidth: 0.21,
                kind: 'ground',
                roamable: false,
                x: 0,
                y: 2.4,
                z: 0,
            },
        ],
    };
    const route = findGardenAvatarRoute({
        from: { x: -1, y: 0, z: 0 },
        to: { x: 2, y: 0, z: 0 },
        world,
    });

    assert.deepEqual(route[0], { x: -1, y: 0, z: 0 });
    assert.ok(route.some((point) => Math.abs(point.z) >= 1));
    assert.deepEqual(route.at(-1), { x: 2, y: 0, z: 0 });
});

test('selects a collision-safe spawn near the garden center', () => {
    const world: GardenAvatarCollisionWorld = {
        blockedCells: [{ x: 1, z: 0 }],
        surfaces: [ground(0, 0), ground(1, 0), ground(2, 0)],
    };

    assert.deepEqual(findGardenAvatarSpawnPoint(world), { x: 0, y: 0, z: 0 });
});

test('spawns on the base plane when an empty garden has no block surfaces', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [],
    });

    assert.deepEqual(findGardenAvatarSpawnPoint(world), { x: 0, y: 0, z: 0 });
    assert.deepEqual(findGardenAvatarSpawnPoint(world, { x: 4.5, z: -2.25 }), {
        x: 4.5,
        y: 0,
        z: -2.25,
    });

    const movement = resolveGardenAvatarHorizontalMovement({
        deltaX: 1.5,
        deltaZ: -0.75,
        position: { x: 0, y: 0, z: 0 },
        world,
    });
    assert.equal(movement.collided, false);
    assert.ok(Math.abs(movement.position.x - 1.5) < 0.000_001);
    assert.equal(movement.position.y, 0);
    assert.ok(Math.abs(movement.position.z + 0.75) < 0.000_001);
});

test('spawns beside a decoration when there is no roamable terrain', () => {
    const world = createGardenAvatarCollisionWorld({
        blockData: getLocalSandboxBlockData(),
        stacks: [
            {
                blocks: [{ id: 'garden-box', name: 'GardenBox', rotation: 0 }],
                position: new Vector3(0, 0, 0),
            },
        ],
    });
    const spawn = findGardenAvatarSpawnPoint(world);

    assert.ok(spawn);
    assert.equal(spawn.y, 0);
    assert.notDeepEqual({ x: spawn.x, z: spawn.z }, { x: 0, z: 0 });
});

test('queries only nearby collision buckets in a dense structure-sized world', () => {
    const surfaces = grid({ minX: 0, maxX: 19, minZ: 0, maxZ: 19 });
    const world = createIndexedGardenAvatarCollisionWorld({
        blockedCells: [],
        surfaces,
    });
    const candidates = getGardenAvatarCollisionCandidates(world, {
        x: 10,
        z: 10,
    });

    assert.equal(surfaces.length, 400);
    assert.ok(candidates.surfaces.length > 0);
    assert.ok(candidates.surfaces.length <= 16);
});

test('indexes blockers across bucket boundaries for radius-safe collision', () => {
    const world = createIndexedGardenAvatarCollisionWorld({
        blockedCells: [{ x: 2, z: 0 }],
        surfaces: grid({ minX: 0, maxX: 3, minZ: -1, maxZ: 1 }),
    });
    const movement = resolveGardenAvatarHorizontalMovement({
        deltaX: 0.2,
        deltaZ: 0,
        position: { x: 1.3, y: 0, z: 0 },
        world,
    });

    assert.equal(movement.collided, true);
    assert.ok(movement.position.x < 1.4);
});
