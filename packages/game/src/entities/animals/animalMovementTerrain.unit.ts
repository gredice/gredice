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
    isAnimalGroundBlockName,
    isAnimalSwimmingAt,
} from './animalMovementTerrain';

function block(id: string, name: string): Block {
    return { id, name, rotation: 0 };
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
});
