import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
    RaisedBedFieldWithEvents,
    RaisedBedPlantingWithFields,
} from '@gredice/storage';
import {
    countPublicGardenActivePlants,
    serializePublicRaisedBedField,
    serializeRaisedBedPlantingsForGardenView,
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
        plantStatusEventId: undefined,
        plantStatusChangedAt: undefined,
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

    it('preserves public planting state and lifecycle dates', () => {
        const plantScheduledDate = new Date('2026-05-30T08:00:00.000Z');
        const plantSowDate = new Date('2026-06-01T08:00:00.000Z');
        const plantGrowthDate = new Date('2026-06-10T08:00:00.000Z');
        const plantReadyDate = new Date('2026-07-10T08:00:00.000Z');
        const field = createField({
            plantGrowthDate,
            plantReadyDate,
            plantScheduledDate,
            plantSowDate,
            plantStatus: 'ready',
            sowingLocation: 'direct',
        });

        const publicField = serializePublicRaisedBedField(field);

        assert.equal(publicField.plantStatus, 'ready');
        assert.equal(publicField.sowingLocation, 'direct');
        assert.equal(publicField.plantScheduledDate, plantScheduledDate);
        assert.equal(publicField.plantSowDate, plantSowDate);
        assert.equal(publicField.plantGrowthDate, plantGrowthDate);
        assert.equal(publicField.plantReadyDate, plantReadyDate);
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

describe('serializeRaisedBedPlantingsForGardenView', () => {
    const lifecycleStartedAt = new Date('2025-04-02T08:00:00.000Z');
    const projectionCreatedAt = new Date('2026-08-10T08:00:00.000Z');
    const plantings = [
        {
            id: 12,
            plantSortId: 7,
            anchorPositionIndex: 5,
            minSeedingDistanceCm: null,
            optimalSeedingDistanceCm: null,
            maxSeedingDistanceCm: null,
            selectedSeedingDistanceCm: null,
            plantsPerAxis: null,
            plantCount: null,
            layoutKey: null,
            spanRows: 1,
            spanColumns: 1,
            layoutVersion: 1,
            configurationSource: 'legacy' as const,
            isActive: true,
            lifecycleStartedAt,
            lifecycleStoppedAt: null,
            lifecycleVersionEventId: 101,
            lifecycleStatus: null,
            selectedTask: null,
            eventAggregateId: 'raised-bed-planting:legacy:100',
            legacyPlantPlaceEventId: 100,
            createdAt: projectionCreatedAt,
            updatedAt: projectionCreatedAt,
            memberships: [
                {
                    id: 42,
                    plantingId: 12,
                    raisedBedFieldId: 10,
                    relativeRow: 0,
                    relativeColumn: 0,
                    isAnchor: true,
                    createdAt: projectionCreatedAt,
                    updatedAt: projectionCreatedAt,
                    isDeleted: false,
                    raisedBedField: {
                        id: 10,
                        raisedBedId: 20,
                        positionIndex: 5,
                        isDeleted: false,
                    },
                },
            ],
        },
    ];

    it('includes an allowlisted lifecycle projection for authenticated Garden reads', () => {
        const authenticated =
            serializeRaisedBedPlantingsForGardenView(plantings);

        assert.deepEqual(authenticated, {
            plantings: [
                {
                    id: 12,
                    plantSortId: 7,
                    anchorPositionIndex: 5,
                    minSeedingDistanceCm: null,
                    optimalSeedingDistanceCm: null,
                    maxSeedingDistanceCm: null,
                    selectedSeedingDistanceCm: null,
                    plantsPerAxis: null,
                    plantCount: null,
                    layoutKey: null,
                    spanRows: 1,
                    spanColumns: 1,
                    layoutVersion: 1,
                    configurationSource: 'legacy',
                    isActive: true,
                    lifecycleStartedAt,
                    lifecycleStoppedAt: null,
                    lifecycleVersionEventId: 101,
                    lifecycleStatus: null,
                    selectedTask: null,
                    memberships: [
                        {
                            raisedBedFieldId: 10,
                            relativeRow: 0,
                            relativeColumn: 0,
                            isAnchor: true,
                            positionIndex: 5,
                        },
                    ],
                },
            ],
        });
        assert.equal('createdAt' in authenticated.plantings[0], false);
        assert.equal('eventAggregateId' in authenticated.plantings[0], false);
        assert.notEqual(lifecycleStartedAt, projectionCreatedAt);
    });

    it('omits planting and event identifiers from public Garden reads', () => {
        assert.deepEqual(
            serializeRaisedBedPlantingsForGardenView(plantings, {
                publicView: true,
            }),
            {},
        );
    });

    it('exposes selected task state without farm worker identities or event IDs', () => {
        const selectedTask = {
            identity: {
                kind: 'selected',
                plantingId: 12,
                expectedLifecycleVersionEventId: 109,
                expectedPlantSortId: 7,
            },
            status: 'blocked',
            scheduledDate: '2026-08-20T00:00:00.000Z',
            sowingLocation: 'direct',
            startedBy: 'system:checkout',
            initialCommandId: 'dc976426-5e16-5e3e-b442-dfaf269cbe39',
            initialScheduledDate: '2026-08-20T00:00:00.000Z',
            initialSowingLocation: 'direct',
            assignedUserIds: ['farmer-1'],
            assignedBy: 'admin-1',
            assignedAt: new Date('2026-08-10T09:00:00.000Z'),
            block: {
                blockedBy: 'farmer-1',
                reasonCode: 'other',
                reasonLabel: 'Drugi razlog',
                note: 'Čeka se potvrda korisnika.',
                images: ['https://example.test/block.jpg'],
                eventId: 109,
                blockedAt: new Date('2026-08-10T10:00:00.000Z'),
            },
            completion: {
                eventId: 107,
                completedAt: new Date('2026-08-10T08:00:00.000Z'),
                completedBy: 'farmer-1',
                images: ['https://example.test/completed.jpg'],
                notes: 'Posijano.',
                status: 'pendingVerification',
            },
            verification: {
                eventId: 108,
                verifiedAt: new Date('2026-08-10T08:30:00.000Z'),
                verifiedBy: 'admin-1',
            },
            cancellation: {
                eventId: 110,
                cancelledAt: new Date('2026-08-10T11:00:00.000Z'),
                cancelledBy: 'admin-1',
                refundSunflowerAmount: 0,
                reason: 'Otkazano.',
            },
        } satisfies NonNullable<RaisedBedPlantingWithFields['selectedTask']>;

        const serialized = serializeRaisedBedPlantingsForGardenView([
            {
                ...plantings[0],
                configurationSource: 'selected',
                lifecycleStatus: 'planned',
                selectedTask,
            },
        ]);
        assert.ok('plantings' in serialized);
        assert.ok(serialized.plantings);
        const selected = serialized.plantings[0];

        assert.ok(selected?.selectedTask);
        assert.equal(selected.lifecycleStatus, 'planned');
        assert.deepEqual(selected.selectedTask, {
            status: 'blocked',
            scheduledDate: '2026-08-20T00:00:00.000Z',
            sowingLocation: 'direct',
            block: {
                reasonCode: 'other',
                reasonLabel: 'Drugi razlog',
                note: 'Čeka se potvrda korisnika.',
                images: ['https://example.test/block.jpg'],
                blockedAt: new Date('2026-08-10T10:00:00.000Z'),
            },
            completion: {
                completedAt: new Date('2026-08-10T08:00:00.000Z'),
                images: ['https://example.test/completed.jpg'],
                notes: 'Posijano.',
                status: 'pendingVerification',
            },
            verification: {
                verifiedAt: new Date('2026-08-10T08:30:00.000Z'),
            },
            cancellation: {
                cancelledAt: new Date('2026-08-10T11:00:00.000Z'),
                reason: 'Otkazano.',
            },
        });
        const serializedTask = selected.selectedTask as unknown as Record<
            string,
            unknown
        >;
        for (const privateKey of [
            'assignedAt',
            'assignedBy',
            'assignedUserIds',
            'identity',
            'initialCommandId',
            'startedBy',
        ]) {
            assert.equal(privateKey in serializedTask, false);
        }
        assert.equal(
            'blockedBy' in (serializedTask.block as Record<string, unknown>),
            false,
        );
        assert.equal(
            'completedBy' in
                (serializedTask.completion as Record<string, unknown>),
            false,
        );
        assert.equal(
            'verifiedBy' in
                (serializedTask.verification as Record<string, unknown>),
            false,
        );
        assert.equal(
            'cancelledBy' in
                (serializedTask.cancellation as Record<string, unknown>),
            false,
        );
    });
});
