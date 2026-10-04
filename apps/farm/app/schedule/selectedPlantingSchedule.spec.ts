import { expect, test } from '@playwright/experimental-ct-react';
import type { SelectedPlantingScheduleSource } from './selectedPlantingSchedule';
import { getScheduledSelectedPlantingsForDay } from './selectedPlantingSchedule';

type TestSelectedPlanting = SelectedPlantingScheduleSource & {
    id: number;
    memberships: readonly { raisedBedFieldId: number }[];
    plantCount: number;
};

function buildSelectedPlanting({
    id,
    memberships = [{ raisedBedFieldId: id }],
    plantCount = 1,
    scheduledDate = '2026-08-10',
}: {
    id: number;
    memberships?: readonly { raisedBedFieldId: number }[];
    plantCount?: number;
    scheduledDate?: string | null;
}): TestSelectedPlanting {
    return {
        configurationSource: 'selected',
        id,
        memberships,
        plantCount,
        selectedTask: {
            block: null,
            completion: null,
            scheduledDate,
            status: 'planned',
        },
    };
}

test('keeps a 2 by 2 planting as one five-minute schedule task source', () => {
    const planting = buildSelectedPlanting({
        id: 51,
        memberships: [
            { raisedBedFieldId: 1 },
            { raisedBedFieldId: 2 },
            { raisedBedFieldId: 4 },
            { raisedBedFieldId: 5 },
        ],
    });

    const result = getScheduledSelectedPlantingsForDay(true, '2026-08-10', [
        {
            id: 10,
            physicalId: 'G-10',
            plantings: [planting],
            status: 'active',
        },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.planting).toBe(planting);
    expect(result[0]?.planting.memberships).toHaveLength(4);
    expect(result[0]?.planting.plantCount).toBe(1);
});

test('keeps same-field co-plants as two explicit logical tasks', () => {
    const first = buildSelectedPlanting({
        id: 61,
        memberships: [{ raisedBedFieldId: 7 }],
        plantCount: 4,
    });
    const second = buildSelectedPlanting({
        id: 62,
        memberships: [{ raisedBedFieldId: 7 }],
        plantCount: 9,
    });

    const result = getScheduledSelectedPlantingsForDay(true, '2026-08-10', [
        {
            id: 10,
            physicalId: 'G-10',
            plantings: [first, second],
            status: 'active',
        },
    ]);

    expect(result.map(({ planting }) => planting.id)).toEqual([61, 62]);
});
