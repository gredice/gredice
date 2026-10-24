import assert from 'node:assert/strict';
import test from 'node:test';
import { gardenPackPlacementBodySchema } from '../src/gardenPackPlacementContract';

test('prepaid placement accepts the same complete stack as ordinary placement', () => {
    const command = {
        gardenId: 1,
        operationId: 'test-stack',
        position: { x: 0, y: 0 },
        variant: null,
        expectedExistingBlocks: Array.from(
            { length: 128 },
            (_, index) => `block-${index}`,
        ),
    };
    assert.equal(
        gardenPackPlacementBodySchema.safeParse(command).success,
        true,
    );
    assert.equal(
        gardenPackPlacementBodySchema.safeParse({
            ...command,
            expectedExistingBlocks: [
                ...command.expectedExistingBlocks,
                'overflow',
            ],
        }).success,
        false,
    );
});
