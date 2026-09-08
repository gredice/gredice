import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getRaisedBedPlantOccupancy,
    isRaisedBedPlantInGreenhouse,
} from '../src/helpers/raisedBedPlantOccupancy';
import type { RaisedBedFieldWithEvents } from '../src/repositories/raisedBedFieldsRepo';
import type { RaisedBedPlantingWithFields } from '../src/repositories/raisedBedPlantingsRepo';

const startedAt = new Date('2026-08-15T04:15:00Z');
const sowedAt = new Date('2026-08-17T09:00:00Z');

function field(
    overrides: Partial<RaisedBedFieldWithEvents> = {},
): RaisedBedFieldWithEvents {
    return {
        id: 1,
        raisedBedId: 502,
        positionIndex: 0,
        isDeleted: false,
        createdAt: startedAt,
        updatedAt: startedAt,
        active: true,
        plantSortId: 42,
        plantStatus: 'sowed',
        sowingLocation: 'greenhouse',
        plantStatusEventId: 2,
        plantStatusChangedAt: sowedAt,
        plantCycles: [],
        plantScheduledDate: startedAt,
        plantSowDate: sowedAt,
        plantGrowthDate: undefined,
        plantReadyDate: undefined,
        plantDeadDate: undefined,
        plantHarvestedDate: undefined,
        plantRemovedDate: undefined,
        toBeRemoved: false,
        stoppedDate: undefined,
        assignedUserIds: [],
        assignedUserId: undefined,
        assignedBy: undefined,
        assignedAt: undefined,
        cancellationReason: undefined,
        weedState: null,
        blockedAt: undefined,
        blockedBy: undefined,
        blockedEventId: undefined,
        blockReasonCode: undefined,
        blockReasonLabel: undefined,
        blockNote: undefined,
        blockImageUrls: undefined,
        ...overrides,
    };
}

function planting(
    overrides: Partial<RaisedBedPlantingWithFields> = {},
): RaisedBedPlantingWithFields {
    return {
        id: 20,
        raisedBedId: 502,
        plantSortId: 50,
        eventAggregateId: 'planting-20',
        legacyPlantPlaceEventId: null,
        anchorPositionIndex: 16,
        configurationSource: 'selected',
        isActive: true,
        isDeleted: false,
        selectedSeedingDistanceCm: 7.5,
        minSeedingDistanceCm: 5,
        optimalSeedingDistanceCm: 10,
        maxSeedingDistanceCm: 60,
        plantsPerAxis: 4,
        plantCount: 16,
        layoutKey: 'v1:fields:1x1:plants:4x4',
        spanRows: 1,
        spanColumns: 1,
        layoutVersion: 1,
        createdAt: new Date('2026-09-01T00:00:00Z'),
        updatedAt: startedAt,
        lifecycleStartedAt: startedAt,
        lifecycleStoppedAt: null,
        lifecycleVersionEventId: 4,
        lifecycleStatus: 'sowed',
        lifecycleStatusEventId: 4,
        lifecycleStatusChanges: [
            { eventId: 3, status: 'planned', occurredAt: startedAt },
            { eventId: 4, status: 'sowed', occurredAt: sowedAt },
        ],
        selectedTask: {
            identity: {
                kind: 'selected',
                plantingId: 20,
                expectedPlantSortId: 50,
                expectedLifecycleVersionEventId: 4,
            },
            status: 'completed',
            sowingLocation: 'greenhouse',
            scheduledDate: startedAt.toISOString(),
            initialScheduledDate: startedAt.toISOString(),
            initialSowingLocation: 'greenhouse',
            startedBy: 'user',
            initialCommandId: 'command',
            assignedUserIds: [],
            assignedBy: null,
            assignedAt: null,
            block: null,
            cancellation: null,
            verification: null,
            completion: {
                eventId: 4,
                completedAt: sowedAt,
                completedBy: 'user',
                images: [],
                status: 'sowed',
            },
        },
        memberships: [membership(16)],
        ...overrides,
    };
}

function membership(
    positionIndex: number,
): RaisedBedPlantingWithFields['memberships'][number] {
    return {
        id: positionIndex + 1,
        plantingId: 20,
        raisedBedFieldId: positionIndex + 1,
        relativeRow: 0,
        relativeColumn: 0,
        isAnchor: true,
        isDeleted: false,
        createdAt: startedAt,
        updatedAt: startedAt,
        raisedBedField: {
            id: positionIndex + 1,
            raisedBedId: 502,
            positionIndex,
            isDeleted: false,
        },
    };
}

test('includes advanced sowing with no legacy plant and retains lifecycle dates', () => {
    const selected = planting();
    const rows = getRaisedBedPlantOccupancy({
        fields: [field({ plantSortId: undefined })],
        plantings: [selected],
    });
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0]?.positionNumbers, [17]);
    assert.equal(rows[0]?.plantSortId, 50);
    assert.equal(rows[0]?.plantSowDate, sowedAt);
    assert.equal(
        rows[0]?.plantScheduledDate?.toISOString(),
        startedAt.toISOString(),
    );
    assert.equal(rows[0]?.legacyField, null);
    assert.equal(rows[0]?.planting, selected);
    assert.equal(rows.filter(isRaisedBedPlantInGreenhouse).length, 1);
});

test('preserves legacy fields without double-counting their planting projection', () => {
    const legacyField = field();
    const rows = getRaisedBedPlantOccupancy({
        fields: [legacyField],
        plantings: [
            planting({
                configurationSource: 'legacy',
                legacyPlantPlaceEventId: 1,
            }),
            planting(),
        ],
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.legacyField, legacyField);
    assert.equal(rows[0]?.key, 'field-1');
    assert.equal(rows[1]?.key, 'planting-20');
});

test('keeps co-plants distinct and a multi-field planting as one logical row', () => {
    const rows = getRaisedBedPlantOccupancy({
        fields: [],
        plantings: [
            planting({
                memberships: [
                    membership(0),
                    membership(1),
                    membership(3),
                    membership(4),
                ],
                spanRows: 2,
                spanColumns: 2,
                plantCount: 1,
            }),
            planting({ id: 21, memberships: [membership(0)] }),
        ],
    });
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0]?.positionNumbers, [1, 2, 4, 5]);
    assert.deepEqual(rows[1]?.positionNumbers, [1]);
    assert.equal(
        rows.filter((row) => row.positionNumbers.includes(1)).length,
        2,
    );
    assert.equal(rows.filter(isRaisedBedPlantInGreenhouse).length, 2);
});

test('omits inactive, deleted and membership-less plantings and deleted memberships', () => {
    const rows = getRaisedBedPlantOccupancy({
        fields: [field({ active: false }), field({ isDeleted: true })],
        plantings: [
            planting({ isActive: false }),
            planting({ isDeleted: true }),
            planting({ memberships: [] }),
            planting({
                memberships: [
                    membership(16),
                    { ...membership(15), isDeleted: true },
                    {
                        ...membership(14),
                        raisedBedField: {
                            ...membership(14).raisedBedField,
                            isDeleted: true,
                        },
                    },
                ],
            }),
        ],
    });
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0]?.positionNumbers, [17]);
});

test('greenhouse excludes direct sowing, transplanted and terminal crops for both models', () => {
    for (const status of [
        'new',
        'planned',
        'pendingVerification',
        'sowed',
        'sprouted',
    ]) {
        assert.equal(
            getRaisedBedPlantOccupancy({
                fields: [field({ plantStatus: status })],
                plantings: [],
            }).filter(isRaisedBedPlantInGreenhouse).length,
            1,
        );
    }
    for (const status of [
        'transplanted',
        'ready',
        'harvested',
        'died',
        'notSprouted',
        'removed',
    ]) {
        assert.equal(
            getRaisedBedPlantOccupancy({
                fields: [field({ plantStatus: status })],
                plantings: [],
            }).filter(isRaisedBedPlantInGreenhouse).length,
            0,
        );
    }
    const direct = planting();
    assert.ok(direct.selectedTask);
    direct.selectedTask.sowingLocation = 'direct';
    const rows = getRaisedBedPlantOccupancy({
        fields: [field({ sowingLocation: 'direct' })],
        plantings: [
            direct,
            planting({ lifecycleStatus: 'harvested' }),
            planting({ lifecycleStatus: 'died' }),
            planting({ lifecycleStatus: 'firstFlowers' }),
        ],
    });
    assert.equal(rows.filter(isRaisedBedPlantInGreenhouse).length, 0);
});
