import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createEvent,
    getEvents,
    getLatestEvents,
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

test('getLatestEvents returns newest events first and paginates', async () => {
    createTestDb();
    const aggregateId = 'agg-latest';
    const eventDates = [
        new Date('2026-01-01T12:00:00.000Z'),
        new Date('2026-01-02T12:00:00.000Z'),
        new Date('2026-01-03T12:00:00.000Z'),
    ];

    for (const [index, createdAt] of eventDates.entries()) {
        await createEvent({
            ...knownEvents.accounts.sunflowersEarnedV1(aggregateId, {
                amount: index + 1,
                reason: `test-${index + 1}`,
            }),
            createdAt,
        });
    }

    const firstPage = await getLatestEvents(
        knownEventTypes.accounts.earnSunflowers,
        [aggregateId],
        0,
        2,
    );
    assert.deepStrictEqual(
        firstPage.map((event) => event.createdAt.toISOString()),
        ['2026-01-03T12:00:00.000Z', '2026-01-02T12:00:00.000Z'],
    );

    const secondPage = await getLatestEvents(
        knownEventTypes.accounts.earnSunflowers,
        [aggregateId],
        2,
        1,
    );
    assert.deepStrictEqual(
        secondPage.map((event) => event.createdAt.toISOString()),
        ['2026-01-01T12:00:00.000Z'],
    );
});

test('getLatestEvents can list multiple event types for an aggregate', async () => {
    createTestDb();
    const aggregateId = 'account-1';

    await createEvent({
        ...knownEvents.accounts.sunflowersEarnedV1(aggregateId, {
            amount: 100,
            reason: 'test',
        }),
        createdAt: new Date('2026-01-01T12:00:00.000Z'),
    });
    await createEvent({
        type: knownEventTypes.accounts.referral,
        version: 1,
        aggregateId,
        data: { action: 'used_code', code: 'abc123' },
        createdAt: new Date('2026-01-02T12:00:00.000Z'),
    });
    await createEvent(
        knownEvents.accounts.sunflowersEarnedV1('other-account', {
            amount: 50,
            reason: 'other',
        }),
    );

    const events = await getLatestEvents(
        [
            knownEventTypes.accounts.earnSunflowers,
            knownEventTypes.accounts.referral,
        ],
        [aggregateId],
    );

    assert.deepStrictEqual(
        events.map((event) => event.type),
        [
            knownEventTypes.accounts.referral,
            knownEventTypes.accounts.earnSunflowers,
        ],
    );
});
