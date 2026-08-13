import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Ray, Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import type { Stack } from '../types/Stack';
import { getBlockInteractionLayerTargets } from './BlockInteractionLayer';
import { resolveBlockInteractionLayerTarget } from './BlockInteractionResolver';

describe('getBlockInteractionLayerTargets', () => {
    it('uses current corner-stair metadata for a legacy placed name', () => {
        const blockData = getLocalSandboxBlockData().filter(
            (block) => block.information.name !== 'Block_Stone_Stairs_Half',
        );
        const stack = {
            blocks: [
                {
                    id: 'legacy-corner-stairs',
                    name: 'Block_Stone_Stairs_Half',
                    rotation: 0,
                },
                {
                    id: 'mulch',
                    name: 'MulchWood',
                    rotation: 0,
                },
            ],
            position: new Vector3(0, 0, 0),
        } satisfies Stack;

        const targets = getBlockInteractionLayerTargets({
            blockData,
            stacks: [stack],
        });
        const legacyStairs = targets.find(
            (target) => target.block.id === 'legacy-corner-stairs',
        );
        const mulch = targets.find((target) => target.block.id === 'mulch');

        assert.ok(legacyStairs);
        assert.equal(legacyStairs.hitbox.height, 0.4);
        assert.ok(mulch);
        assert.equal(mulch.stackHeight, 0.4);
        assert.equal(
            resolveBlockInteractionLayerTarget(
                targets,
                new Ray(new Vector3(-2, 0.44, 0), new Vector3(1, 0, 0)),
            )?.target.block.id,
            'mulch',
        );
    });
});
