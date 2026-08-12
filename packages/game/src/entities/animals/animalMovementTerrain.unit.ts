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
            'Block_Swamp_Ground',
            'Block_Swamp_Ground_Angle',
            'Block_Stone',
            'Block_Stone_Angle',
            'Block_Gravel',
            'Block_Gravel_Angle',
            'Block_Stone_Stairs',
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
        assert.deepEqual(surfaces, [
            {
                kind: 'water',
                x: 1,
                y: 0.62,
                z: 2,
            },
        ]);
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
        assert.equal(createAnimalBlockedCells([waterStack]).length, 0);
        assert.equal(surfaces[0]?.kind, 'water');
        assert.equal(isAnimalSwimmingAt({ x: 1, z: 2 }, surfaces), true);
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
        assert.equal(surfaces[0]?.x, 3);
        assert.equal(Number(surfaces[0]?.y.toFixed(6)), 0.42);
        assert.equal(surfaces[0]?.z, 4);
    });

    it('keeps half-stair animal surfaces on the rendered edge at every rotation', () => {
        for (const rotation of [0, 1, 2, 3]) {
            const surfaces = createAnimalMovementSurfaces({
                blockData: getLocalSandboxBlockData(),
                groundLift: 0.02,
                stacks: [
                    stack(0, 0, [
                        block(
                            `half-stairs-${rotation}`,
                            'Block_Stone_Stairs_Half',
                            rotation,
                        ),
                    ]),
                ],
                swimDepth: 0.12,
            });
            const angle = rotation * (Math.PI / 2);
            const worldPoint = (localX: number, localZ: number) => ({
                x: localX * Math.cos(angle) + localZ * Math.sin(angle),
                z: -localX * Math.sin(angle) + localZ * Math.cos(angle),
            });

            assert.equal(surfaces.length, 1, `rotation ${rotation}`);
            assert.equal(
                Number(
                    getAnimalMovementYAt(
                        worldPoint(-0.25, -0.25),
                        surfaces,
                    ).toFixed(6),
                ),
                0.22,
                `middle tread at rotation ${rotation}`,
            );
            assert.equal(
                Number(
                    getAnimalMovementYAt(
                        worldPoint(0.25, -0.25),
                        surfaces,
                    ).toFixed(6),
                ),
                0.42,
                `top tread at rotation ${rotation}`,
            );
            assert.equal(
                getAnimalMovementYAt(worldPoint(0.25, 0.25), surfaces),
                0,
                `empty half at rotation ${rotation}`,
            );
            assert.equal(
                getAnimalMovementSurfaceAt(worldPoint(0.25, 0.25), surfaces),
                null,
                `no stair surface on empty half at rotation ${rotation}`,
            );
        }
    });

    it('falls back to the supporting terrain on a half-stair empty side', () => {
        const surfaces = createAnimalMovementSurfaces({
            blockData: getLocalSandboxBlockData(),
            groundLift: 0.02,
            stacks: [
                stack(2, 3, [
                    block('grass', 'Block_Grass'),
                    block('half-stairs', 'Block_Stone_Stairs_Half'),
                ]),
            ],
            swimDepth: 0.12,
        });

        assert.equal(
            Number(
                getAnimalMovementYAt({ x: 1.75, z: 2.75 }, surfaces).toFixed(6),
            ),
            0.62,
        );
        assert.equal(
            Number(
                getAnimalMovementYAt({ x: 2.25, z: 2.75 }, surfaces).toFixed(6),
            ),
            0.82,
        );
        assert.equal(
            Number(
                getAnimalMovementYAt({ x: 2.25, z: 3.25 }, surfaces).toFixed(6),
            ),
            0.42,
        );
    });
});
