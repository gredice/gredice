import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import {
    resolvePlacementGroundingShadowDescriptors,
    resolvePlacementGroundingShadowProfile,
} from './PlacementGroundingShadows';

describe('placement grounding-shadow projection', () => {
    it('uses a conservative hitbox footprint', () => {
        const tree = getLocalSandboxBlockData().find(
            (block) => block.information.name === 'Tree',
        );
        const profile = resolvePlacementGroundingShadowProfile(tree);

        assert.ok(profile.baseHalfWidth >= 0.5);
        assert.ok(profile.baseHalfLength >= 0.5);
        assert.ok(profile.baseOpacity > 0);
    });

    it('keeps projected identity stable through an id rekey', () => {
        const blockData = getLocalSandboxBlockData();
        const animations = {
            persisted: {
                createdAt: 1,
                mutationConfirmed: false,
                particlesSpawned: false,
                renderId: 42,
                sequence: 1,
                sourceBlockId: 'optimistic',
                visualComplete: false,
                visualStarted: true,
            },
        };
        const stacks = [
            {
                blocks: [
                    {
                        id: 'persisted',
                        name: 'Tree',
                        rotation: 1,
                    },
                ],
                position: new Vector3(3, 2, -4),
            },
        ];
        const [descriptor] = resolvePlacementGroundingShadowDescriptors({
            animations,
            blockData,
            stacks,
        });

        assert.ok(descriptor);
        assert.equal(descriptor.id, 'placement:42');
        assert.equal(descriptor.state.x, 3);
        assert.equal(descriptor.state.receiverY, 2);
        assert.equal(descriptor.state.z, -4);
        assert.equal(descriptor.state.yaw, Math.PI / 2);
    });

    it('does not project a placement before its visual renderer commits', () => {
        const blockData = getLocalSandboxBlockData();
        const animations = {
            optimistic: {
                createdAt: 1,
                mutationConfirmed: false,
                particlesSpawned: false,
                renderId: 42,
                sequence: 1,
                sourceBlockId: 'optimistic',
                visualComplete: false,
                visualStarted: false,
            },
        };
        const stacks = [
            {
                blocks: [
                    {
                        id: 'optimistic',
                        name: 'Tree',
                        rotation: 0,
                    },
                ],
                position: new Vector3(0, 0, 0),
            },
        ];

        assert.deepEqual(
            resolvePlacementGroundingShadowDescriptors({
                animations,
                blockData,
                stacks,
            }),
            [],
        );
    });
});
