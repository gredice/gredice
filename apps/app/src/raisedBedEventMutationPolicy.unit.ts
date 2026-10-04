import assert from 'node:assert/strict';
import test from 'node:test';
import { knownEventTypes } from '@gredice/storage';
import {
    activeSelectedPlantingPositionIndices,
    canMutateRaisedBedHistoryEvent,
    raisedBedEventMutationDecision,
    raisedBedFieldHistoryEventTypes,
    raisedBedHistoryEventTypes,
    runRaisedBedEventMutation,
} from './raisedBedEventMutationPolicy';

const raisedBedId = 42;
const raisedBedAggregateId = raisedBedId.toString();
const fieldAggregateId = `${raisedBedAggregateId}|0`;

test('selected-only and co-planted positions make field history read-only', () => {
    const selectedOnly = activeSelectedPlantingPositionIndices([
        {
            configurationSource: 'selected',
            isActive: true,
            memberships: [{ raisedBedField: { positionIndex: 0 } }],
        },
    ]);
    assert.deepEqual([...selectedOnly], [0]);

    const coPlanted = activeSelectedPlantingPositionIndices([
        {
            configurationSource: 'legacy',
            isActive: true,
            memberships: [{ raisedBedField: { positionIndex: 1 } }],
        },
        {
            configurationSource: 'selected',
            isActive: true,
            memberships: [{ raisedBedField: { positionIndex: 1 } }],
        },
        {
            configurationSource: 'selected',
            isActive: true,
            memberships: [{ raisedBedField: { positionIndex: 1 } }],
        },
    ]);
    assert.deepEqual([...coPlanted], [1]);

    for (const type of raisedBedFieldHistoryEventTypes) {
        assert.deepEqual(
            raisedBedEventMutationDecision(
                { aggregateId: fieldAggregateId, type },
                raisedBedId,
                {
                    activeSelectedPlantingPositionIndices: selectedOnly,
                },
            ),
            { allowed: false, reason: 'selected_planting_conflict' },
        );
    }
    assert.deepEqual(
        raisedBedEventMutationDecision(
            {
                aggregateId: raisedBedAggregateId,
                type: knownEventTypes.raisedBeds.create,
            },
            raisedBedId,
            { activeSelectedPlantingPositionIndices: selectedOnly },
        ),
        { allowed: true },
    );
});

test('inactive selected and legacy-only positions keep history mutations available', () => {
    const positionIndices = activeSelectedPlantingPositionIndices([
        {
            configurationSource: 'legacy',
            isActive: true,
            memberships: [{ raisedBedField: { positionIndex: 0 } }],
        },
        {
            configurationSource: 'selected',
            isActive: false,
            memberships: [{ raisedBedField: { positionIndex: 1 } }],
        },
    ]);
    assert.equal(positionIndices.size, 0);
    assert.deepEqual(
        raisedBedEventMutationDecision(
            {
                aggregateId: fieldAggregateId,
                type: knownEventTypes.raisedBedFields.plantUpdate,
            },
            raisedBedId,
            { activeSelectedPlantingPositionIndices: positionIndices },
        ),
        { allowed: true },
    );
});

test('raised-bed history events shown in admin are mutable for the owning bed', () => {
    assert.ok(
        raisedBedFieldHistoryEventTypes.includes(
            knownEventTypes.raisedBedFields.plantBlock,
        ),
    );

    for (const type of raisedBedHistoryEventTypes) {
        assert.deepStrictEqual(
            raisedBedEventMutationDecision(
                { aggregateId: raisedBedAggregateId, type },
                raisedBedId,
            ),
            { allowed: true },
        );
    }
    for (const type of raisedBedFieldHistoryEventTypes) {
        assert.deepStrictEqual(
            raisedBedEventMutationDecision(
                { aggregateId: fieldAggregateId, type },
                raisedBedId,
            ),
            { allowed: true },
        );
    }

    assert.strictEqual(
        canMutateRaisedBedHistoryEvent(
            {
                aggregateId: fieldAggregateId,
                type: knownEventTypes.operations.complete,
            },
            raisedBedId,
        ),
        false,
    );
});

test('only owned raised-bed and field history events can be mutated', () => {
    for (const type of raisedBedHistoryEventTypes) {
        for (const aggregateId of ['41', '42|0', '42|00', '42|-1', '42|0|1']) {
            assert.strictEqual(
                canMutateRaisedBedHistoryEvent(
                    {
                        aggregateId,
                        type,
                    },
                    raisedBedId,
                ),
                false,
            );
        }
    }
    for (const type of raisedBedFieldHistoryEventTypes) {
        for (const aggregateId of ['41|0', '42', '42|00', '42|-1', '42|0|1']) {
            assert.strictEqual(
                canMutateRaisedBedHistoryEvent(
                    {
                        aggregateId,
                        type,
                    },
                    raisedBedId,
                ),
                false,
            );
        }
    }
});

test('event mutation runner fails closed before invoking storage mutations', async () => {
    let mutationCount = 0;
    const mutableEvent = {
        aggregateId: fieldAggregateId,
        type: knownEventTypes.raisedBedFields.aiAnalysis,
    };
    const protectedEvent = {
        aggregateId: fieldAggregateId,
        type: knownEventTypes.operations.complete,
    };

    const allowed = await runRaisedBedEventMutation({
        eventId: 10,
        raisedBedId,
        getEvent: async () => mutableEvent,
        mutate: async () => {
            mutationCount += 1;
        },
    });
    assert.deepStrictEqual(allowed, { allowed: true });
    assert.strictEqual(mutationCount, 1);

    const protectedResult = await runRaisedBedEventMutation({
        eventId: 11,
        raisedBedId,
        getEvent: async () => protectedEvent,
        mutate: async () => {
            mutationCount += 1;
        },
    });
    assert.deepStrictEqual(protectedResult, {
        allowed: false,
        reason: 'event_read_only',
    });

    const wrongOwner = await runRaisedBedEventMutation({
        eventId: 12,
        raisedBedId,
        getEvent: async () => ({
            ...mutableEvent,
            aggregateId: '41|0',
        }),
        mutate: async () => {
            mutationCount += 1;
        },
    });
    assert.deepStrictEqual(wrongOwner, {
        allowed: false,
        reason: 'event_not_found',
    });

    const missing = await runRaisedBedEventMutation({
        eventId: 13,
        raisedBedId,
        getEvent: async () => undefined,
        mutate: async () => {
            mutationCount += 1;
        },
    });
    assert.deepStrictEqual(missing, {
        allowed: false,
        reason: 'event_not_found',
    });
    assert.strictEqual(mutationCount, 1);
});
