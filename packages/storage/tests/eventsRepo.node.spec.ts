import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    countAiRequestEventsSince,
    createEvent,
    getAiAnalysisEvents,
    getAiAnalysisTotals,
    getEventAggregateIdsByAggregateIdPrefix,
    getEvents,
    getLatestEvents,
    getLatestEventsByAggregateIdPrefix,
    knownEvents,
    knownEventTypes,
} from '@gredice/storage';
import { createTestDb } from './testDb';

function aiAnalysisData(
    overrides: Partial<
        Parameters<typeof knownEvents.raisedBeds.aiAnalysisV1>[1]
    > = {},
) {
    return {
        markdown: '## Test',
        imageUrl: 'https://example.com/raised-bed.jpg',
        model: 'test-model',
        analyzedAt: '2026-02-02T12:00:00.000Z',
        ...overrides,
    };
}

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

test('getLatestEventsByAggregateIdPrefix returns newest matching events and aggregate IDs', async () => {
    createTestDb();
    const raisedBedAggregateId = `raised-bed-${randomUUID()}`;
    const aggregateIdPrefix = `${raisedBedAggregateId}|`;
    const firstFieldAggregateId = `${aggregateIdPrefix}0`;
    const secondFieldAggregateId = `${aggregateIdPrefix}2`;

    await createEvent({
        ...knownEvents.raisedBedFields.plantPlaceV1(firstFieldAggregateId, {
            plantSortId: '101',
            scheduledDate: '2026-01-01T00:00:00.000Z',
        }),
        createdAt: new Date('2026-01-01T12:00:00.000Z'),
    });
    await createEvent({
        ...knownEvents.raisedBedFields.plantScheduleV1(secondFieldAggregateId, {
            scheduledDate: '2026-01-02T00:00:00.000Z',
        }),
        createdAt: new Date('2026-01-03T12:00:00.000Z'),
    });
    await createEvent({
        ...knownEvents.raisedBedFields.plantPlaceV1(
            `${raisedBedAggregateId}-other|0`,
            {
                plantSortId: '202',
                scheduledDate: '2026-01-04T00:00:00.000Z',
            },
        ),
        createdAt: new Date('2026-01-04T12:00:00.000Z'),
    });
    await createEvent({
        ...knownEvents.accounts.sunflowersEarnedV1(firstFieldAggregateId, {
            amount: 1,
            reason: 'unrelated type',
        }),
        createdAt: new Date('2026-01-05T12:00:00.000Z'),
    });

    const eventTypes = [
        knownEventTypes.raisedBedFields.plantPlace,
        knownEventTypes.raisedBedFields.plantSchedule,
    ];

    const firstPage = await getLatestEventsByAggregateIdPrefix(
        eventTypes,
        aggregateIdPrefix,
        0,
        1,
    );
    assert.deepStrictEqual(
        firstPage.map((event) => event.aggregateId),
        [secondFieldAggregateId],
    );

    const secondPage = await getLatestEventsByAggregateIdPrefix(
        eventTypes,
        aggregateIdPrefix,
        1,
        1,
    );
    assert.deepStrictEqual(
        secondPage.map((event) => event.aggregateId),
        [firstFieldAggregateId],
    );

    const aggregateIds = await getEventAggregateIdsByAggregateIdPrefix(
        eventTypes,
        aggregateIdPrefix,
    );
    assert.deepStrictEqual(aggregateIds, [
        firstFieldAggregateId,
        secondFieldAggregateId,
    ]);
});

test('countAiRequestEventsSince counts account-kind events with legacy aggregate fallback', async () => {
    createTestDb();
    const accountId = `account-${randomUUID()}`;
    const otherAccountId = `account-${randomUUID()}`;
    const legacyAggregateId = `legacy-bed-${randomUUID()}|0`;
    const ignoredLegacyAggregateId = `legacy-bed-${randomUUID()}|0`;
    const requestKind = 'raisedBedImageAnalysis';
    const since = new Date('2026-02-01T00:00:00.000Z');

    await createEvent({
        ...knownEvents.accounts.aiRequestV1(accountId, {
            accountId,
            aiRequestKind: requestKind,
            requestedAt: '2026-02-02T12:00:00.000Z',
        }),
        createdAt: new Date('2026-02-02T12:00:00.000Z'),
    });
    await createEvent({
        ...knownEvents.raisedBedFields.aiAnalysisV1(
            legacyAggregateId,
            aiAnalysisData(),
        ),
        createdAt: new Date('2026-02-03T12:00:00.000Z'),
    });
    await createEvent({
        ...knownEvents.raisedBedFields.aiAnalysisV1(
            legacyAggregateId,
            aiAnalysisData({
                accountId,
                aiRequestKind: requestKind,
            }),
        ),
        createdAt: new Date('2026-02-03T13:00:00.000Z'),
    });
    await createEvent({
        ...knownEvents.accounts.aiRequestV1(otherAccountId, {
            accountId: otherAccountId,
            aiRequestKind: requestKind,
            requestedAt: '2026-02-04T12:00:00.000Z',
        }),
        createdAt: new Date('2026-02-04T12:00:00.000Z'),
    });
    await createEvent({
        ...knownEvents.raisedBedFields.aiAnalysisV1(
            ignoredLegacyAggregateId,
            aiAnalysisData(),
        ),
        createdAt: new Date('2026-02-05T12:00:00.000Z'),
    });
    await createEvent({
        ...knownEvents.accounts.aiRequestV1(accountId, {
            accountId,
            aiRequestKind: requestKind,
            requestedAt: '2026-01-31T12:00:00.000Z',
        }),
        createdAt: new Date('2026-01-31T12:00:00.000Z'),
    });

    const count = await countAiRequestEventsSince({
        type: knownEventTypes.accounts.aiRequest,
        legacyType: [
            knownEventTypes.raisedBeds.aiAnalysis,
            knownEventTypes.raisedBedFields.aiAnalysis,
        ],
        since,
        accountId,
        requestKind,
        legacyAggregateIds: [legacyAggregateId],
    });

    assert.strictEqual(count, 2);
});

test('AI analysis analytics includes raised-bed and field events', async () => {
    createTestDb();
    const raisedBedAggregateId = `raised-bed-${randomUUID()}`;
    const fieldAggregateId = `${raisedBedAggregateId}|0`;
    const from = new Date('2036-03-01T00:00:00.000Z');
    const to = new Date('2036-03-31T23:59:59.999Z');

    await createEvent({
        ...knownEvents.raisedBeds.aiAnalysisV1(
            raisedBedAggregateId,
            aiAnalysisData({
                model: 'raised-bed-model',
                inputTokens: 100,
                outputTokens: 50,
                totalTokens: 150,
            }),
        ),
        createdAt: new Date('2036-03-03T12:00:00.000Z'),
    });
    await createEvent({
        ...knownEvents.raisedBedFields.aiAnalysisV1(
            fieldAggregateId,
            aiAnalysisData({
                model: 'field-model',
                inputTokens: 200,
                outputTokens: 100,
                totalTokens: 300,
            }),
        ),
        createdAt: new Date('2036-03-04T12:00:00.000Z'),
    });
    await createEvent({
        ...knownEvents.accounts.sunflowersEarnedV1(
            `unrelated-account-${randomUUID()}`,
            {
                amount: 10,
                reason: 'unrelated',
            },
        ),
        createdAt: new Date('2036-03-05T12:00:00.000Z'),
    });

    const events = await getAiAnalysisEvents({ from, to });

    assert.deepStrictEqual(
        events.map((event) => event.type),
        [
            knownEventTypes.raisedBedFields.aiAnalysis,
            knownEventTypes.raisedBeds.aiAnalysis,
        ],
    );
    assert.deepStrictEqual(
        events.map((event) => event.aggregateId),
        [fieldAggregateId, raisedBedAggregateId],
    );

    const allTotals = await getAiAnalysisTotals({ from, to });
    assert.strictEqual(allTotals.count, 2);

    const filteredTotals = await getAiAnalysisTotals({
        from: new Date('2036-03-04T00:00:00.000Z'),
        to,
    });
    assert.strictEqual(filteredTotals.count, 1);
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
