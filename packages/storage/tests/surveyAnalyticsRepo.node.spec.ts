import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accounts,
    buildSurveyAssignmentFunnel,
    fillSurveyAnalyticsTrend,
    getSurveyAnalyticsAdmin,
    sql,
    storage,
    surveyAnswers,
    surveyAssignments,
    surveyQuestions,
    surveyResponses,
    surveys,
    surveyVersions,
    users,
} from '@gredice/storage';
import { createTestDb } from './testDb';

test('survey analytics helpers keep zero rates safe and fill Zagreb buckets', () => {
    const funnel = buildSurveyAssignmentFunnel({
        assigned: 0,
        unopened: 0,
        opened: 0,
        started: 0,
        submitted: 0,
        expired: 0,
        canceled: 0,
        reachedOpened: 0,
        reachedStarted: 0,
        reachedSubmitted: 0,
    });

    assert.equal(funnel.reconciles, true);
    assert.equal(funnel.openRate, null);
    assert.equal(funnel.startRate, null);
    assert.equal(funnel.completionRate, null);
    assert.equal(funnel.responseRate, null);

    assert.deepEqual(
        fillSurveyAnalyticsTrend({
            from: new Date('2026-03-27T23:00:00.000Z'),
            to: new Date('2026-03-30T21:59:59.999Z'),
            interval: 'day',
            rows: [
                { bucketKey: '2026-03-28', count: 1 },
                { bucketKey: '2026-03-30', count: 2 },
            ],
        }),
        [
            { bucketKey: '2026-03-28', count: 1 },
            { bucketKey: '2026-03-29', count: 0 },
            { bucketKey: '2026-03-30', count: 2 },
        ],
    );
    assert.deepEqual(
        fillSurveyAnalyticsTrend({
            from: new Date('2026-01-07T12:00:00.000Z'),
            to: new Date('2026-01-20T12:00:00.000Z'),
            interval: 'week',
            rows: [
                { bucketKey: '2026-01-05', count: 1 },
                { bucketKey: '2026-01-19', count: 2 },
            ],
        }),
        [
            { bucketKey: '2026-01-05', count: 1 },
            { bucketKey: '2026-01-12', count: 0 },
            { bucketKey: '2026-01-19', count: 2 },
        ],
    );
    assert.deepEqual(
        fillSurveyAnalyticsTrend({
            from: new Date('2026-01-15T12:00:00.000Z'),
            to: new Date('2026-03-02T12:00:00.000Z'),
            interval: 'month',
            rows: [{ bucketKey: '2026-02-01', count: 4 }],
        }),
        [
            { bucketKey: '2026-01-01', count: 0 },
            { bucketKey: '2026-02-01', count: 4 },
            { bucketKey: '2026-03-01', count: 0 },
        ],
    );
});

test('survey analytics reconcile effective states and isolate versioned aggregates', async () => {
    createTestDb();

    const surveyId = randomUUID();
    const firstVersionId = randomUUID();
    const secondVersionId = randomUUID();
    const firstQuestionId = randomUUID();
    const secondQuestionId = randomUUID();
    const privateQuestionId = randomUUID();
    const accountId = randomUUID();
    const userId = randomUUID();
    const asOf = new Date('2026-03-30T12:00:00.000Z');
    const inPeriodCreatedAt = new Date('2026-03-28T10:00:00.000Z');

    await storage().insert(accounts).values({ id: accountId });
    await storage()
        .insert(users)
        .values({
            id: userId,
            userName: `survey-analytics-${userId}@example.com`,
            displayName: 'Survey Analytics User',
            role: 'user',
        });
    await storage()
        .insert(surveys)
        .values({
            id: surveyId,
            key: `survey_analytics_${surveyId}`,
            title: 'Analytics survey',
            category: 'test',
            status: 'published',
        });
    await storage()
        .insert(surveyVersions)
        .values([
            {
                id: firstVersionId,
                surveyId,
                versionNumber: 1,
                status: 'published',
                title: 'Original wording',
            },
            {
                id: secondVersionId,
                surveyId,
                versionNumber: 2,
                status: 'published',
                title: 'Updated wording',
            },
        ]);
    await storage()
        .insert(surveyQuestions)
        .values([
            {
                id: firstQuestionId,
                versionId: firstVersionId,
                key: 'score',
                type: 'opinion_scale',
                title: 'Original score',
                sortOrder: 1,
                settings: {
                    type: 'opinion_scale',
                    min: 0,
                    max: 2,
                    step: 2,
                },
            },
            {
                id: privateQuestionId,
                versionId: firstVersionId,
                key: 'private_comment',
                type: 'long_text',
                title: 'Private comment',
                sortOrder: 2,
                settings: { type: 'long_text', maxLength: 200 },
            },
            {
                id: secondQuestionId,
                versionId: secondVersionId,
                key: 'score',
                type: 'opinion_scale',
                title: 'Updated score',
                sortOrder: 1,
                settings: { type: 'opinion_scale', min: 1, max: 3 },
            },
        ]);

    const assignmentIds = Array.from({ length: 9 }, () => randomUUID());
    const assignmentRows = [
        {
            id: assignmentIds[0],
            status: 'pending',
            openedAt: null,
            expiresAt: null,
        },
        {
            id: assignmentIds[1],
            status: 'pending',
            openedAt: new Date('2026-03-28T11:00:00.000Z'),
            expiresAt: null,
        },
        {
            id: assignmentIds[2],
            status: 'started',
            openedAt: new Date('2026-03-28T11:00:00.000Z'),
            startedAt: new Date('2026-03-28T11:01:00.000Z'),
            expiresAt: null,
        },
        {
            id: assignmentIds[3],
            status: 'submitted',
            openedAt: new Date('2026-03-28T11:00:00.000Z'),
            startedAt: new Date('2026-03-28T11:01:00.000Z'),
            submittedAt: new Date('2026-03-28T11:05:00.000Z'),
            expiresAt: null,
        },
        {
            id: assignmentIds[4],
            status: 'expired',
            openedAt: null,
            expiresAt: new Date('2026-03-27T12:00:00.000Z'),
        },
        {
            id: assignmentIds[5],
            status: 'canceled',
            openedAt: null,
            expiresAt: null,
            canceledAt: new Date('2026-03-28T11:00:00.000Z'),
        },
        {
            id: assignmentIds[6],
            status: 'pending',
            openedAt: null,
            expiresAt: new Date('2026-03-29T12:00:00.000Z'),
        },
        {
            id: assignmentIds[7],
            status: 'started',
            openedAt: new Date('2026-03-28T11:00:00.000Z'),
            startedAt: new Date('2026-03-28T11:01:00.000Z'),
            expiresAt: new Date('2026-03-29T12:00:00.000Z'),
        },
        {
            id: assignmentIds[8],
            status: 'submitted',
            openedAt: new Date('2026-03-28T09:50:00.000Z'),
            startedAt: new Date('2026-03-28T10:00:00.000Z'),
            submittedAt: new Date('2026-03-28T10:10:00.000Z'),
            expiresAt: null,
        },
    ] as const;

    await storage()
        .insert(surveyAssignments)
        .values(
            assignmentRows.map((assignment, index) => ({
                ...assignment,
                surveyId,
                versionId: firstVersionId,
                accountId,
                userId,
                targetKey: `target-${index}`,
                contextKey: `analytics-${index}`,
                context: {
                    monthKey: '2026-03',
                    sourceWorkflow: 'analytics-test',
                },
                createdAt:
                    index === 8
                        ? new Date('2026-02-01T10:00:00.000Z')
                        : inPeriodCreatedAt,
            })),
        );

    const responseIds = Array.from({ length: 5 }, () => randomUUID());
    await storage()
        .insert(surveyResponses)
        .values([
            {
                id: responseIds[0],
                assignmentId: assignmentIds[8],
                surveyId,
                versionId: firstVersionId,
                accountId: null,
                userId: null,
                source: 'in_app',
                status: 'submitted',
                metadata: {},
                startedAt: null,
                submittedAt: new Date('2026-03-28T10:10:00.000Z'),
            },
            {
                id: responseIds[1],
                surveyId,
                versionId: firstVersionId,
                accountId,
                userId,
                source: 'admin_import',
                status: 'submitted',
                metadata: { campaign: 'analytics-test' },
                startedAt: null,
                submittedAt: new Date('2026-03-28T23:30:00.000Z'),
            },
            {
                id: responseIds[2],
                surveyId,
                versionId: firstVersionId,
                accountId,
                userId,
                source: 'typeform',
                status: 'submitted',
                metadata: {},
                startedAt: new Date('2026-03-30T01:00:00.000Z'),
                submittedAt: new Date('2026-03-29T22:30:00.000Z'),
            },
            {
                id: responseIds[3],
                surveyId,
                versionId: secondVersionId,
                accountId,
                userId,
                source: 'in_app',
                status: 'submitted',
                metadata: {},
                startedAt: new Date('2026-03-28T23:10:00.000Z'),
                submittedAt: new Date('2026-03-28T23:30:00.000Z'),
            },
            {
                id: responseIds[4],
                surveyId,
                versionId: secondVersionId,
                accountId,
                userId,
                source: 'admin_import',
                status: 'submitted',
                metadata: {},
                startedAt: null,
                submittedAt: new Date('2026-03-29T22:30:00.000Z'),
            },
        ]);
    await storage().execute(sql`
        update survey_responses
        set submitted_at = timestamp '2026-03-30 21:59:59.9995'
        where id = ${responseIds[4]}
    `);
    await storage()
        .insert(surveyAnswers)
        .values([
            {
                id: randomUUID(),
                responseId: responseIds[0],
                questionId: firstQuestionId,
                questionKey: 'score',
                type: 'opinion_scale',
                numericValue: 0,
            },
            {
                id: randomUUID(),
                responseId: responseIds[0],
                questionId: privateQuestionId,
                questionKey: 'private_comment',
                type: 'long_text',
                textValue: 'private comment that must not leave the repository',
            },
            {
                id: randomUUID(),
                responseId: responseIds[1],
                questionId: firstQuestionId,
                questionKey: 'score',
                type: 'opinion_scale',
                skipped: true,
            },
            {
                id: randomUUID(),
                responseId: responseIds[2],
                questionId: firstQuestionId,
                questionKey: 'score',
                type: 'opinion_scale',
                numericValue: 1,
            },
            {
                id: randomUUID(),
                responseId: responseIds[3],
                questionId: secondQuestionId,
                questionKey: 'score',
                type: 'opinion_scale',
                numericValue: 3,
            },
        ]);

    const analytics = await getSurveyAnalyticsAdmin({
        surveyId,
        assignmentCreatedFrom: new Date('2026-03-27T23:00:00.000Z'),
        assignmentCreatedBefore: new Date('2026-03-30T22:00:00.000Z'),
        responseSubmittedFrom: new Date('2026-03-27T23:00:00.000Z'),
        responseSubmittedBefore: new Date('2026-03-30T22:00:00.000Z'),
        trendInterval: 'day',
        asOf,
    });
    assert.ok(analytics);

    assert.deepEqual(
        {
            assigned: analytics.funnel.assigned,
            unopened: analytics.funnel.unopened,
            opened: analytics.funnel.opened,
            started: analytics.funnel.started,
            submitted: analytics.funnel.submitted,
            expired: analytics.funnel.expired,
            canceled: analytics.funnel.canceled,
            stateTotal: analytics.funnel.stateTotal,
            reconciles: analytics.funnel.reconciles,
        },
        {
            assigned: 8,
            unopened: 1,
            opened: 1,
            started: 1,
            submitted: 1,
            expired: 3,
            canceled: 1,
            stateTotal: 8,
            reconciles: true,
        },
    );
    assert.equal(analytics.funnel.startRate, 3 / 8);
    assert.equal(analytics.funnel.completionRate, 1 / 3);
    assert.equal(analytics.funnel.responseRate, 1 / 8);
    assert.deepEqual(analytics.responses, {
        responseCount: 5,
        linkedResponseCount: 1,
        unassignedResponseCount: 4,
        completionSampleCount: 2,
        excludedCompletionCount: 3,
        medianCompletionSeconds: 900,
    });
    assert.deepEqual(analytics.trend, [
        { bucketKey: '2026-03-28', count: 1 },
        { bucketKey: '2026-03-29', count: 2 },
        { bucketKey: '2026-03-30', count: 2 },
    ]);
    assert.equal(
        analytics.trend.reduce((total, point) => total + point.count, 0),
        analytics.responses.responseCount,
    );
    assert.deepEqual(
        analytics.questions.map((question) => ({
            versionId: question.versionId,
            versionNumber: question.versionNumber,
            title: question.title,
            responseCount: question.responseCount,
            answeredCount: question.answeredCount,
            skippedCount: question.skippedCount,
            invalidCount: question.invalidCount,
            average: question.average,
            median: question.median,
            distribution: question.distribution,
        })),
        [
            {
                versionId: secondVersionId,
                versionNumber: 2,
                title: 'Updated score',
                responseCount: 2,
                answeredCount: 1,
                skippedCount: 1,
                invalidCount: 0,
                average: 3,
                median: 3,
                distribution: [
                    { value: 1, count: 0, percentage: 0 },
                    { value: 2, count: 0, percentage: 0 },
                    { value: 3, count: 1, percentage: 1 },
                ],
            },
            {
                versionId: firstVersionId,
                versionNumber: 1,
                title: 'Original score',
                responseCount: 3,
                answeredCount: 1,
                skippedCount: 1,
                invalidCount: 1,
                average: 0,
                median: 0,
                distribution: [
                    { value: 0, count: 1, percentage: 1 },
                    { value: 2, count: 0, percentage: 0 },
                ],
            },
        ],
    );
    assert.equal(
        JSON.stringify(analytics).includes(
            'private comment that must not leave the repository',
        ),
        false,
    );

    const sourceFiltered = await getSurveyAnalyticsAdmin({
        surveyId,
        assignmentCreatedFrom: new Date('2026-03-27T23:00:00.000Z'),
        assignmentCreatedBefore: new Date('2026-03-30T22:00:00.000Z'),
        responseSubmittedFrom: new Date('2026-03-27T23:00:00.000Z'),
        responseSubmittedBefore: new Date('2026-03-30T22:00:00.000Z'),
        responseSource: 'typeform',
        trendInterval: 'day',
        asOf,
    });
    assert.ok(sourceFiltered);
    assert.equal(sourceFiltered.funnel.assigned, 8);
    assert.equal(sourceFiltered.responses.responseCount, 1);

    const contextFiltered = await getSurveyAnalyticsAdmin({
        surveyId,
        assignmentCreatedFrom: new Date('2026-03-27T23:00:00.000Z'),
        assignmentCreatedBefore: new Date('2026-03-30T22:00:00.000Z'),
        responseSubmittedFrom: new Date('2026-03-27T23:00:00.000Z'),
        responseSubmittedBefore: new Date('2026-03-30T22:00:00.000Z'),
        contextQuery: 'analytics-test',
        trendInterval: 'day',
        asOf,
    });
    assert.ok(contextFiltered);
    assert.equal(contextFiltered.funnel.assigned, 8);
    assert.equal(contextFiltered.responses.responseCount, 2);

    const monthFiltered = await getSurveyAnalyticsAdmin({
        surveyId,
        assignmentCreatedFrom: new Date('2026-03-27T23:00:00.000Z'),
        assignmentCreatedBefore: new Date('2026-03-30T22:00:00.000Z'),
        responseSubmittedFrom: new Date('2026-03-27T23:00:00.000Z'),
        responseSubmittedBefore: new Date('2026-03-30T22:00:00.000Z'),
        monthKey: '2026-03',
        trendInterval: 'day',
        asOf,
    });
    assert.ok(monthFiltered);
    assert.equal(monthFiltered.funnel.assigned, 8);
    assert.equal(monthFiltered.responses.responseCount, 1);

    const secondVersionOnly = await getSurveyAnalyticsAdmin({
        surveyId,
        versionId: secondVersionId,
        responseSubmittedFrom: new Date('2026-03-27T23:00:00.000Z'),
        responseSubmittedBefore: new Date('2026-03-30T22:00:00.000Z'),
        trendInterval: 'day',
        asOf,
    });
    assert.ok(secondVersionOnly);
    assert.equal(secondVersionOnly.funnel.assigned, 0);
    assert.equal(secondVersionOnly.responses.responseCount, 2);
    assert.equal(secondVersionOnly.questions.length, 1);
    assert.equal(secondVersionOnly.questions[0]?.versionId, secondVersionId);

    const foreignVersion = await getSurveyAnalyticsAdmin({
        surveyId,
        versionId: randomUUID(),
        trendInterval: 'month',
        asOf,
    });
    assert.equal(foreignVersion?.appliedVersionId, null);
    assert.equal(foreignVersion?.responses.responseCount, 5);
});
