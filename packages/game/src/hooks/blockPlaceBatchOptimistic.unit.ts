import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GardenStack } from '../types/Stack';
import {
    applyOptimisticBatchPlacement,
    batchPlacementDropAnimationLimit,
    confirmOptimisticBatchPlacement,
    rollbackOptimisticBatchPlacement,
    selectBatchPlacementEffects,
} from './blockPlaceBatchOptimistic';

function stack(
    x: number,
    z: number,
    blocks: { id: string; name: string; rotation?: number }[],
): GardenStack {
    return {
        position: { x, y: 0, z },
        blocks: blocks.map((block) => ({
            rotation: 0,
            ...block,
        })),
    };
}

function createGarden() {
    return {
        id: 951,
        name: 'Vrt',
        stacks: [
            stack(0, 0, [{ id: 'ground:0:0', name: 'Block_Grass' }]),
            stack(1, 0, [
                { id: 'ground:1:0', name: 'Block_Grass' },
                // An unrelated single placement still waiting for its id.
                { id: 'optimistic-block:Bush:other', name: 'Bush' },
            ]),
            stack(2, 0, []),
        ],
    };
}

const copies = [
    { blockId: 'optimistic-block:Tulip:a', position: { x: 1, y: 0 } },
    { blockId: 'optimistic-block:Tulip:b', position: { x: 2, y: 0 } },
    { blockId: 'optimistic-block:Tulip:c', position: { x: 3, y: 0 } },
    { blockId: 'optimistic-block:Tulip:d', position: { x: 3, y: 1 } },
];

function blockIdsAt(garden: { stacks: GardenStack[] }, x: number, z: number) {
    return garden.stacks
        .filter((item) => item.position.x === x && item.position.z === z)
        .map((item) => item.blocks.map((block) => block.id));
}

describe('applyOptimisticBatchPlacement', () => {
    it('appends every copy to its stack and adds missing stacks in one pass', () => {
        const garden = createGarden();
        const next = applyOptimisticBatchPlacement(garden, {
            blockName: 'Tulip',
            placements: copies,
            rotation: 0,
        });

        assert.notEqual(next, garden);
        assert.equal(next.id, 951);
        // Untouched stacks keep their identity: the pass copies only the
        // stacks it changes.
        assert.equal(next.stacks[0], garden.stacks[0]);
        assert.deepEqual(blockIdsAt(next, 1, 0), [
            [
                'ground:1:0',
                'optimistic-block:Bush:other',
                'optimistic-block:Tulip:a',
            ],
        ]);
        assert.deepEqual(blockIdsAt(next, 2, 0), [
            ['optimistic-block:Tulip:b'],
        ]);
        assert.deepEqual(blockIdsAt(next, 3, 0), [
            ['optimistic-block:Tulip:c'],
        ]);
        assert.deepEqual(blockIdsAt(next, 3, 1), [
            ['optimistic-block:Tulip:d'],
        ]);
        assert.deepEqual(next.stacks.at(-1)?.position, { x: 3, y: 0, z: 1 });
        // The input garden is not mutated.
        assert.deepEqual(garden, createGarden());
    });

    it('gives every copy the source rotation as quarter turns', () => {
        for (const [rotation, expected] of [
            [5, 1],
            [-1, 3],
            [null, 0],
            [2, 2],
        ] as const) {
            const next = applyOptimisticBatchPlacement(createGarden(), {
                blockName: 'Tulip',
                placements: copies.slice(0, 2),
                rotation,
            });
            const placed = next.stacks
                .flatMap((item) => item.blocks)
                .filter((block) => block.name === 'Tulip');
            assert.deepEqual(
                placed.map((block) => block.rotation),
                [expected, expected],
                String(rotation),
            );
        }
    });

    it('writes to the first stack when legacy data has two at one cell', () => {
        const garden = {
            stacks: [
                stack(4, 4, [{ id: 'first', name: 'Block_Grass' }]),
                stack(4, 4, [{ id: 'second', name: 'Block_Grass' }]),
            ],
        };
        const next = applyOptimisticBatchPlacement(garden, {
            blockName: 'Tulip',
            placements: [{ blockId: 'copy', position: { x: 4, y: 4 } }],
            rotation: 0,
        });
        assert.deepEqual(blockIdsAt(next, 4, 4), [
            ['first', 'copy'],
            ['second'],
        ]);
    });

    it('returns the same garden for an empty batch', () => {
        const garden = createGarden();
        assert.equal(
            applyOptimisticBatchPlacement(garden, {
                blockName: 'Tulip',
                placements: [],
                rotation: 0,
            }),
            garden,
        );
    });
});

describe('confirmOptimisticBatchPlacement', () => {
    it('maps every optimistic id to its saved id in one pass', () => {
        const applied = applyOptimisticBatchPlacement(createGarden(), {
            blockName: 'Tulip',
            placements: copies,
            rotation: 1,
        });
        const confirmed = confirmOptimisticBatchPlacement(
            applied,
            copies.map(
                (copy, index) => [copy.blockId, `saved-${index}`] as const,
            ),
        );

        assert.equal(confirmed.stacks[0], applied.stacks[0]);
        assert.deepEqual(blockIdsAt(confirmed, 1, 0), [
            ['ground:1:0', 'optimistic-block:Bush:other', 'saved-0'],
        ]);
        assert.deepEqual(blockIdsAt(confirmed, 3, 1), [['saved-3']]);
        const saved = confirmed.stacks
            .flatMap((item) => item.blocks)
            .filter((block) => block.id.startsWith('saved-'));
        assert.equal(saved.length, 4);
        assert.ok(saved.every((block) => block.rotation === 1));
        // The other pending placement keeps its optimistic id.
        assert.ok(
            confirmed.stacks.some((item) =>
                item.blocks.some(
                    (block) => block.id === 'optimistic-block:Bush:other',
                ),
            ),
        );
    });

    it('records the paid unit price on the saved copies only', () => {
        const applied = applyOptimisticBatchPlacement(createGarden(), {
            blockName: 'Tulip',
            placements: copies,
            rotation: 0,
        });
        const confirmed = confirmOptimisticBatchPlacement(
            applied,
            copies.map(
                (copy, index) => [copy.blockId, `saved-${index}`] as const,
            ),
            { paidSunflowers: 15 },
        );
        const blocks = confirmed.stacks.flatMap((item) => item.blocks);

        assert.deepEqual(
            blocks
                .filter((block) => block.id.startsWith('saved-'))
                .map((block) => block.paidSunflowers),
            [15, 15, 15, 15],
        );
        // Blocks that were already there, and other pending placements,
        // keep what they had.
        assert.ok(
            blocks
                .filter((block) => !block.id.startsWith('saved-'))
                .every((block) => block.paidSunflowers === undefined),
        );
        // Without a price (local sandbox) the field is not added.
        assert.ok(
            confirmOptimisticBatchPlacement(
                applied,
                copies.map(
                    (copy, index) => [copy.blockId, `saved-${index}`] as const,
                ),
            )
                .stacks.flatMap((item) => item.blocks)
                .every((block) => !('paidSunflowers' in block)),
        );
    });

    it('returns the same garden when no id changes (local sandbox)', () => {
        const applied = applyOptimisticBatchPlacement(createGarden(), {
            blockName: 'Tulip',
            placements: copies,
            rotation: 0,
        });
        assert.equal(
            confirmOptimisticBatchPlacement(
                applied,
                copies.map((copy) => [copy.blockId, copy.blockId] as const),
            ),
            applied,
        );
        assert.equal(confirmOptimisticBatchPlacement(applied, []), applied);
    });
});

describe('rollbackOptimisticBatchPlacement', () => {
    it('removes only the batch copies and the stacks they created', () => {
        const garden = createGarden();
        const applied = applyOptimisticBatchPlacement(garden, {
            blockName: 'Tulip',
            placements: copies,
            rotation: 0,
        });
        const rolledBack = rollbackOptimisticBatchPlacement(
            applied,
            copies.map((copy) => copy.blockId),
        );

        assert.equal(rolledBack.stacks[0], applied.stacks[0]);
        assert.deepEqual(blockIdsAt(rolledBack, 1, 0), [
            ['ground:1:0', 'optimistic-block:Bush:other'],
        ]);
        assert.deepEqual(blockIdsAt(rolledBack, 3, 0), []);
        assert.deepEqual(blockIdsAt(rolledBack, 3, 1), []);
        // The cell that held only a copy loses its stack, as a single
        // placement's rollback does.
        assert.deepEqual(blockIdsAt(rolledBack, 2, 0), []);
        assert.equal(rolledBack.stacks.length, garden.stacks.length - 1);
    });

    it('returns the same garden when none of the ids is there', () => {
        const garden = createGarden();
        assert.equal(
            rollbackOptimisticBatchPlacement(garden, ['missing']),
            garden,
        );
        assert.equal(rollbackOptimisticBatchPlacement(garden, []), garden);
    });
});

describe('selectBatchPlacementEffects', () => {
    it('animates at most the first twelve copies', () => {
        const placements = Array.from({ length: 99 }, (_, index) => ({
            position: { x: index % 10, y: Math.floor(index / 10) },
        }));
        const effects = selectBatchPlacementEffects(placements);
        assert.equal(batchPlacementDropAnimationLimit, 12);
        assert.deepEqual(
            effects.animatedIndices,
            Array.from({ length: 12 }, (_, index) => index),
        );
    });

    it('puts the sunflower fly-in on the copy nearest the middle', () => {
        const placements = [
            { position: { x: 1, y: 0 } },
            { position: { x: 0, y: 1 } },
            { position: { x: 1, y: 1 } },
            { position: { x: 2, y: 2 } },
            { position: { x: 0, y: 2 } },
            { position: { x: 2, y: 0 } },
        ];
        const effects = selectBatchPlacementEffects(placements);
        assert.equal(effects.sunflowerEffectIndex, 2);
        assert.deepEqual(effects.animatedIndices, [0, 1, 2, 3, 4, 5]);
    });

    it('handles an empty batch', () => {
        assert.deepEqual(selectBatchPlacementEffects([]), {
            animatedIndices: [],
            sunflowerEffectIndex: null,
        });
    });
});
