import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPublicGardenBlockInteractionTargets } from './PublicGardenBlockInteractions';
import { normalizePublicGardenStacks } from './PublicGardenViewer';

describe('getPublicGardenBlockInteractionTargets', () => {
    it('registers only explicitly supplied read-only block IDs', () => {
        const stacks = normalizePublicGardenStacks([
            {
                x: 2,
                y: 5,
                blocks: [
                    {
                        id: 'outlet-offer:301',
                        name: 'PotLowBowl',
                        rotation: 0,
                    },
                    {
                        id: 'outlet-decoration:1',
                        name: 'Stool',
                        rotation: 0,
                    },
                ],
            },
        ]);

        const targets = getPublicGardenBlockInteractionTargets(
            stacks,
            new Set(['outlet-offer:301', 'missing-block']),
        );

        assert.equal(targets.length, 1);
        assert.equal(targets[0]?.block.id, 'outlet-offer:301');
        assert.equal(targets[0]?.blockIndex, 0);
    });
});
