import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RaisedBedFieldWithEvents } from '@gredice/storage';
import {
    countPublicGardenActivePlants,
    serializePublicRaisedBedField,
} from './publicGardenSerialization';

function createPlantCycle(
    overrides: Partial<RaisedBedFieldWithEvents['plantCycles'][number]> = {},
): RaisedBedFieldWithEvents['plantCycles'][number] {
    return {
        aggregateId: 'field-10',
        positionIndex: 0,
        plantPlaceEventId: 100,
        eventIds: [100, 101],
        startedAt: new Date('2026-06-01T08:00:00.000Z'),
        endedAt: new Date('2026-06-02T08:00:00.000Z'),
        endedEventId: 101,
        active: true,
        plantStatus: 'sowed',
        plantSortId: 7,
        sowingLocation: 'direct',
        statusChanges: [],
        toBeRemoved: false,
        assignedUserId: 'user-1',
        assignedUserIds: ['user-1', 'user-2'],
        assignedBy: 'admin-1',
        assignedAt: new Date('2026-06-01T07:30:00.000Z'),
        ...overrides,
    };
}

function createField(
    overrides: Partial<RaisedBedFieldWithEvents> = {},
): RaisedBedFieldWithEvents {
    return {
        id: 10,
        raisedBedId: 20,
        positionIndex: 0,
        createdAt: new Date('2026-06-01T07:00:00.000Z'),
        updatedAt: new Date('2026-06-01T07:00:00.000Z'),
        isDeleted: false,
        plantCycles: [createPlantCycle()],
        plantStatus: 'sowed',
        plantSortId: 7,
        plantScheduledDate: undefined,
        sowingLocation: 'direct',
        plantSowDate: undefined,
        plantGrowthDate: undefined,
        plantReadyDate: undefined,
        plantDeadDate: undefined,
        plantHarvestedDate: undefined,
        plantRemovedDate: undefined,
        active: true,
        toBeRemoved: false,
        stoppedDate: undefined,
        assignedUserId: 'user-1',
        assignedUserIds: ['user-1'],
        assignedBy: 'admin-1',
        assignedAt: new Date('2026-06-01T07:30:00.000Z'),
        cancellationReason: undefined,
        weedState: null,
        ...overrides,
    };
}

describe('serializePublicRaisedBedField', () => {
    it('omits assignment metadata from fields and nested plant cycles', () => {
        const field = createField();

        const publicField = serializePublicRaisedBedField(field);

        assert.equal('assignedUserId' in publicField, false);
        assert.equal('assignedUserIds' in publicField, false);
        assert.equal('assignedBy' in publicField, false);
        assert.equal('assignedAt' in publicField, false);
        assert.equal(publicField.plantCycles.length, 1);

        const [plantCycle] = publicField.plantCycles;
        assert.ok(plantCycle);
        assert.equal('assignedUserId' in plantCycle, false);
        assert.equal('assignedUserIds' in plantCycle, false);
        assert.equal('assignedBy' in plantCycle, false);
        assert.equal('assignedAt' in plantCycle, false);
        assert.equal(plantCycle.plantSortId, 7);
    });

    it('counts only active planted fields for public garden summaries', () => {
        assert.equal(
            countPublicGardenActivePlants([
                {
                    fields: [
                        createField({ active: true, plantSortId: 7 }),
                        createField({ active: false, plantSortId: 8 }),
                        createField({ active: true, plantSortId: undefined }),
                    ],
                },
                {
                    fields: [createField({ active: true, plantSortId: 9 })],
                },
            ]),
            2,
        );
    });
});
