import assert from 'node:assert/strict';
import test from 'node:test';
import { knownEventTypes } from '@gredice/storage';
import {
    canMutateRaisedBedHistoryEvent,
    raisedBedEventMutationDecision,
    raisedBedFieldHistoryEventTypes,
    raisedBedHistoryEventTypes,
    runRaisedBedEventMutation,
} from './raisedBedEventMutationPolicy';

const raisedBedId = 42;
const raisedBedAggregateId = raisedBedId.toString();
const fieldAggregateId = `${raisedBedAggregateId}|0`;

test('raised-bed history includes blockers but keeps task lifecycle events read-only', () => {
    assert.ok(
        raisedBedFieldHistoryEventTypes.includes(
            knownEventTypes.raisedBedFields.plantBlock,
        ),
    );

    const protectedRaisedBedTypes = raisedBedHistoryEventTypes.filter(
        (type) => type !== knownEventTypes.raisedBeds.aiAnalysis,
    );
    const protectedFieldTypes = raisedBedFieldHistoryEventTypes.filter(
        (type) => type !== knownEventTypes.raisedBedFields.aiAnalysis,
    );

    for (const type of protectedRaisedBedTypes) {
        assert.deepStrictEqual(
            raisedBedEventMutationDecision(
                { aggregateId: raisedBedAggregateId, type },
                raisedBedId,
            ),
            { allowed: false, reason: 'event_read_only' },
        );
    }
    for (const type of protectedFieldTypes) {
        assert.deepStrictEqual(
            raisedBedEventMutationDecision(
                { aggregateId: fieldAggregateId, type },
                raisedBedId,
            ),
            { allowed: false, reason: 'event_read_only' },
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

test('only owned raised-bed and field analysis metadata can be mutated', () => {
    assert.strictEqual(
        canMutateRaisedBedHistoryEvent(
            {
                aggregateId: raisedBedAggregateId,
                type: knownEventTypes.raisedBeds.aiAnalysis,
            },
            raisedBedId,
        ),
        true,
    );
    assert.strictEqual(
        canMutateRaisedBedHistoryEvent(
            {
                aggregateId: fieldAggregateId,
                type: knownEventTypes.raisedBedFields.aiAnalysis,
            },
            raisedBedId,
        ),
        true,
    );

    for (const aggregateId of ['41', '42|0', '42|00', '42|-1', '42|0|1']) {
        assert.strictEqual(
            canMutateRaisedBedHistoryEvent(
                {
                    aggregateId,
                    type: knownEventTypes.raisedBeds.aiAnalysis,
                },
                raisedBedId,
            ),
            false,
        );
    }
    for (const aggregateId of ['41|0', '42', '42|00', '42|-1', '42|0|1']) {
        assert.strictEqual(
            canMutateRaisedBedHistoryEvent(
                {
                    aggregateId,
                    type: knownEventTypes.raisedBedFields.aiAnalysis,
                },
                raisedBedId,
            ),
            false,
        );
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
        type: knownEventTypes.raisedBedFields.plantUpdate,
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
