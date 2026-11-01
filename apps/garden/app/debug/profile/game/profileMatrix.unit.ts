import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createMatrixProfileStacks,
    resolveMatrixProfileSize,
} from './profileMatrix.ts';

test('matrix fixtures contain genuine complete eight-unit spatial chunks', () => {
    const sizes: Array<8 | 64> = [8, 64];
    for (const size of sizes) {
        const stacks = createMatrixProfileStacks(size);
        assert.equal(stacks.length, size * size);
        assert.equal(
            new Set(
                stacks.flatMap((stack) =>
                    stack.blocks.map((block) => block.id),
                ),
            ).size,
            2 * size * size,
        );
        const chunks = Map.groupBy(
            stacks,
            (stack) => `${Math.floor(stack.x / 8)}:${Math.floor(stack.y / 8)}`,
        );
        assert.equal(chunks.size, (size * size) / 64);
        assert.ok([...chunks.values()].every((chunk) => chunk.length === 64));
    }
    assert.equal(resolveMatrixProfileSize('8'), 8);
    for (const invalid of ['8x', '4096', '-1', undefined])
        assert.equal(resolveMatrixProfileSize(invalid), undefined);
});
