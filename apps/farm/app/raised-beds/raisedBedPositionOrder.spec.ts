import { expect, test } from '@playwright/experimental-ct-react';
import {
    getPlantDetailsPositionIndex,
    getRaisedBedPositionIndexesDescending,
} from './raisedBedPositionOrder';

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

test('completes a partial top row so field 1 remains bottom-right', () => {
    expect(getRaisedBedPositionIndexesDescending([0, 9])).toEqual([
        11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
    ]);
});

test('uses the recorded anchor for a selected footprint rather than its lowest membership', () => {
    // Fields 18, 17, 15, 14 have minimum membership index 13 and anchor index 17.
    const selectedPlant = {
        positionIndex: 13,
        planting: { anchorPositionIndex: 17 },
    };
    expect(getPlantDetailsPositionIndex(selectedPlant) + 1).toBe(18);
    expect(
        getPlantDetailsPositionIndex({ positionIndex: 13, planting: null }) + 1,
    ).toBe(14);
});
