import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getRaisedBedFieldGroups } from './raisedBedFieldGroups';

const positions = Array.from({ length: 18 }, (_, index) => 17 - index);

test('single-field and co-plants keep one physical cell per field', () => {
    const groups = getRaisedBedFieldGroups(positions, [
        { positionNumbers: [17] },
        { positionNumbers: [17] },
    ]);
    assert.equal(groups.length, 18);
    assert.deepEqual(
        groups.flatMap((group) => group.positionNumbers),
        positions.map((position) => position + 1),
    );
});

test('a 2x2 planting occupies four cells and appears in only one group', () => {
    const groups = getRaisedBedFieldGroups(positions, [
        { positionNumbers: [13, 14, 16, 17] },
        { positionNumbers: [17] },
    ]);
    const shared = groups.filter((group) => group.positionNumbers.includes(17));
    assert.deepEqual(shared, [
        {
            positionNumbers: [17, 16, 14, 13],
            row: 1,
            column: 2,
            rowSpan: 2,
            columnSpan: 2,
        },
    ]);
    assert.equal(groups.length, 15);
});

test('overlapping footprints and their companion cells never overlap or lose fields', () => {
    const plants = [
        { positionNumbers: [13, 14, 16, 17] },
        { positionNumbers: [8, 9, 11, 12] },
        { positionNumbers: [11, 12, 14, 15] },
    ];
    const groups = getRaisedBedFieldGroups(positions, plants);
    assert.equal(
        new Set(groups.flatMap((group) => group.positionNumbers)).size,
        18,
    );
    assert.equal(groups.flatMap((group) => group.positionNumbers).length, 18);
    for (const plant of plants) {
        assert.equal(
            groups.filter((group) =>
                plant.positionNumbers.some((position) =>
                    group.positionNumbers.includes(position),
                ),
            ).length,
            1,
        );
    }
    for (const a of groups)
        for (const b of groups) {
            if (a === b) continue;
            assert.ok(
                a.column + a.columnSpan <= b.column ||
                    b.column + b.columnSpan <= a.column ||
                    a.row + a.rowSpan <= b.row ||
                    b.row + b.rowSpan <= a.row,
            );
        }
});

test('invalid memberships do not create phantom fields', () => {
    assert.deepEqual(
        getRaisedBedFieldGroups([], [{ positionNumbers: [1, 2] }]),
        [],
    );
    assert.equal(
        getRaisedBedFieldGroups([2, 1, 0], [{ positionNumbers: [1, 1, 200] }])
            .length,
        3,
    );
});
