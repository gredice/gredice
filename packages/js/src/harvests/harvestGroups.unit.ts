import assert from 'node:assert/strict';
import test from 'node:test';
import { getHarvestDayKey, groupConsecutiveHarvestFields } from './index';

test('splits twenty sequential fields into groups of at most nine', () => {
    const fields = Array.from({ length: 20 }, (_, index) => ({
        groupKey: 'harvest',
        position: index + 1,
    }));
    const groups = groupConsecutiveHarvestFields(fields.toReversed());
    assert.deepEqual(
        groups.map((group) => group.map((field) => field.position)),
        [
            [1, 2, 3, 4, 5, 6, 7, 8, 9],
            [10, 11, 12, 13, 14, 15, 16, 17, 18],
            [19, 20],
        ],
    );
    assert.equal(fields[0]?.position, 1);
});

test('breaks at gaps and keeps harvest contexts separate even when interleaved', () => {
    const groups = groupConsecutiveHarvestFields([
        { groupKey: 'a', position: 1 },
        { groupKey: 'b', position: 2 },
        { groupKey: 'a', position: 2 },
        { groupKey: 'a', position: 4 },
        { groupKey: 'b', position: 3 },
        { groupKey: 'a', position: 5 },
    ]);
    assert.deepEqual(
        groups.map((group) =>
            group.map((field) => `${field.groupKey}:${field.position}`),
        ),
        [
            ['a:1', 'a:2'],
            ['a:4', 'a:5'],
            ['b:2', 'b:3'],
        ],
    );
});

test('does not treat a duplicate position as a consecutive field', () => {
    assert.deepEqual(
        groupConsecutiveHarvestFields([
            { groupKey: 'a', position: 1 },
            { groupKey: 'a', position: 1 },
            { groupKey: 'a', position: 2 },
        ]).map((group) => group.length),
        [1, 2],
    );
    assert.deepEqual(groupConsecutiveHarvestFields([]), []);
});

test('harvest days follow Zagreb midnight rather than UTC midnight', () => {
    assert.equal(
        getHarvestDayKey(new Date('2026-10-01T22:30:00Z')),
        '2026-10-02',
    );
});
