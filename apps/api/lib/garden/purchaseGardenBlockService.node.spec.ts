import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { purchaseGardenBlock } from './purchaseGardenBlockService';

describe('purchaseGardenBlock', () => {
    it('creates and synchronizes one raised-bed block', async () => {
        const calls: string[] = [];

        const result = await purchaseGardenBlock({
            accountId: 'account-1',
            blockName: 'Raised_Bed',
            cost: 200,
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
                spendSunflowers: async (_accountId, amount) => {
                    calls.push(`spendSunflowers:${amount.toString()}`);
                },
                synchronizeGardenStacksAndRaisedBeds: async () => {
                    calls.push('synchronizeGardenStacksAndRaisedBeds');
                },
                updateGardenStack: async () => {
                    calls.push('updateGardenStack');
                },
            },
        });

        assert.deepEqual(result, {
            ok: true,
            blockId: 'block-1',
            position: { x: 3, y: 4 },
            variant: null,
        });
        assert.deepEqual(calls, [
            'createGardenStack',
            'createGardenBlock',
            'updateGardenStack',
            'spendSunflowers:200',
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

        assert.deepEqual(result, {
            ok: true,
            blockId: 'block-1',
            position: { x: 3, y: 4 },
            variant: null,
        });
        assert.deepEqual(calls, [
            'createGardenBlock',
            'updateGardenStack',
            'spendSunflowers',
        ]);
    });

    it('passes the placement-selected Cow coat to storage unchanged', async () => {
        let storedAppearanceVariant: number | null | undefined;

        const result = await purchaseGardenBlock({
            accountId: 'account-1',
            blockName: 'Cow',
            cost: 850,
            gardenId: 42,
            hasTargetStack: true,
            placement: {
                x: 3,
                y: 4,
                existingBlocks: ['ground-1'],
            },
            variant: 1,
            dependencies: {
                createGardenBlock: async (_gardenId, _blockName, variant) => {
                    storedAppearanceVariant = variant;
                    return 'cow-1';
                },
                createGardenStack: async () => undefined,
                deleteGardenBlock: async () => undefined,
                spendSunflowers: async () => undefined,
                synchronizeGardenStacksAndRaisedBeds: async () => undefined,
                updateGardenStack: async () => undefined,
            },
        });

        assert.equal(storedAppearanceVariant, 1);
        assert.deepEqual(result, {
            ok: true,
            blockId: 'cow-1',
            position: { x: 3, y: 4 },
            variant: 1,
        });
    });

    it('persists and returns an explicit appearance variant', async () => {
        let createdVariant: number | null | undefined;

        const result = await purchaseGardenBlock({
            accountId: 'account-1',
            blockName: 'Horse',
            cost: 600,
            gardenId: 42,
            hasTargetStack: true,
            placement: { x: 3, y: 4, existingBlocks: ['ground-1'] },
            variant: 5,
            dependencies: {
                createGardenBlock: async (_gardenId, _blockName, variant) => {
                    createdVariant = variant;
                    return 'horse-1';
                },
                createGardenStack: async () => undefined,
                deleteGardenBlock: async () => undefined,
                spendSunflowers: async () => undefined,
                synchronizeGardenStacksAndRaisedBeds: async () => undefined,
                updateGardenStack: async () => undefined,
            },
        });

        assert.equal(createdVariant, 5);
        assert.deepEqual(result, {
            ok: true,
            blockId: 'horse-1',
            position: { x: 3, y: 4 },
            variant: 5,
        });
    });
});
