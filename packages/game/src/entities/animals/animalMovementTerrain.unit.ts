import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import {
    canAnimalSettleAt,
    createAnimalBlockedCells,
    createAnimalMovementSurfaces,
    getAnimalMovementSurfaceAt,
    getAnimalMovementYAt,
    isAnimalGroundBlockName,
    isAnimalSwimmingAt,
    isAnimalWaterBlockName,
    isAnimalWetlandBlockName,
} from './animalMovementTerrain';

function block(id: string, name: string, rotation = 0): Block {
    return { id, name, rotation };
}

function stack(x: number, z: number, blocks: Block[]): Stack {
    return {
        blocks,
        position: new Vector3(x, 0, z),
    };
}

describe('animal movement terrain', () => {
    it('treats every ground shape as traversable terrain', () => {
        assert.equal(isAnimalGroundBlockName('Block_Grass'), true);
        assert.equal(isAnimalGroundBlockName('Block_Sand_Angle'), true);
        assert.equal(isAnimalGroundBlockName('Block_Snow_Corner'), true);
        assert.equal(
            isAnimalGroundBlockName('Block_Ground_Reverse_Corner'),
            true,
        );
        for (const name of [
            'Block_Dry_Ground',
            'Block_Dry_Ground_Angle',
            'Block_Dry_Ground_Corner',
            'Block_Dry_Ground_Reverse_Corner',
            'Block_Swamp_Ground',
            'Block_Swamp_Ground_Angle',
            'Block_Stone',
            'Block_Stone_Angle',
            'Block_Gravel',
            'Block_Gravel_Angle',
            'Block_Polished_Stone',
            'Block_Polished_Stone_Angle',
            'Block_Polished_Stone_Stairs',
            'Block_Polished_Stone_Stairs_Corner',
            'Block_Stone_Stairs',
            'Block_Stone_Stairs_Corner',
            'Block_Stone_Stairs_Half',
        ]) {
            assert.equal(isAnimalGroundBlockName(name), true, name);
        }
        assert.equal(isAnimalGroundBlockName('Raised_Bed'), false);
    });

    it('keeps water traversable at swimming depth but never settleable', () => {
        const waterStack = stack(1, 2, [
            block('grass', 'Block_Grass'),
            block('water', 'Block_Water'),
        ]);
        const surfaces = createAnimalMovementSurfaces({
            blockData: getLocalSandboxBlockData(),
            groundLift: 0.02,
            stacks: [waterStack],
            swimDepth: 0.12,
        });

        assert.equal(createAnimalBlockedCells([waterStack]).length, 0);
        assert.equal(surfaces.length, 1);
        assert.equal(surfaces[0]?.habitat, 'general');
        assert.equal(surfaces[0]?.kind, 'water');
        assert.equal(surfaces[0]?.sourceBlockName, 'Block_Water');
        assert.equal(surfaces[0]?.x, 1);
        assert.equal(surfaces[0]?.y, 0.62);
        assert.equal(surfaces[0]?.z, 2);
        assert.ok((surfaces[0]?.waterDepth ?? 0) > 0);
        assert.equal(isAnimalSwimmingAt({ x: 1, z: 2 }, surfaces), true);
        assert.equal(canAnimalSettleAt({ x: 1, z: 2 }, surfaces), false);
    });

    it('treats swamp water as a swimming surface', () => {
        const waterStack = stack(1, 2, [
            block('grass', 'Block_Grass'),
            block('water', 'Block_Swamp_Water'),
        ]);
        const surfaces = createAnimalMovementSurfaces({
            blockData: getLocalSandboxBlockData(),
            groundLift: 0.02,
            stacks: [waterStack],
            swimDepth: 0.12,
        });

        assert.equal(isAnimalWaterBlockName('Block_Swamp_Water'), true);
        assert.equal(isAnimalWetlandBlockName('Block_Swamp_Water'), true);
        assert.equal(isAnimalWetlandBlockName('Block_Swamp_Ground'), true);
        assert.equal(isAnimalWetlandBlockName('Block_Grass'), false);
        assert.equal(createAnimalBlockedCells([waterStack]).length, 0);
        assert.equal(surfaces[0]?.habitat, 'wetland');
        assert.equal(surfaces[0]?.kind, 'water');
        assert.equal(isAnimalSwimmingAt({ x: 1, z: 2 }, surfaces), true);
        assert.equal(
            canAnimalSettleAt({ x: 1, z: 2 }, surfaces, {
                habitat: 'wetland',
                waterMaxDepth: surfaces[0]?.waterDepth,
            }),
            true,
        );
    });

    it('keeps deep wetland water traversable but outside shallow settlement policy', () => {
        const deepWaterStack = stack(1, 2, [
            block('swamp-ground', 'Block_Swamp_Ground'),
            block('water-low', 'Block_Swamp_Water'),
            block('water-high', 'Block_Swamp_Water'),
        ]);
        const surfaces = createAnimalMovementSurfaces({
            blockData: getLocalSandboxBlockData(),
            groundLift: 0.02,
            stacks: [deepWaterStack],
            swimDepth: 0.04,
        });
        const depth = surfaces[0]?.waterDepth ?? 0;

        assert.ok(depth > 1.5);
        assert.equal(
            canAnimalSettleAt({ x: 1, z: 2 }, surfaces, {
                habitat: 'wetland',
                waterMaxDepth: 1.35,
            }),
            false,
        );
    });

    it('does not settle animals outside a known movement surface', () => {
        assert.equal(canAnimalSettleAt({ x: 4, z: 5 }, []), false);
    });

    it('blocks occupied cells while preserving the ground below them', () => {
        const occupiedStack = stack(3, 4, [
            block('sand', 'Block_Sand'),
            block('raised-bed', 'Raised_Bed'),
        ]);
        const surfaces = createAnimalMovementSurfaces({
            blockData: getLocalSandboxBlockData(),
            groundLift: 0.02,
            stacks: [occupiedStack],
            swimDepth: 0.12,
        });

        assert.deepEqual(createAnimalBlockedCells([occupiedStack]), [
            { x: 3, z: 4 },
        ]);
        assert.equal(surfaces.length, 1);
        assert.equal(surfaces[0]?.kind, 'ground');
        assert.equal(surfaces[0]?.habitat, 'general');
        assert.equal(surfaces[0]?.sourceBlockName, 'Block_Sand');
        assert.equal(surfaces[0]?.x, 3);
        assert.equal(Number(surfaces[0]?.y.toFixed(6)), 0.42);
        assert.equal(surfaces[0]?.z, 4);
    });

    it('blocks closed gates and lets animals path through open gates', () => {
        for (const name of [
            'FenceGate',
            'WhiteFenceGate',
            'StoneFenceGate',
            'PolishedStoneFenceGate',
        ]) {
            const closedGate = stack(3, 4, [
                block(`${name}-ground`, 'Block_Grass'),
                block(`${name}-closed`, name),
            ]);
            const openGate = stack(3, 4, [
                block(`${name}-ground-open`, 'Block_Grass'),
                { ...block(`${name}-open`, name), variant: 1 },
            ]);

            assert.deepEqual(createAnimalBlockedCells([closedGate]), [
                { x: 3, z: 4 },
            ]);
            assert.deepEqual(createAnimalBlockedCells([openGate]), []);
        }
    });

    for (const supportName of [
        'Block_Grass',
        'Block_Water',
        'Block_Swamp_Water',
    ]) {
        for (const walkwayName of ['StoneWalkway', 'WoodenWalkway']) {
            it(`lets animals pass through HazelLightArch on ${walkwayName} above ${supportName}`, () => {
                const archStack = stack(3, 4, [
                    block('grass', 'Block_Grass'),
                    ...(supportName !== 'Block_Grass'
                        ? [block('water', supportName)]
                        : []),
                    block('walkway', walkwayName),
                    block('arch', 'HazelLightArch'),
                ]);
                const surfaces = createAnimalMovementSurfaces({
                    blockData: getLocalSandboxBlockData(),
                    groundLift: 0.02,
                    stacks: [archStack],
                    swimDepth: 0.12,
                });
                const supportHeight = supportName === 'Block_Grass' ? 0.4 : 0.8;
                const walkwayHeight =
                    walkwayName === 'StoneWalkway' ? 0.064 : 0.036;

                assert.deepEqual(createAnimalBlockedCells([archStack]), []);
                assert.equal(surfaces[0]?.kind, 'ground');
                assert.equal(
                    Number(surfaces[0]?.y.toFixed(6)),
                    Number((supportHeight + walkwayHeight + 0.02).toFixed(6)),
                );
            });
        }
    }

    it('follows full-tile corner stair treads across rotations and aliases', () => {
        for (const name of [
            'Block_Stone_Stairs_Corner',
            'Block_Polished_Stone_Stairs_Corner',
            'Block_Stone_Stairs_Half',
        ]) {
            for (const rotation of [0, 1, 2, 3]) {
                const surfaces = createAnimalMovementSurfaces({
                    blockData: getLocalSandboxBlockData(),
                    groundLift: 0.02,
                    stacks: [
                        stack(0, 0, [
                            block(`${name}-${rotation}`, name, rotation),
                        ]),
                    ],
                    swimDepth: 0.12,
                });
                const angle = rotation * (Math.PI / 2);
                const worldPoint = (localX: number, localZ: number) => ({
                    x: localX * Math.cos(angle) + localZ * Math.sin(angle),
                    z: -localX * Math.sin(angle) + localZ * Math.cos(angle),
                });

                assert.equal(
                    surfaces.length,
                    1,
                    `${name} rotation ${rotation}`,
                );
                for (const [localX, localZ] of [
                    [-0.25, -0.25],
                    [-0.25, 0.25],
                    [0.25, 0.25],
                ] satisfies readonly [number, number][]) {
                    assert.equal(
                        Number(
                            getAnimalMovementYAt(
                                worldPoint(localX, localZ),
                                surfaces,
                            ).toFixed(6),
                        ),
                        0.22,
                        `${name} middle L at rotation ${rotation}`,
                    );
                }
                assert.equal(
                    Number(
                        getAnimalMovementYAt(
                            worldPoint(0.25, -0.25),
                            surfaces,
                        ).toFixed(6),
                    ),
                    0.42,
                    `${name} top quadrant at rotation ${rotation}`,
                );
                assert.ok(
                    getAnimalMovementSurfaceAt(
                        worldPoint(0.25, 0.25),
                        surfaces,
                    ),
                );
            }
        }
    });
});
