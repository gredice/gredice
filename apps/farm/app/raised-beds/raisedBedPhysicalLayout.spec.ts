import { expect, test } from '@playwright/experimental-ct-react';
import { getRaisedBedPhysicalLayout } from './raisedBedPhysicalLayout';

function beds(...positions: number[]) {
    return positions.map((position) => ({
        id: 100 + position,
        physicalId: String(position),
    }));
}

test('reserves missing bed 4 and anchors bed 1 at the bottom right', () => {
    const { slots, rowCount } = getRaisedBedPhysicalLayout(beds(1, 5, 2, 6, 3));
    expect(rowCount).toBe(2);
    expect(
        slots.map(({ row, column, beds }) => [
            beds[0]?.physicalId,
            row,
            column,
        ]),
    ).toEqual([
        ['6', 1, 1],
        ['5', 1, 2],
        ['3', 2, 1],
        ['2', 2, 2],
        ['1', 2, 3],
    ]);
});

test('preserves partial top rows, entirely missing rows and missing lowest beds', () => {
    const { slots, rowCount } = getRaisedBedPhysicalLayout(beds(10, 4));
    expect(rowCount).toBe(4);
    expect(slots.map(({ row, column }) => [row, column])).toEqual([
        [1, 3],
        [3, 3],
    ]);
});

test('keeps nonnumeric identifiers and duplicate physical identifiers accessible', () => {
    const { slots, rowCount } = getRaisedBedPhysicalLayout([
        ...beds(1, 2),
        { id: 200, physicalId: '1' },
        { id: 201, physicalId: 'A1' },
    ]);
    expect(rowCount).toBe(2);
    expect(slots.flatMap((slot) => slot.beds)).toHaveLength(4);
    expect(slots.at(-1)).toMatchObject({
        row: 2,
        column: 3,
        beds: [{ id: 200 }, { id: 101 }],
    });
});
