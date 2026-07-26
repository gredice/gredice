import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BlockPlacementDropAnimation } from '../useGameState';
import {
    addressPlacementAnimationChunks,
    createPlacementAnimationChunkCache,
    createPlacementDropAnimationRenderIdsSelector,
    localizePlacementDropAnimationChunks,
} from './placementAnimationChunks';

type TestInstance = {
    block: { id: string };
    position: [number, number, number];
    rotation: number;
};

function createInstance(id: string, x: number, z = 0): TestInstance {
    return {
        block: { id },
        position: [x, 0, z],
        rotation: 0,
    };
}

function createAnimation(
    sequence: number,
    sourceBlockId: string,
    particlesSpawned = false,
): BlockPlacementDropAnimation {
    return {
        createdAt: sequence,
        mutationConfirmed: false,
        particlesSpawned,
        renderId: sequence,
        sequence,
        sourceBlockId,
        visualComplete: false,
        visualStarted: true,
    };
}

describe('addressPlacementAnimationChunks', () => {
    it('keeps deterministic block addresses through reorder, add, and remove', () => {
        const first = addressPlacementAnimationChunks([
            createInstance('a', 0),
            createInstance('b', 9),
            createInstance('c', 1),
        ]);

        assert.deepEqual(
            first.chunks.map((chunk) => [
                chunk.key,
                chunk.instances.map((instance) => instance.block.id),
            ]),
            [
                ['0:0', ['a', 'c']],
                ['1:0', ['b']],
            ],
        );
        assert.deepEqual(first.addressByBlockId.get('c'), {
            chunkIndex: 0,
            instanceIndex: 1,
            order: 2,
        });

        const second = addressPlacementAnimationChunks([
            createInstance('c', 1),
            createInstance('d', -1),
            createInstance('a', 0),
        ]);

        assert.deepEqual(
            second.chunks.map((chunk) => [
                chunk.key,
                chunk.instances.map((instance) => instance.block.id),
            ]),
            [
                ['-1:0', ['d']],
                ['0:0', ['c', 'a']],
            ],
        );
        assert.deepEqual(second.addressByBlockId.get('a'), {
            chunkIndex: 1,
            instanceIndex: 1,
            order: 2,
        });
        assert.equal(second.addressByBlockId.has('b'), false);
    });
});

describe('createPlacementDropAnimationRenderIdsSelector', () => {
    it('ignores unrelated animation updates and preserves render identity for particles', () => {
        const select = createPlacementDropAnimationRenderIdsSelector([
            'a',
            'b',
        ]);
        const empty = select({ blockPlacementDropAnimations: {} });
        const unrelated = select({
            blockPlacementDropAnimations: {
                outside: createAnimation(1, 'outside'),
            },
        });

        assert.strictEqual(unrelated, empty);

        const queuedAnimation = createAnimation(2, 'a');
        const queued = select({
            blockPlacementDropAnimations: {
                a: queuedAnimation,
                outside: createAnimation(1, 'outside'),
            },
        });
        assert.deepEqual([...queued], [['a', 2]]);

        const particles = select({
            blockPlacementDropAnimations: {
                a: { ...queuedAnimation, particlesSpawned: true },
                outside: createAnimation(1, 'outside'),
            },
        });
        assert.strictEqual(particles, queued);

        const anotherUnrelatedUpdate = select({
            blockPlacementDropAnimations: {
                a: {
                    ...queuedAnimation,
                    particlesSpawned: true,
                },
                outside: createAnimation(3, 'outside'),
            },
        });
        assert.strictEqual(anotherUnrelatedUpdate, queued);

        const completed = select({ blockPlacementDropAnimations: {} });
        assert.deepEqual([...completed], []);
    });

    it('keeps the optimistic render identity while the store rekeys first', () => {
        const select = createPlacementDropAnimationRenderIdsSelector([
            'optimistic',
        ]);
        const animation = createAnimation(7, 'optimistic');
        const queued = select({
            blockPlacementDropAnimations: { optimistic: animation },
        });
        const storeRekeyed = select({
            blockPlacementDropAnimations: { persisted: animation },
        });

        assert.deepEqual([...queued], [['optimistic', 7]]);
        assert.strictEqual(storeRekeyed, queued);
    });
});

describe('localizePlacementDropAnimationChunks', () => {
    it('replaces only the owning chunk while preserving unrelated references', () => {
        const addressed = addressPlacementAnimationChunks([
            createInstance('a', 0),
            createInstance('b', 1),
            createInstance('c', 9),
            createInstance('d', 17),
        ]);
        const localized = localizePlacementDropAnimationChunks(
            addressed,
            new Map([['a', 1]]),
            createPlacementAnimationChunkCache(),
        );

        assert.notStrictEqual(localized.chunks, addressed.chunks);
        assert.notStrictEqual(localized.chunks[0], addressed.chunks[0]);
        assert.strictEqual(localized.chunks[1], addressed.chunks[1]);
        assert.strictEqual(localized.chunks[2], addressed.chunks[2]);
        assert.deepEqual(
            localized.chunks[0]?.instances.map((instance) => instance.block.id),
            ['b'],
        );
        assert.deepEqual(
            localized.animatedInstances.map(
                ({ instance }) => instance.block.id,
            ),
            ['a'],
        );
        assert.equal(localized.animatedInstances[0]?.renderId, 1);
        assert.equal(
            localized.placementSignatureByChunkKey.get('0:0'),
            '["a"]',
        );
        assert.equal(localized.placementSignatureByChunkKey.has('1:0'), false);
        assert.deepEqual(localized.touchedChunkKeys, ['0:0']);
    });

    it('keeps an emptied owner chunk addressable for completion', () => {
        const addressed = addressPlacementAnimationChunks([
            createInstance('a', 0),
            createInstance('b', 9),
        ]);
        const chunkCache = createPlacementAnimationChunkCache<TestInstance>();
        const queued = localizePlacementDropAnimationChunks(
            addressed,
            new Map([['a', 1]]),
            chunkCache,
        );
        const completed = localizePlacementDropAnimationChunks(
            addressed,
            new Map(),
            chunkCache,
        );

        assert.equal(queued.chunks[0]?.instances.length, 0);
        assert.equal(queued.chunks[0]?.key, '0:0');
        assert.strictEqual(completed.chunks, addressed.chunks);
        assert.notStrictEqual(completed.chunks[0], queued.chunks[0]);
        assert.strictEqual(completed.chunks[0], addressed.chunks[0]);
        assert.strictEqual(completed.chunks[1], queued.chunks[1]);
        assert.equal(completed.placementSignatureByChunkKey.size, 0);
    });

    it('does no work for cancelled or missing animation blocks', () => {
        const addressed = addressPlacementAnimationChunks([
            createInstance('a', 0),
            createInstance('b', 9),
        ]);
        const chunkCache = createPlacementAnimationChunkCache<TestInstance>();

        for (const animatedRenderIds of [
            new Map<string, number>(),
            new Map([['missing', 1]]),
        ]) {
            const localized = localizePlacementDropAnimationChunks(
                addressed,
                animatedRenderIds,
                chunkCache,
            );

            assert.strictEqual(localized.chunks, addressed.chunks);
            assert.deepEqual(localized.animatedInstances, []);
            assert.deepEqual(localized.touchedChunkKeys, []);
        }
    });

    it('reuses unchanged active chunks across sequential cross-chunk updates', () => {
        const addressed = addressPlacementAnimationChunks([
            createInstance('a', 0),
            createInstance('a-peer', 1),
            createInstance('b', 9),
            createInstance('b-peer', 10),
        ]);
        const chunkCache = createPlacementAnimationChunkCache<TestInstance>();

        const onlyA = localizePlacementDropAnimationChunks(
            addressed,
            new Map([['a', 1]]),
            chunkCache,
        );
        const aAndB = localizePlacementDropAnimationChunks(
            addressed,
            new Map([
                ['a', 1],
                ['b', 2],
            ]),
            chunkCache,
        );
        const onlyB = localizePlacementDropAnimationChunks(
            addressed,
            new Map([['b', 2]]),
            chunkCache,
        );

        assert.strictEqual(aAndB.chunks[0], onlyA.chunks[0]);
        assert.strictEqual(
            aAndB.chunks[0]?.instances,
            onlyA.chunks[0]?.instances,
        );
        assert.strictEqual(onlyB.chunks[1], aAndB.chunks[1]);
        assert.strictEqual(
            onlyB.chunks[1]?.instances,
            aAndB.chunks[1]?.instances,
        );
        assert.strictEqual(onlyB.chunks[0], addressed.chunks[0]);
        assert.equal(aAndB.placementSignatureByChunkKey.get('0:0'), '["a"]');
        assert.equal(aAndB.placementSignatureByChunkKey.get('1:0'), '["b"]');
    });
});
