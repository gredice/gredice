import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import type { Block } from '../types/Block';
import { createGardenPosition, type GardenStack } from '../types/Stack';
import {
    type BlockRemovalGarden,
    planBlockRemoval,
    resolveBlockRemovalRefund,
} from './blockRemoval';

const blockData = getLocalSandboxBlockData();

function block(
    id: string,
    name: string,
    paidSunflowers?: number | null,
): Block {
    return paidSunflowers === undefined
        ? { id, name, rotation: 0 }
        : { id, name, rotation: 0, paidSunflowers };
}

function stack(x: number, z: number, blocks: Block[]): GardenStack {
    return { position: createGardenPosition(x, 0, z), blocks };
}

function garden(
    stacks: GardenStack[],
    options: {
        isSandbox?: boolean;
        raisedBeds?: BlockRemovalGarden['raisedBeds'];
    } = {},
): BlockRemovalGarden {
    return {
        isSandbox: options.isSandbox ?? false,
        raisedBeds: options.raisedBeds ?? [],
        stacks,
    };
}

function plan(
    blockId: string,
    target: BlockRemovalGarden,
    cartItems: { raisedBedId?: number | null }[] = [],
) {
    return planBlockRemoval({ blockData, blockId, cartItems, garden: target });
}

describe('planBlockRemoval', () => {
    it('recycles a single block with nothing on it', () => {
        const result = plan(
            'bush',
            garden([
                stack(2, -1, [
                    block('grass', 'Block_Grass', 10),
                    block('bush', 'Bush', 25),
                ]),
            ]),
        );

        assert.deepEqual(result, {
            action: 'recycle',
            blockId: 'bush',
            blockName: 'Bush',
            blockIndex: 1,
            position: { x: 2, z: -1 },
            raisedBedId: null,
            blockIds: ['bush'],
            stackedCount: 0,
            cartItemCount: 0,
            refund: { kind: 'amount', amount: 25 },
        });
    });

    it('deletes the block and everything stacked on it, bottom first', () => {
        const result = plan(
            'grass',
            garden([
                stack(0, 0, [
                    block('grass', 'Block_Grass', 10),
                    block('ball', 'BeachBall', 30),
                ]),
            ]),
        );

        assert.equal(result?.action, 'delete');
        assert.deepEqual(result?.blockIds, ['grass', 'ball']);
        assert.equal(result?.stackedCount, 1);
        assert.deepEqual(result?.refund, { kind: 'amount', amount: 40 });
    });

    it('always deletes in sandbox gardens and has no refund line', () => {
        const result = plan(
            'bush',
            garden(
                [
                    stack(0, 0, [
                        block('grass', 'Block_Grass', 0),
                        block('bush', 'Bush', 0),
                    ]),
                ],
                { isSandbox: true },
            ),
        );

        assert.equal(result?.action, 'delete');
        assert.deepEqual(result?.blockIds, ['bush']);
        assert.equal(result?.stackedCount, 0);
        assert.equal(result?.refund, null);
    });

    it('counts the cart items of a new raised bed it recycles', () => {
        const target = garden(
            [
                stack(-3, 2, [
                    block('grass', 'Block_Grass'),
                    block('bed', 'Raised_Bed', 100),
                ]),
            ],
            { raisedBeds: [{ id: 701, blockId: 'bed', status: 'new' }] },
        );
        const result = plan('bed', target, [
            { raisedBedId: 701 },
            { raisedBedId: 701 },
            { raisedBedId: 12 },
            { raisedBedId: null },
            {},
        ]);

        assert.equal(result?.action, 'recycle');
        assert.equal(result?.raisedBedId, 701);
        assert.equal(result?.cartItemCount, 2);
        assert.deepEqual(result?.refund, { kind: 'amount', amount: 100 });
    });

    it('does not count cart items when the raised bed is deleted with a stack', () => {
        const target = garden(
            [
                stack(-3, 2, [
                    block('grass', 'Block_Grass'),
                    block('bed', 'Raised_Bed'),
                ]),
            ],
            { raisedBeds: [{ id: 701, blockId: 'bed', status: 'new' }] },
        );
        const result = plan('grass', target, [{ raisedBedId: 701 }]);

        assert.equal(result?.action, 'delete');
        assert.equal(result?.cartItemCount, 0);
    });

    it('deletes an active raised bed instead of recycling it, as the HUD drop does', () => {
        const target = garden(
            [
                stack(-3, 2, [
                    block('grass', 'Block_Grass'),
                    block('bed', 'Raised_Bed'),
                ]),
            ],
            { raisedBeds: [{ id: 701, blockId: 'bed', status: 'approved' }] },
        );

        assert.equal(plan('bed', target)?.action, 'delete');
    });

    it('returns null for a block that is gone', () => {
        assert.equal(
            plan(
                'missing',
                garden([stack(0, 0, [block('grass', 'Block_Grass')])]),
            ),
            null,
        );
    });
});

describe('resolveBlockRemovalRefund', () => {
    it('sums the price paid per block', () => {
        assert.deepEqual(
            resolveBlockRemovalRefund([
                { paidSunflowers: 10 },
                { paidSunflowers: 30 },
            ]),
            { kind: 'amount', amount: 40 },
        );
    });

    it('reports no refund when every block was free', () => {
        assert.deepEqual(
            resolveBlockRemovalRefund([
                { paidSunflowers: 0 },
                { paidSunflowers: 0 },
            ]),
            { kind: 'none' },
        );
    });

    it('cannot name an amount when any block has no paid price', () => {
        for (const missing of [null, undefined, -1, 1.5, Number.NaN]) {
            assert.deepEqual(
                resolveBlockRemovalRefund([
                    { paidSunflowers: 10 },
                    { paidSunflowers: missing },
                ]),
                { kind: 'unknown' },
                String(missing),
            );
        }
    });
});
