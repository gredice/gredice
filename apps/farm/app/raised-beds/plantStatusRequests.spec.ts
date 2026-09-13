import type { ApprovalRequest } from '@gredice/storage';
import { expect, test } from '@playwright/test';
import { getPendingPlantStateRequestStatus } from './[raisedBedId]/plantStatusRequests';

const plant = {
    plantSortId: 83,
    plantStatus: 'sowed',
    positionIndex: 2,
    planting: { id: 91, lifecycleVersionEventId: 42 },
    legacyField: null,
};
function request(
    overrides: Partial<
        Extract<
            ApprovalRequest['target'],
            { kind: 'raisedBedPlanting.plantStatus' }
        >
    > = {},
): ApprovalRequest {
    return {
        id: 'request',
        status: 'pending',
        requestedBy: 'farmer',
        requestedAt: new Date(),
        createdAt: new Date(),
        target: {
            kind: 'raisedBedPlanting.plantStatus',
            raisedBedId: 9,
            positionIndex: 2,
            plantingId: 91,
            lifecycleVersionEventId: 42,
            plantSortId: 83,
            currentStatus: 'sowed',
            requestedStatus: 'sprouted',
            ...overrides,
        },
    };
}

test('pending badges match the exact selected planting and lifecycle version', () => {
    const matching = request();
    expect(getPendingPlantStateRequestStatus([matching], 9, plant)).toBe(
        'sprouted',
    );
    for (const unrelated of [
        request({ plantingId: 92 }),
        request({ lifecycleVersionEventId: 41 }),
        request({ plantSortId: 84 }),
        request({ raisedBedId: 10 }),
        request({ currentStatus: 'sprouted' }),
        { ...matching, status: 'approved' as const },
    ]) {
        expect(
            getPendingPlantStateRequestStatus([unrelated], 9, plant),
        ).toBeUndefined();
        expect(
            getPendingPlantStateRequestStatus([unrelated, matching], 9, plant),
        ).toBe('sprouted');
    }
});

test('legacy and selected requests sharing a position never disable each other', () => {
    const legacy: ApprovalRequest = {
        ...request(),
        target: {
            kind: 'raisedBedField.plantStatus',
            raisedBedId: 9,
            positionIndex: 2,
            raisedBedFieldId: 31,
            plantCycleEventId: 71,
            plantCycleVersionEventId: 72,
            plantSortId: 83,
            currentStatus: 'sowed',
            requestedStatus: 'notSprouted',
        },
    };
    const legacyPlant = {
        ...plant,
        planting: null,
        legacyField: {
            id: 31,
            plantCycles: [
                { active: true, plantPlaceEventId: 71, endedEventId: 72 },
            ],
        },
    };
    expect(
        getPendingPlantStateRequestStatus([legacy], 9, plant),
    ).toBeUndefined();
    expect(
        getPendingPlantStateRequestStatus([request()], 9, legacyPlant),
    ).toBeUndefined();
    expect(
        getPendingPlantStateRequestStatus([request(), legacy], 9, legacyPlant),
    ).toBe('notSprouted');
});
