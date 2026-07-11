import assert from 'node:assert/strict';
import test from 'node:test';
import {
    visibleOperationsForGarden,
    visibleRaisedBedsForGarden,
} from './suncokretGardenContext';

test('visibleRaisedBedsForGarden excludes beds whose blocks are no longer placed', () => {
    const visibleRaisedBeds = visibleRaisedBedsForGarden({
        raisedBeds: [
            { id: 11, blockId: 'current-block' },
            { id: 12, blockId: 'deleted-block' },
            { id: 13, blockId: null },
        ],
        stacks: [{ blocks: ['current-block', 'decoration-block'] }],
    });

    assert.deepStrictEqual(
        visibleRaisedBeds.map((raisedBed) => raisedBed.id),
        [11],
    );
});

test('visibleOperationsForGarden keeps garden-wide and visible-bed operations', () => {
    const garden = {
        raisedBeds: [
            { id: 11, blockId: 'current-block' },
            { id: 12, blockId: 'deleted-block' },
            { id: 13, blockId: null },
        ],
        stacks: [{ blocks: ['current-block'] }],
    };
    const operations = [
        { id: 101, raisedBedId: null },
        { id: 102, raisedBedId: 11 },
        { id: 103, raisedBedId: 12 },
        { id: 104, raisedBedId: 13 },
    ];

    assert.deepStrictEqual(
        visibleOperationsForGarden(garden, operations).map(
            (operation) => operation.id,
        ),
        [101, 102],
    );
});
