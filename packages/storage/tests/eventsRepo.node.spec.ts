import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createEvent,
    getEvents,
    getEventsByAggregateIds,
    knownEvents,
    knownEventTypes,
} from '@gredice/storage';
import { createTestDb } from './testDb';

test('createEvent and getEvents basic usage', async () => {
    createTestDb();
    const aggregateId = 'agg-1';
    const event = knownEvents.accounts.sunflowersEarnedV1(aggregateId, {
        amount: 100,
        reason: 'test',
    });
    await createEvent(event);
    const events = await getEvents(event.type, [aggregateId]);
    assert.ok(Array.isArray(events));
    assert.ok(
        events.some(
            (e) => e.type === event.type && e.aggregateId === aggregateId,
        ),
    );
});

test('getEvents returns empty for unknown aggregate', async () => {
    createTestDb();
    const events = await getEvents(knownEventTypes.accounts.earnSunflowers, [
        'nonexistent',
    ]);
    assert.ok(Array.isArray(events));
    assert.strictEqual(events.length, 0);
});

test('getEventsByAggregateIds returns every event type for an aggregate', async () => {
    createTestDb();
    const aggregateId = 'account-1';

    await createEvent(
        knownEvents.accounts.sunflowersEarnedV1(aggregateId, {
            amount: 100,
            reason: 'test',
        }),
    );
    await createEvent({
        type: knownEventTypes.accounts.referral,
        version: 1,
        aggregateId,
        data: { action: 'used_code', code: 'abc123' },
    });
    await createEvent(
        knownEvents.accounts.sunflowersEarnedV1('other-account', {
            amount: 50,
            reason: 'other',
        }),
    );

    const events = await getEventsByAggregateIds([aggregateId]);

    assert.deepStrictEqual(
        events.map((event) => event.type),
        [
            knownEventTypes.accounts.earnSunflowers,
            knownEventTypes.accounts.referral,
        ],
    );
});
