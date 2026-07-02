import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accounts,
    accountUsers,
    buildNumericAggregates,
    createSurveyAssignments,
    createSurveyDefinition,
    createSurveySend,
    DELIVERY_SATISFACTION_SURVEY_KEY,
    getPublishedSurveyVersionByKey,
    getSurveyAssignmentRuntime,
    getSurveyQuestions,
    getSurveyResultsAdmin,
    previewSurveyAudience,
    publishSurveyVersion,
    seedDeliverySatisfactionSurveyDefinition,
    storage,
    submitSurveyResponse,
    users,
} from '@gredice/storage';
import { createTestDb } from './testDb';

async function createTestUser() {
    const userId = randomUUID();
    const accountId = randomUUID();
    const email = `survey-${userId}@example.com`;
    await storage().insert(accounts).values({ id: accountId });
    await storage().insert(users).values({
        id: userId,
        userName: email,
        displayName: 'Survey Test User',
        role: 'user',
    });
    await storage().insert(accountUsers).values({ accountId, userId });
    return { accountId, userId };
}

async function createPublishedSurvey() {
    const { surveyId, versionId } = await createSurveyDefinition({
        key: `survey_${randomUUID()}`,
        title: 'Test survey',
        description: 'Repository test survey',
        category: 'test',
        introTitle: 'Test intro',
        introDescription: 'Test intro description',
        thankYouTitle: 'Thanks',
        thankYouDescription: 'Done',
        questions: [
            {
                key: 'score',
                title: 'Score',
                type: 'opinion_scale',
                required: true,
                settings: { type: 'opinion_scale', min: 0, max: 10 },
                scoreMetadata: { internalScore: true },
            },
            {
                key: 'comment',
                title: 'Comment',
                type: 'long_text',
                required: false,
                settings: { type: 'long_text', maxLength: 200 },
            },
            {
                key: 'contact',
                title: 'Contact',
                type: 'contact_info',
                required: false,
                settings: {
                    type: 'contact_info',
                    fields: ['first_name', 'last_name', 'phone', 'email'],
                    phoneDefaultCountry: 'HR',
                },
            },
        ],
    });
    await publishSurveyVersion({ surveyId, versionId });
    return { surveyId, versionId };
}

test('delivery satisfaction seed is idempotent and skips redundant contact questions', async () => {
    createTestDb();

    const first = await seedDeliverySatisfactionSurveyDefinition({
        publish: true,
    });
    const second = await seedDeliverySatisfactionSurveyDefinition({
        publish: true,
    });

    assert.equal(first.id, second.id);
    assert.equal(second.key, DELIVERY_SATISFACTION_SURVEY_KEY);
    assert.equal(second.status, 'published');
    assert.ok(second.activeVersionId);

    const published = await getPublishedSurveyVersionByKey(
        DELIVERY_SATISFACTION_SURVEY_KEY,
    );
    assert.ok(published);

    assert.deepEqual(
        published.questions.map((question) => ({
            key: question.key,
            required: question.required,
            sortOrder: question.sortOrder,
            type: question.type,
        })),
        [
            {
                key: 'vegetable_quality',
                required: false,
                sortOrder: 1,
                type: 'opinion_scale',
            },
            {
                key: 'delivery_speed_quality',
                required: false,
                sortOrder: 2,
                type: 'opinion_scale',
            },
            {
                key: 'team_communication',
                required: false,
                sortOrder: 3,
                type: 'opinion_scale',
            },
            {
                key: 'improvement_text',
                required: false,
                sortOrder: 4,
                type: 'long_text',
            },
        ],
    );

    const scaleSettings = published.questions
        .filter((question) => question.type === 'opinion_scale')
        .map((question) => question.settings);
    assert.equal(scaleSettings.length, 3);
    assert.ok(
        scaleSettings.every(
            (settings) =>
                settings.type === 'opinion_scale' &&
                settings.min === 0 &&
                settings.max === 10,
        ),
    );
});

test('survey audiences resolve account and user targets without duplicates', async () => {
    createTestDb();

    const first = await createTestUser();
    const second = await createTestUser();
    await storage().insert(accountUsers).values({
        accountId: first.accountId,
        userId: second.userId,
    });

    const accountPreview = await previewSurveyAudience({
        type: 'accounts',
        accountIds: [first.accountId, first.accountId],
    });
    assert.equal(accountPreview.accountCount, 1);
    assert.equal(accountPreview.userCount, 2);
    assert.equal(accountPreview.targetCount, 2);

    const explicitPreview = await previewSurveyAudience({
        type: 'explicit',
        recipients: [
            { accountId: first.accountId, userId: first.userId },
            { accountId: first.accountId, userId: first.userId },
            { accountId: first.accountId, userId: 'missing-user' },
            { accountId: second.accountId },
        ],
    });
    assert.equal(explicitPreview.explicitRecipientCount, 3);
    assert.equal(explicitPreview.unmatchedRecipientCount, 1);
    assert.deepEqual(
        explicitPreview.recipients
            .map((recipient) => ({
                accountId: recipient.accountId,
                userId: recipient.userId ?? null,
            }))
            .sort((left, right) =>
                `${left.accountId}:${left.userId ?? ''}`.localeCompare(
                    `${right.accountId}:${right.userId ?? ''}`,
                ),
            ),
        [
            { accountId: first.accountId, userId: first.userId },
            { accountId: second.accountId, userId: null },
        ].sort((left, right) =>
            `${left.accountId}:${left.userId ?? ''}`.localeCompare(
                `${right.accountId}:${right.userId ?? ''}`,
            ),
        ),
    );
});

test('survey assignments are duplicate-safe by version target and context key', async () => {
    createTestDb();

    const { surveyId, versionId } = await createPublishedSurvey();
    const { accountId, userId } = await createTestUser();

    const first = await createSurveyAssignments({
        versionId,
        contextKey: `context-${randomUUID()}`,
        context: { sourceWorkflow: 'test' },
        recipients: [{ accountId, userId }],
    });
    const second = await createSurveyAssignments({
        versionId,
        contextKey: first.assignments[0]?.assignment.contextKey ?? '',
        context: { sourceWorkflow: 'test' },
        recipients: [{ accountId, userId }],
    });

    assert.equal(first.createdCount, 1);
    assert.equal(first.skippedDuplicateCount, 0);
    assert.equal(second.createdCount, 0);
    assert.equal(second.skippedDuplicateCount, 1);
    assert.equal(
        first.assignments[0]?.assignment.id,
        second.assignments[0]?.assignment.id,
    );

    const send = await createSurveySend({
        versionId,
        name: 'Manual send',
        audience: {
            type: 'explicit',
            recipients: [{ accountId }],
        },
        channelPolicy: { inApp: true, email: false },
        contextKey: `manual-${randomUUID()}`,
        createdByUserId: userId,
        createdFromAccountId: accountId,
    });

    assert.equal(send.send.surveyId, surveyId);
    assert.equal(send.createdCount, 1);
    assert.equal(send.preview.targetCount, 1);
});

test('survey submission validates answers, prevents duplicates, and builds aggregates', async () => {
    createTestDb();

    const { surveyId, versionId } = await createPublishedSurvey();
    const { accountId, userId } = await createTestUser();
    const assignmentResult = await createSurveyAssignments({
        versionId,
        contextKey: `submit-${randomUUID()}`,
        recipients: [{ accountId, userId }],
    });
    const assignment = assignmentResult.assignments[0]?.assignment;
    assert.ok(assignment);

    const invalid = await submitSurveyResponse({
        assignmentId: assignment.id,
        accountId,
        userId,
        answers: [{ questionKey: 'score', value: 11 }],
    });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.status, 'invalid');

    const submitted = await submitSurveyResponse({
        assignmentId: assignment.id,
        accountId,
        userId,
        answers: [
            { questionKey: 'score', value: 8 },
            { questionKey: 'comment', value: 'Dostava je bila brza.' },
            {
                questionKey: 'contact',
                value: { firstName: 'Ana', email: 'ana@example.com' },
            },
        ],
    });
    assert.equal(submitted.ok, true);

    const duplicate = await submitSurveyResponse({
        assignmentId: assignment.id,
        accountId,
        userId,
        answers: [{ questionKey: 'score', value: 7 }],
    });
    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.status, 'already_submitted');

    const runtime = await getSurveyAssignmentRuntime({
        assignmentId: assignment.id,
        accountId,
        userId,
    });
    assert.equal(runtime?.assignment.status, 'submitted');
    assert.ok(runtime.response);

    const results = await getSurveyResultsAdmin({ surveyId });
    assert.ok(results);
    assert.equal(results.responses.length, 1);
    assert.deepEqual(results.numericAggregates, [
        {
            questionId: (await getSurveyQuestions(versionId))[0]?.id,
            questionKey: 'score',
            title: 'Score',
            count: 1,
            unansweredCount: 0,
            average: 8,
            median: 8,
            distribution: { '8': 1 },
            scoreMetadata: { internalScore: true },
        },
    ]);
});

test('numeric aggregate helper counts skipped answers as unanswered', () => {
    const question = {
        id: 'question-score',
        key: 'score',
        type: 'opinion_scale',
        title: 'Score',
        description: null,
        sortOrder: 1,
        required: false,
        settings: { type: 'opinion_scale', min: 0, max: 10 },
        scoreMetadata: { internalScore: true },
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        versionId: 'version',
    } satisfies Awaited<ReturnType<typeof getSurveyQuestions>>[number];

    const aggregates = buildNumericAggregates(
        [question],
        [
            {
                response: {
                    id: 'response-1',
                    assignmentId: 'assignment-1',
                    surveyId: 'survey',
                    versionId: 'version',
                    accountId: 'account',
                    userId: 'user',
                    source: 'in_app',
                    status: 'submitted',
                    metadata: {},
                    importedExternalId: null,
                    startedAt: null,
                    submittedAt: new Date('2026-06-01T00:00:00.000Z'),
                    createdAt: new Date('2026-06-01T00:00:00.000Z'),
                },
                assignment: null,
                answers: [
                    {
                        id: 'answer-1',
                        responseId: 'response-1',
                        questionId: 'question-score',
                        questionKey: 'score',
                        type: 'opinion_scale',
                        numericValue: 4,
                        textValue: null,
                        contactValue: null,
                        skipped: false,
                        createdAt: new Date('2026-06-01T00:00:00.000Z'),
                    },
                ],
            },
            {
                response: {
                    id: 'response-2',
                    assignmentId: 'assignment-2',
                    surveyId: 'survey',
                    versionId: 'version',
                    accountId: 'account',
                    userId: 'user',
                    source: 'in_app',
                    status: 'submitted',
                    metadata: {},
                    importedExternalId: null,
                    startedAt: null,
                    submittedAt: new Date('2026-06-01T00:00:00.000Z'),
                    createdAt: new Date('2026-06-01T00:00:00.000Z'),
                },
                assignment: null,
                answers: [
                    {
                        id: 'answer-2',
                        responseId: 'response-2',
                        questionId: 'question-score',
                        questionKey: 'score',
                        type: 'opinion_scale',
                        numericValue: null,
                        textValue: null,
                        contactValue: null,
                        skipped: true,
                        createdAt: new Date('2026-06-01T00:00:00.000Z'),
                    },
                ],
            },
        ],
    );

    assert.deepEqual(aggregates, [
        {
            questionId: 'question-score',
            questionKey: 'score',
            title: 'Score',
            count: 1,
            unansweredCount: 1,
            average: 4,
            median: 4,
            distribution: { '4': 1 },
            scoreMetadata: { internalScore: true },
        },
    ]);
});
