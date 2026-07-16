import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    countAiRequestEventsSince,
    createAutomationDefinition,
    createAutomationRun,
    createDeliveryLifecycleNotificationDecisionOnce,
    createEvent,
    getAiAnalysisEvents,
    getAiAnalysisTotals,
    getAllEvents,
    getEventAggregateIdsByAggregateIdPrefix,
    getEvents,
    getLatestEvents,
    getLatestEventsByAggregateIdPrefix,
    knownEvents,
    knownEventTypes,
    recordAutomationRunStep,
} from '@gredice/storage';
import { createTestDb } from './testDb';

const aiPlantStatusReviewModuleKey =
    'action.createPlantStatusRequestsFromImageAnalysis';

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

test('delivery lifecycle notification decisions are inserted once under concurrent replay', async () => {
    createTestDb();
    const requestId = `request:${randomUUID()}`;
    const decision =
        knownEvents.delivery.requestLifecycleNotificationDecisionV1(requestId, {
            decision: 'suppressed',
            milestone: 'arrived',
            reason: 'idempotency_reused',
            retryAttempt: 0,
            runId: `run:${randomUUID()}`,
            sourceId: `arrival:${randomUUID()}`,
            stopId: '42',
        });

    const results = await Promise.all(
        Array.from(
            { length: 10 },
            async () =>
                await createDeliveryLifecycleNotificationDecisionOnce(decision),
        ),
    );
    assert.equal(results.filter(Boolean).length, 1);
    const recorded = await getEvents(decision.type, [requestId]);
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0]?.version, 1);
    assert.deepEqual(recorded[0]?.data, decision.data);
});

test('getEvents returns empty for unknown aggregate', async () => {
    createTestDb();
    const events = await getEvents(knownEventTypes.accounts.earnSunflowers, [
        'nonexistent',
    ]);
    assert.ok(Array.isArray(events));
    assert.strictEqual(events.length, 0);
});

test('getAllEvents consumes every page for matching aggregate events', async () => {
    createTestDb();
    const firstAggregateId = 'agg-all-events-1';
    const secondAggregateId = 'agg-all-events-2';
    const eventSpecs = [
        [firstAggregateId, 1, '2026-01-01T12:00:00.000Z'],
        [firstAggregateId, 2, '2026-01-02T12:00:00.000Z'],
        [secondAggregateId, 3, '2026-01-03T12:00:00.000Z'],
        [secondAggregateId, 4, '2026-01-04T12:00:00.000Z'],
        [firstAggregateId, 5, '2026-01-05T12:00:00.000Z'],
    ] as const;

    for (const [aggregateId, amount, createdAt] of eventSpecs) {
        await createEvent({
            ...knownEvents.accounts.sunflowersEarnedV1(aggregateId, {
                amount,
                reason: `page-${amount.toString()}`,
            }),
            createdAt: new Date(createdAt),
        });
    }

    const events = await getAllEvents(
        knownEventTypes.accounts.earnSunflowers,
        [firstAggregateId, secondAggregateId],
        { pageSize: 2 },
    );

    assert.deepStrictEqual(
        events.map((event) => event.aggregateId),
        [
            firstAggregateId,
            firstAggregateId,
            secondAggregateId,
            secondAggregateId,
            firstAggregateId,
        ],
    );
    assert.deepStrictEqual(
        events.map((event) => event.createdAt.toISOString()),
        eventSpecs.map(([, , createdAt]) => createdAt),
    );
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

test('AI analysis analytics includes raised-bed, field, and automation operations', async () => {
    createTestDb();
    const raisedBedId = 8123;
    const raisedBedAggregateId = raisedBedId.toString();
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
    const automationDefinition = await createAutomationDefinition({
        key: `test-ai-analytics-${randomUUID()}`,
        name: 'AI analytics plant status review',
        status: 'enabled',
    });
    const automationRun = await createAutomationRun({
        automationDefinition,
        source: 'event',
        sourceEventType: knownEventTypes.raisedBeds.aiAnalysis,
        sourceAggregateId: raisedBedAggregateId,
        dryRun: false,
    });
    assert.ok(automationRun);
    await recordAutomationRunStep({
        runId: automationRun.id,
        nodeId: 'review-plant-statuses',
        moduleKey: aiPlantStatusReviewModuleKey,
        moduleKind: 'action',
        status: 'succeeded',
        output: {
            source: 'raisedBedAiAnalysis',
            raisedBedId,
            imageCount: 2,
            model: 'plant-status-model',
            summary: 'Plants look ready for review.',
            proposalCount: 2,
            acceptedProposalCount: 1,
            requestCount: 1,
            inputTokens: 300,
            outputTokens: 150,
            totalTokens: 450,
            analyzedAt: '2036-03-05T12:00:00.000Z',
        },
        startedAt: new Date('2036-03-05T11:59:00.000Z'),
        completedAt: new Date('2036-03-05T12:00:00.000Z'),
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
            aiPlantStatusReviewModuleKey,
            knownEventTypes.raisedBedFields.aiAnalysis,
            knownEventTypes.raisedBeds.aiAnalysis,
        ],
    );
    assert.deepStrictEqual(
        events.map((event) => event.aiOperationType),
        [
            'raisedBedImagePlantStatusReview',
            'raisedBedFieldImageAnalysis',
            'raisedBedImageAnalysis',
        ],
    );
    assert.deepStrictEqual(
        events.map((event) => event.aggregateId),
        [raisedBedAggregateId, fieldAggregateId, raisedBedAggregateId],
    );

    const allTotals = await getAiAnalysisTotals({ from, to });
    assert.strictEqual(allTotals.count, 3);

    const filteredTotals = await getAiAnalysisTotals({
        from: new Date('2036-03-04T00:00:00.000Z'),
        to,
    });
    assert.strictEqual(filteredTotals.count, 2);

    const plantStatusReviewEvents = await getAiAnalysisEvents({
        from,
        to,
        operationTypes: ['raisedBedImagePlantStatusReview'],
    });
    assert.strictEqual(plantStatusReviewEvents.length, 1);
    assert.strictEqual(plantStatusReviewEvents[0]?.data?.totalTokens, 450);
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
