import { expect, test } from '@playwright/experimental-ct-react';
import { getRaisedBedPositionIndexesDescending } from './raisedBedPositionOrder';

test('places position 18 top-left and position 1 bottom-right', () => {
    expect(
        getRaisedBedPositionIndexesDescending(
            Array.from({ length: 18 }, (_, index) => index),
        ),
    ).toEqual(Array.from({ length: 18 }, (_, index) => 17 - index));
});

test('keeps the minimum three-by-three preview for sparse raised beds', () => {
    expect(getRaisedBedPositionIndexesDescending([0, 2])).toEqual([
        8, 7, 6, 5, 4, 3, 2, 1, 0,
    ]);
});
