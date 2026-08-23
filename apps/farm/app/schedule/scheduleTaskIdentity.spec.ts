import { expect, test } from '@playwright/test';
import { getSchedulePlantingTaskIdentity } from './scheduleTaskIdentity';

test('uses the active plant cycle and sort as the immutable planting task identity', () => {
    expect(
        getSchedulePlantingTaskIdentity({
            plantCycles: [
                {
                    active: false,
                    endedEventId: 111,
                    plantPlaceEventId: 101,
                },
                {
                    active: true,
                    endedEventId: 222,
                    plantPlaceEventId: 202,
                },
            ],
            plantSortId: 303,
        }),
    ).toEqual({
        expectedPlantCycleEventId: 202,
        expectedPlantCycleVersionEventId: 222,
        expectedPlantSortId: 303,
    });
});

test('does not expose planting actions without a complete current identity', () => {
    expect(
        getSchedulePlantingTaskIdentity({
            plantCycles: [
                {
                    active: false,
                    endedEventId: 111,
                    plantPlaceEventId: 101,
                },
            ],
            plantSortId: 303,
        }),
    ).toBeNull();
    expect(
        getSchedulePlantingTaskIdentity({
            plantCycles: [
                {
                    active: true,
                    endedEventId: 222,
                    plantPlaceEventId: 202,
                },
            ],
            plantSortId: undefined,
        }),
    ).toBeNull();
    expect(
        getSchedulePlantingTaskIdentity({
            plantCycles: [
                {
                    active: true,
                    endedEventId: 0,
                    plantPlaceEventId: 202,
                },
            ],
            plantSortId: 303,
        }),
    ).toBeNull();
});
