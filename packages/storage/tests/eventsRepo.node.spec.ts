import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from './testDb';
import { getEvents, createEvent, knownEvents, knownEventTypes } from '@gredice/storage';

test('createEvent and getEvents basic usage', async () => {
    createTestDb();
    const aggregateId = 'agg-1';
    const event = knownEvents.accounts.sunflowersEarnedV1(aggregateId, { amount: 100, reason: 'test' });
    await createEvent(event);
    const events = await getEvents(event.type, [aggregateId]);
    assert.ok(Array.isArray(events));
    assert.ok(events.some(e => e.type === event.type && e.aggregateId === aggregateId));
});

test('getEvents returns empty for unknown aggregate', async () => {
    createTestDb();
    const events = await getEvents(knownEventTypes.accounts.earnSunflowers, ['nonexistent']);
    assert.ok(Array.isArray(events));
    assert.strictEqual(events.length, 0);
});
