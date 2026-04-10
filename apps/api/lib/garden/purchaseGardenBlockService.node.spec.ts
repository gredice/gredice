import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { purchaseGardenBlock } from './purchaseGardenBlockService';

describe('purchaseGardenBlock', () => {
    it('synchronizes raised beds after purchasing a raised bed', async () => {
        const calls: string[] = [];

        const result = await purchaseGardenBlock({
            accountId: 'account-1',
            blockName: 'Raised_Bed',
            cost: 30,
            gardenId: 42,
            hasTargetStack: false,
            placement: {
                x: 3,
                y: 4,
                existingBlocks: ['ground-1'],
            },
            dependencies: {
                createGardenBlock: async () => {
                    calls.push('createGardenBlock');
                    return 'block-1';
                },
                createGardenStack: async () => {
                    calls.push('createGardenStack');
                },
                deleteGardenBlock: async () => {
                    calls.push('deleteGardenBlock');
                },
                spendSunflowers: async () => {
                    calls.push('spendSunflowers');
                },
                synchronizeGardenStacksAndRaisedBeds: async () => {
                    calls.push('synchronizeGardenStacksAndRaisedBeds');
                },
                updateGardenStack: async () => {
                    calls.push('updateGardenStack');
                },
            },
        });

        assert.deepStrictEqual(result, {
            ok: true,
            blockId: 'block-1',
            position: { x: 3, y: 4 },
        });
        assert.deepStrictEqual(calls, [
            'createGardenStack',
            'createGardenBlock',
            'updateGardenStack',
            'spendSunflowers',
            'synchronizeGardenStacksAndRaisedBeds',
        ]);
    });

    it('skips raised-bed synchronization for other block purchases', async () => {
        const calls: string[] = [];

        const result = await purchaseGardenBlock({
            accountId: 'account-1',
            blockName: 'Shade',
            cost: 30,
            gardenId: 42,
            hasTargetStack: true,
            placement: {
                x: 3,
                y: 4,
                existingBlocks: ['ground-1'],
            },
            dependencies: {
                createGardenBlock: async () => {
                    calls.push('createGardenBlock');
                    return 'block-1';
                },
                createGardenStack: async () => {
                    calls.push('createGardenStack');
                },
                deleteGardenBlock: async () => {
                    calls.push('deleteGardenBlock');
                },
                spendSunflowers: async () => {
                    calls.push('spendSunflowers');
                },
                synchronizeGardenStacksAndRaisedBeds: async () => {
                    calls.push('synchronizeGardenStacksAndRaisedBeds');
                },
                updateGardenStack: async () => {
                    calls.push('updateGardenStack');
                },
            },
        });

        assert.deepStrictEqual(result, {
            ok: true,
            blockId: 'block-1',
            position: { x: 3, y: 4 },
        });
        assert.deepStrictEqual(calls, [
            'createGardenBlock',
            'updateGardenStack',
            'spendSunflowers',
        ]);
    });
});
