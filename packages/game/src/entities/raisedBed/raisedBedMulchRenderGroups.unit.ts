import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getRaisedBedMulchRenderGroups,
    type RaisedBedMulchRenderPatch,
} from './raisedBedMulchRenderGroups';

type TestInstance = {
    id: string;
};

function patch(
    id: string,
    overrides: Partial<RaisedBedMulchRenderPatch<TestInstance>> = {},
): RaisedBedMulchRenderPatch<TestInstance> {
    return {
        blockName: 'MulchHey',
        instance: { id },
        mask: 3,
        scale: [0.285, 1, 0.27],
        ...overrides,
    };
}

test('groups mulch patches only when material, mask, and scale are compatible', () => {
    const groups = getRaisedBedMulchRenderGroups([
        patch('first'),
        patch('second'),
        patch('different-material', { blockName: 'MulchWood' }),
        patch('different-mask', { mask: 7 }),
        patch('different-scale', { scale: [0.27, 1, 0.285] }),
    ]);

    assert.equal(groups.length, 4);
    assert.deepEqual(
        groups.map((group) => ({
            blockName: group.blockName,
            instanceIds: group.instances.map((instance) => instance.id),
            mask: group.mask,
            scale: group.scale,
        })),
        [
            {
                blockName: 'MulchHey',
                instanceIds: ['first', 'second'],
                mask: 3,
                scale: [0.285, 1, 0.27],
            },
            {
                blockName: 'MulchWood',
                instanceIds: ['different-material'],
                mask: 3,
                scale: [0.285, 1, 0.27],
            },
            {
                blockName: 'MulchHey',
                instanceIds: ['different-mask'],
                mask: 7,
                scale: [0.285, 1, 0.27],
            },
            {
                blockName: 'MulchHey',
                instanceIds: ['different-scale'],
                mask: 3,
                scale: [0.27, 1, 0.285],
            },
        ],
    );
});

test('keeps first-seen group order and instance order deterministic', () => {
    const groups = getRaisedBedMulchRenderGroups([
        patch('wood-first', { blockName: 'MulchWood', mask: 12 }),
        patch('hay-first'),
        patch('wood-second', { blockName: 'MulchWood', mask: 12 }),
        patch('hay-second'),
    ]);

    assert.deepEqual(
        groups.map((group) => ({
            key: group.key,
            ids: group.instances.map((instance) => instance.id),
        })),
        [
            {
                key: 'MulchWood:12:0.285:1:0.27',
                ids: ['wood-first', 'wood-second'],
            },
            {
                key: 'MulchHey:3:0.285:1:0.27',
                ids: ['hay-first', 'hay-second'],
            },
        ],
    );
});
