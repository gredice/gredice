import assert from 'node:assert/strict';
import test from 'node:test';
import { visibleRaisedBedsForGarden } from './suncokretGardenContext';

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
