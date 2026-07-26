import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createRaisedBedFieldCoverPrimitives,
    createRaisedBedFieldSeedDescriptors,
    createRaisedBedFieldSupportDescriptor,
    createRaisedBedFieldWeedTransforms,
    createRaisedBedWholeCoverPrimitives,
    getRaisedBedFieldLocalPosition,
    getRaisedBedFieldVisualChunkKey,
    getRaisedBedFieldWorldPosition,
} from './raisedBedFieldVisualLayout';

function approximatelyEqual(
    actual: number,
    expected: number,
    tolerance = 0.000_000_1,
) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `Expected ${actual.toString()} to be within ${tolerance.toString()} of ${expected.toString()}`,
    );
}

describe('raised-bed field visual layout', () => {
    it('matches the existing vertical and horizontal block-local field grid', () => {
        assert.deepEqual(
            getRaisedBedFieldLocalPosition({
                blockIndex: 0,
                orientation: 'vertical',
                positionIndex: 0,
                y: -0.72,
            }),
            [-0.31, -0.72, 0.27],
        );
        assert.deepEqual(
            getRaisedBedFieldLocalPosition({
                blockIndex: 1,
                orientation: 'vertical',
                positionIndex: 0,
                y: -0.72,
            }),
            [-0.26, -0.72, 0.27],
        );
        assert.deepEqual(
            getRaisedBedFieldLocalPosition({
                blockIndex: 0,
                orientation: 'horizontal',
                positionIndex: 0,
                y: -0.72,
            }),
            [0.27, -0.72, 0.29999999999999993],
        );
        assert.deepEqual(
            getRaisedBedFieldLocalPosition({
                blockIndex: 1,
                orientation: 'horizontal',
                positionIndex: 0,
                y: -0.72,
            }),
            [0.27, -0.72, 0.24999999999999994],
        );
    });

    it('adds a resolved block origin without rotating the field grid twice', () => {
        const position = getRaisedBedFieldWorldPosition({
            blockIndex: 1,
            blockPosition: [4, 2, -3],
            orientation: 'horizontal',
            positionIndex: 0,
            y: -0.72,
        });

        assert.deepEqual(position, [4.27, 1.28, -2.75]);
    });

    it('assigns an entire bed from its bounds centroid to one 8m chunk', () => {
        assert.equal(
            getRaisedBedFieldVisualChunkKey({
                positions: [
                    [-3.4, 1, -1.2],
                    [-2.6, 1, 0.7],
                ],
            }),
            '-1:-1',
        );
        assert.equal(
            getRaisedBedFieldVisualChunkKey({
                positions: [
                    [7.8, 1, 0],
                    [8.2, 1, 0],
                ],
            }),
            '1:0',
        );
        assert.equal(getRaisedBedFieldVisualChunkKey({ positions: [] }), null);
        assert.throws(
            () =>
                getRaisedBedFieldVisualChunkKey({
                    chunkSize: 0,
                    positions: [[0, 0, 0]],
                }),
            /chunk size must be positive/,
        );
    });
});

describe('raised-bed weed transforms', () => {
    it('creates ten deterministic heavy blades and five light blades', () => {
        const input = {
            blockIndex: 1,
            blockPosition: [4, 2, -3] as const,
            orientation: 'horizontal' as const,
            positionIndex: 6,
        };
        const heavy = createRaisedBedFieldWeedTransforms({
            ...input,
            level: 'heavy',
        });
        const repeated = createRaisedBedFieldWeedTransforms({
            ...input,
            level: 'heavy',
        });
        const light = createRaisedBedFieldWeedTransforms({
            ...input,
            level: 'light',
        });

        assert.equal(heavy.length, 10);
        assert.equal(light.length, 5);
        assert.deepEqual(repeated, heavy);

        const fieldCenter = getRaisedBedFieldWorldPosition({
            ...input,
            y: -0.72,
        });
        for (const transform of heavy) {
            assert.ok(
                Math.abs(transform.position[0] - fieldCenter[0]) <= 0.082,
            );
            assert.ok(
                Math.abs(transform.position[2] - fieldCenter[2]) <= 0.082,
            );
            assert.ok(
                transform.scale[0] >= 0.005 && transform.scale[0] <= 0.008,
            );
            assert.ok(
                transform.scale[1] >= 0.052 && transform.scale[1] <= 0.085,
            );
            assert.equal(transform.scale[0], transform.scale[2]);
            approximatelyEqual(
                transform.position[1],
                fieldCenter[1] + transform.scale[1] / 2,
            );
        }
    });

    it('keeps the legacy field seed dependent on block index', () => {
        const firstBlock = createRaisedBedFieldWeedTransforms({
            blockIndex: 0,
            blockPosition: [0, 1, 0],
            level: 'heavy',
            orientation: 'vertical',
            positionIndex: 4,
        });
        const secondBlock = createRaisedBedFieldWeedTransforms({
            blockIndex: 1,
            blockPosition: [0, 1, 1],
            level: 'heavy',
            orientation: 'vertical',
            positionIndex: 4,
        });

        assert.notDeepEqual(secondBlock[0]?.rotation, firstBlock[0]?.rotation);
        assert.notDeepEqual(secondBlock[0]?.scale, firstBlock[0]?.scale);
    });
});

describe('raised-bed cover, support, and seed descriptors', () => {
    it('compiles each field cover into one surface, four hems, and two bars', () => {
        const primitives = createRaisedBedFieldCoverPrimitives({
            blockIndex: 0,
            blockPosition: [0, 1, 0],
            keyPrefix: 'bed:1:field:0',
            orientation: 'vertical',
            positionIndex: 0,
        });

        assert.equal(primitives.length, 7);
        assert.equal(
            primitives.filter(
                (primitive) => primitive.layer === 'cover-surface',
            ).length,
            1,
        );
        assert.equal(
            primitives.filter((primitive) => primitive.layer === 'cover-hem')
                .length,
            4,
        );
        assert.equal(
            primitives.filter((primitive) => primitive.layer === 'cover-bar')
                .length,
            2,
        );
        assert.deepEqual(
            primitives.map((primitive) => primitive.renderOrder),
            [4, 5, 5, 5, 5, 6, 6],
        );
    });

    it('compiles a horizontal and vertical 1x2 whole cover into five primitives', () => {
        const blocks = [
            { blockIndex: 0, position: [0, 1, 0] as const },
            { blockIndex: 1, position: [0, 1, 1] as const },
        ];
        const horizontal = createRaisedBedWholeCoverPrimitives({
            blocks,
            keyPrefix: 'horizontal',
            orientation: 'horizontal',
        });
        const vertical = createRaisedBedWholeCoverPrimitives({
            blocks,
            keyPrefix: 'vertical',
            orientation: 'vertical',
        });

        for (const primitives of [horizontal, vertical]) {
            assert.equal(primitives.length, 5);
            assert.equal(
                primitives.filter(
                    (primitive) => primitive.layer === 'cover-surface',
                ).length,
                1,
            );
            assert.equal(
                primitives.filter(
                    (primitive) => primitive.layer === 'cover-hem',
                ).length,
                4,
            );
            assert.equal(
                primitives.filter(
                    (primitive) => primitive.layer === 'cover-bar',
                ).length,
                0,
            );
        }

        const horizontalSurface = horizontal[0];
        const verticalSurface = vertical[0];
        assert.equal(horizontalSurface?.geometry, 'plane');
        assert.equal(verticalSurface?.geometry, 'plane');
        assert.notDeepEqual(
            horizontalSurface?.transform.scale,
            verticalSurface?.transform.scale,
        );
    });

    it('preserves the support center and seed density layout', () => {
        const support = createRaisedBedFieldSupportDescriptor({
            blockIndex: 0,
            blockPosition: [0, 1, 0],
            key: 'support:0',
            orientation: 'vertical',
            positionIndex: 0,
        });
        const seeds = createRaisedBedFieldSeedDescriptors({
            blockIndex: 0,
            blockPosition: [0, 1, 0],
            keyPrefix: 'seeds:0',
            orientation: 'vertical',
            plantsPerRow: 3,
            positionIndex: 0,
            sown: true,
        });

        assert.deepEqual(support.transform.position, [-0.31, 0.666, 0.27]);
        assert.equal(seeds.length, 9);
        assert.ok(seeds.every((seed) => seed.layer === 'seed-sown'));
        assert.ok(
            seeds.every(
                (seed) =>
                    seed.transform.scale[0] === 1.6 &&
                    seed.transform.scale[1] === 1.6 &&
                    seed.transform.scale[2] === 1.6,
            ),
        );
    });
});
