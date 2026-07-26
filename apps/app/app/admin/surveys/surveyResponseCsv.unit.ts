import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type {
    SelectSurvey,
    SelectSurveyAssignment,
    SelectSurveyQuestion,
    SelectSurveyResponse,
    SelectSurveyVersion,
    SurveyResponseExportPreparation,
    SurveyResponseExportRow,
} from '@gredice/storage';
import {
    createSurveyResponseCsvColumns,
    neutralizeSpreadsheetFormula,
    serializeSurveyResponseCsvRows,
    surveyResponseCsvCell,
    surveyResponseCsvDocumentPrefix,
    surveyResponseCsvFilename,
    surveyResponseExportBatchSizeForColumnCount,
    surveyResponseExportDateKey,
} from './surveyResponseCsv';
import { createSurveyResponseExportHandler } from './surveyResponseCsvRoute';

const now = new Date('2026-07-26T10:20:30.000Z');

function survey(): SelectSurvey {
    return {
        id: 'survey-1',
        key: 'zadovoljstvo_dostavom',
        title: 'Zadovoljstvo dostavom',
        description: null,
        category: 'delivery',
        status: 'published',
        activeVersionId: 'version-2',
        metadata: {},
        createdByUserId: null,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
    };
}

function version(id: string, versionNumber: number): SelectSurveyVersion {
    return {
        id,
        surveyId: 'survey-1',
        versionNumber,
        status: 'published',
        title: `Version ${versionNumber}`,
        description: null,
        introTitle: null,
        introDescription: null,
        thankYouTitle: null,
        thankYouDescription: null,
        metadata: {},
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
        archivedAt: null,
    };
}

function scoreQuestion(): SelectSurveyQuestion {
    return {
        id: 'question-score',
        versionId: 'version-1',
        key: 'score',
        type: 'opinion_scale',
        title: 'Ocjena',
        description: null,
        sortOrder: 1,
        required: true,
        settings: { type: 'opinion_scale', min: 0, max: 10 },
        scoreMetadata: {},
        createdAt: now,
    };
}

function commentQuestion(): SelectSurveyQuestion {
    return {
        id: 'question-comment',
        versionId: 'version-1',
        key: 'comment',
        type: 'long_text',
        title: 'Što možemo poboljšati?',
        description: null,
        sortOrder: 2,
        required: false,
        settings: { type: 'long_text', maxLength: 1_000 },
        scoreMetadata: {},
        createdAt: now,
    };
}

function contactQuestion(): SelectSurveyQuestion {
    return {
        id: 'question-contact',
        versionId: 'version-2',
        key: 'contact',
        type: 'contact_info',
        title: 'Kontakt',
        description: null,
        sortOrder: 1,
        required: false,
        settings: {
            type: 'contact_info',
            fields: ['email', 'first_name'],
        },
        scoreMetadata: {},
        createdAt: now,
    };
}

function response(id: string): SelectSurveyResponse {
    return {
        id,
        assignmentId: `assignment-${id}`,
        surveyId: 'survey-1',
        versionId: 'version-1',
        accountId: 'account-1',
        userId: 'user-1',
        source: 'in_app',
        status: 'submitted',
        metadata: { campaign: 'ljeto' },
        importedExternalId: null,
        startedAt: new Date('2026-07-26T10:15:00.000Z'),
        submittedAt: now,
        createdAt: now,
    };
}

function assignment(id: string): SelectSurveyAssignment {
    return {
        id: `assignment-${id}`,
        surveyId: 'survey-1',
        versionId: 'version-1',
        sendId: 'send-1',
        accountId: 'account-1',
        userId: 'user-1',
        targetKey: 'account:account-1:user:user-1',
        contextKey: 'delivery:2026-07',
        status: 'submitted',
        context: { monthKey: '2026-07', sourceWorkflow: 'delivery' },
        expiresAt: null,
        openedAt: now,
        startedAt: now,
        submittedAt: now,
        canceledAt: null,
        createdAt: now,
        updatedAt: now,
    };
}

function exportRow(
    id: string,
    questions: {
        score: SelectSurveyQuestion;
        comment: SelectSurveyQuestion;
    },
): SurveyResponseExportRow {
    return {
        response: response(id),
        assignment: assignment(id),
        version: version('version-1', 1),
        accountId: 'account-1',
        user: {
            id: 'user-1',
            userName: 'ana@example.com',
            displayName: 'Ana Župan',
        },
        answers: [
            {
                question: questions.score,
                answer: {
                    id: `answer-score-${id}`,
                    responseId: id,
                    questionId: questions.score.id,
                    questionKey: questions.score.key,
                    type: 'opinion_scale',
                    numericValue: 0,
                    textValue: null,
                    contactValue: null,
                    skipped: false,
                    createdAt: now,
                },
            },
            {
                question: questions.comment,
                answer: {
                    id: `answer-comment-${id}`,
                    responseId: id,
                    questionId: questions.comment.id,
                    questionKey: questions.comment.key,
                    type: 'long_text',
                    numericValue: null,
                    textValue: 'Žuto, "sunce"\n=HYPERLINK("bad")',
                    contactValue: null,
                    skipped: false,
                    createdAt: now,
                },
            },
        ],
    };
}

function readyPreparation({
    questions = [],
    responseIds = [],
    versions = [version('version-1', 1)],
}: {
    questions?: SelectSurveyQuestion[];
    responseIds?: string[];
    versions?: SelectSurveyVersion[];
} = {}): Extract<SurveyResponseExportPreparation, { status: 'ready' }> {
    return {
        status: 'ready',
        survey: survey(),
        versions,
        questions,
        responseIds,
        appliedVersionId: null,
    };
}

test('CSV cells quote Croatian text, quotes and newlines while neutralizing spreadsheet formulas', () => {
    assert.equal(
        surveyResponseCsvCell('Žuto, "sunce"\nred'),
        '"Žuto, ""sunce""\nred"',
    );
    for (const dangerous of [
        '=SUM(A1:A2)',
        '  +cmd',
        '\ufeff\u200b@evil',
        '\tcontrol',
        '\nformula',
        '-1',
    ]) {
        assert.equal(neutralizeSpreadsheetFormula(dangerous), `'${dangerous}`);
        assert.ok(surveyResponseCsvCell(dangerous).startsWith('"\''));
    }
    assert.equal(
        neutralizeSpreadsheetFormula(' običan tekst'),
        ' običan tekst',
    );
});

test('CSV columns are stable, identify questions, and always split all contact fields', () => {
    const versions = [version('version-2', 2), version('version-1', 1)];
    const questions = [contactQuestion(), scoreQuestion()];
    const columns = createSurveyResponseCsvColumns(versions, questions);
    const reversed = createSurveyResponseCsvColumns(
        [...versions].reverse(),
        [...questions].reverse(),
    );

    assert.deepEqual(columns, reversed);
    assert.deepEqual(
        columns.slice(-5).map((column) => column.header),
        [
            'v1 | id:question-score | key:score | Ocjena',
            'v2 | id:question-contact | key:contact | Kontakt | first_name',
            'v2 | id:question-contact | key:contact | Kontakt | last_name',
            'v2 | id:question-contact | key:contact | Kontakt | phone',
            'v2 | id:question-contact | key:contact | Kontakt | email',
        ],
    );

    const delimiterQuestions = [
        {
            ...scoreQuestion(),
            id: 'question | one',
            key: 'score | shared',
            title: 'Title | shared',
        },
        {
            ...scoreQuestion(),
            id: 'question | two',
            key: 'score | shared',
            title: 'Title | shared',
            sortOrder: 2,
        },
    ];
    const delimiterHeaders = createSurveyResponseCsvColumns(
        [version('version-1', 1)],
        delimiterQuestions,
    )
        .slice(-2)
        .map((column) => column.header);
    assert.equal(new Set(delimiterHeaders).size, 2);
    assert.match(delimiterHeaders[0] ?? '', /id:question%20%7C%20one/);
});

test('CSV preserves all contact values even when configured fields or settings mismatch', () => {
    const contact = {
        ...contactQuestion(),
        settings: { type: 'long_text', maxLength: 500 },
    } satisfies SelectSurveyQuestion;
    const base = exportRow('response-contact', {
        score: scoreQuestion(),
        comment: commentQuestion(),
    });
    const row: SurveyResponseExportRow = {
        ...base,
        response: {
            ...base.response,
            versionId: contact.versionId,
        },
        assignment: base.assignment
            ? {
                  ...base.assignment,
                  versionId: contact.versionId,
              }
            : null,
        version: version('version-2', 2),
        answers: [
            {
                question: contact,
                answer: {
                    id: 'answer-contact',
                    responseId: base.response.id,
                    questionId: contact.id,
                    questionKey: contact.key,
                    type: 'contact_info',
                    numericValue: null,
                    textValue: null,
                    contactValue: {
                        firstName: 'Ana',
                        lastName: 'Župan',
                        phone: '+385 91 000 0000',
                        email: 'ana@example.com',
                    },
                    skipped: false,
                    createdAt: now,
                },
            },
        ],
    };
    const columns = createSurveyResponseCsvColumns(
        [version('version-2', 2)],
        [contact],
    );
    const csv = serializeSurveyResponseCsvRows(columns, [row]);

    assert.deepEqual(
        columns.slice(-4).map((column) => column.header.split(' | ').at(-1)),
        ['first_name', 'last_name', 'phone', 'email'],
    );
    for (const value of [
        'Ana',
        'Župan',
        '+385 91 000 0000',
        'ana@example.com',
    ]) {
        assert.ok(csv.includes(surveyResponseCsvCell(value)));
    }
});

test('CSV document has one BOM, CRLF rows, stable metadata and one row per response', () => {
    const score = scoreQuestion();
    const comment = commentQuestion();
    const columns = createSurveyResponseCsvColumns(
        [version('version-1', 1)],
        [comment, score],
    );
    const csv =
        surveyResponseCsvDocumentPrefix(columns) +
        serializeSurveyResponseCsvRows(columns, [
            exportRow('response-1', { score, comment }),
        ]);

    assert.ok(csv.startsWith('\ufeff"response_id","assignment_id","send_id"'));
    assert.equal(csv.match(/\ufeff/g)?.length, 1);
    assert.ok(csv.includes('\r\n'));
    assert.ok(csv.includes('"Ana Župan"'));
    assert.ok(csv.includes('"send-1"'));
    assert.ok(csv.includes('"0"'));
    assert.ok(csv.includes('"Žuto, ""sunce""\n=HYPERLINK(""bad"")"'));
    assert.equal(csv.split('\r\n').length, 3);
    assert.equal(
        surveyResponseExportDateKey(new Date('2026-07-26T22:30:00.000Z')),
        '2026-07-27',
    );
    assert.equal(
        surveyResponseCsvFilename(
            'Žetva / Ljeto 2026',
            new Date('2026-07-26T22:30:00.000Z'),
        ),
        'survey-responses-zetva-ljeto-2026-2026-07-27.csv',
    );
});

test('response export uses a plain download anchor that cannot prefetch the private route', async () => {
    const source = await readFile(
        new URL('./SurveyResponseFilters.tsx', import.meta.url),
        'utf8',
    );
    const exportAnchor = source.match(
        /<a[\s\S]*?Izvezi filtrirane odgovore \(CSV\)[\s\S]*?<\/a>/,
    )?.[0];
    assert.ok(exportAnchor);
    assert.match(exportAnchor, /\bdownload\b/);
    assert.match(exportAnchor, /href=\{exportHref\}/);
    assert.doesNotMatch(source, /<Button[^>]*\bdownload\b/);
});

test('export handler authorizes before reading any survey data', async () => {
    let prepareCalled = false;
    const handler = createSurveyResponseExportHandler({
        authorize: async () => {
            throw new Error('Forbidden');
        },
        prepareExport: async () => {
            prepareCalled = true;
            return readyPreparation();
        },
        loadBatch: async () => [],
    });

    await assert.rejects(
        handler(new Request('https://example.test/export'), {
            params: Promise.resolve({ surveyId: 'survey-1' }),
        }),
        /Forbidden/,
    );
    assert.equal(prepareCalled, false);
});

test('export handler validates filters and streams bounded batches with private headers', async () => {
    const score = scoreQuestion();
    const comment = commentQuestion();
    const rows = new Map([
        ['response-2', exportRow('response-2', { score, comment })],
        ['response-1', exportRow('response-1', { score, comment })],
    ]);
    const preparedRequests: unknown[] = [];
    const loadedBatches: string[][] = [];
    const handler = createSurveyResponseExportHandler({
        authorize: async () => undefined,
        prepareExport: async (request) => {
            preparedRequests.push(request);
            return readyPreparation({
                questions: [score, comment],
                responseIds: ['response-2', 'response-1'],
            });
        },
        loadBatch: async ({ responseIds }) => {
            loadedBatches.push(responseIds);
            return responseIds.flatMap((responseId) => {
                const row = rows.get(responseId);
                return row ? [row] : [];
            });
        },
        batchSize: 2,
        now: () => new Date('2026-07-26T20:00:00.000Z'),
    });

    const exportResponse = await handler(
        new Request(
            'https://example.test/export?versionId=version-1&from=2026-07-26&to=2026-07-26&accountId=account-1&userId=user-1&monthKey=2026-07&context=delivery&source=in_app&page=99',
        ),
        { params: Promise.resolve({ surveyId: 'survey-1' }) },
    );
    const reader = exportResponse.body?.getReader();
    assert.ok(reader);
    const chunks: Uint8Array[] = [];
    while (true) {
        const result = await reader.read();
        if (result.done) break;
        chunks.push(result.value);
    }
    const byteLength = chunks.reduce(
        (total, chunk) => total + chunk.byteLength,
        0,
    );
    const bytes = new Uint8Array(byteLength);
    let byteOffset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, byteOffset);
        byteOffset += chunk.byteLength;
    }
    const csv = new TextDecoder().decode(bytes);

    assert.equal(exportResponse.status, 200);
    assert.equal(
        exportResponse.headers.get('cache-control'),
        'private, no-store, max-age=0',
    );
    assert.equal(
        exportResponse.headers.get('content-disposition'),
        'attachment; filename="survey-responses-zadovoljstvo_dostavom-2026-07-26.csv"',
    );
    assert.equal(
        exportResponse.headers.get('x-content-type-options'),
        'nosniff',
    );
    assert.deepEqual(Array.from(bytes.slice(0, 3)), [0xef, 0xbb, 0xbf]);
    assert.ok(csv.includes('response-2'));
    assert.ok(csv.indexOf('response-2') < csv.indexOf('response-1'));
    assert.equal(chunks.length, 3);
    assert.deepEqual(loadedBatches, [['response-2', 'response-1']]);
    assert.deepEqual(preparedRequests, [
        {
            surveyId: 'survey-1',
            versionId: 'version-1',
            submittedFrom: new Date('2026-07-25T22:00:00.000Z'),
            submittedTo: new Date('2026-07-26T21:59:59.999Z'),
            accountId: 'account-1',
            userId: 'user-1',
            monthKey: '2026-07',
            contextQuery: 'delivery',
            source: 'in_app',
            maximumResponseCount: 50_000,
        },
    ]);
});

test('high-column exports reduce hydration batches to a bounded cell budget', async () => {
    const questions = Array.from({ length: 979 }, (_, index) => ({
        ...scoreQuestion(),
        id: `question-${index + 1}`,
        key: `score_${index + 1}`,
        sortOrder: index + 1,
    }));
    const responseIds = Array.from(
        { length: 21 },
        (_, index) => `response-${index + 1}`,
    );
    const loadedBatches: string[][] = [];
    const handler = createSurveyResponseExportHandler({
        authorize: async () => undefined,
        prepareExport: async () => readyPreparation({ questions, responseIds }),
        loadBatch: async ({ responseIds: batchResponseIds }) => {
            loadedBatches.push(batchResponseIds);
            return [];
        },
        now: () => now,
    });

    const response = await handler(new Request('https://example.test/export'), {
        params: Promise.resolve({ surveyId: 'survey-1' }),
    });
    await response.text();

    assert.equal(response.status, 200);
    assert.equal(surveyResponseExportBatchSizeForColumnCount(1_000), 20);
    assert.deepEqual(
        loadedBatches.map((batch) => batch.length),
        [20, 1],
    );
});

test('export handler rejects response, column, and total-cell limits instead of truncating', async () => {
    let loadCalled = false;
    const responseLimitHandler = createSurveyResponseExportHandler({
        authorize: async () => undefined,
        prepareExport: async () => ({
            status: 'too_large',
            reason: 'responses',
        }),
        loadBatch: async () => {
            loadCalled = true;
            return [];
        },
        maximumResponseCount: 1,
    });
    const responseLimit = await responseLimitHandler(
        new Request('https://example.test/export'),
        { params: Promise.resolve({ surveyId: 'survey-1' }) },
    );
    assert.equal(responseLimit.status, 413);
    assert.match(await responseLimit.text(), /1 response limit/);

    const columnLimitHandler = createSurveyResponseExportHandler({
        authorize: async () => undefined,
        prepareExport: async () =>
            readyPreparation({ questions: [scoreQuestion()] }),
        loadBatch: async () => {
            loadCalled = true;
            return [];
        },
        maximumColumnCount: 20,
    });
    const columnLimit = await columnLimitHandler(
        new Request('https://example.test/export'),
        { params: Promise.resolve({ surveyId: 'survey-1' }) },
    );
    assert.equal(columnLimit.status, 413);
    assert.match(await columnLimit.text(), /20 column limit/);

    const cellLimitHandler = createSurveyResponseExportHandler({
        authorize: async () => undefined,
        prepareExport: async () =>
            readyPreparation({
                questions: [scoreQuestion()],
                responseIds: ['response-1', 'response-2'],
            }),
        loadBatch: async () => {
            loadCalled = true;
            return [];
        },
        maximumCellCount: 30,
    });
    const cellLimit = await cellLimitHandler(
        new Request('https://example.test/export'),
        { params: Promise.resolve({ surveyId: 'survey-1' }) },
    );
    assert.equal(cellLimit.status, 413);
    assert.match(await cellLimit.text(), /30 cell limit/);
    assert.equal(loadCalled, false);
});

test('export handler returns a private 404 for missing surveys', async () => {
    const handler = createSurveyResponseExportHandler({
        authorize: async () => undefined,
        prepareExport: async () => null,
        loadBatch: async () => [],
    });
    const response = await handler(new Request('https://example.test/export'), {
        params: Promise.resolve({ surveyId: 'missing' }),
    });

    assert.equal(response.status, 404);
    assert.equal(
        response.headers.get('cache-control'),
        'private, no-store, max-age=0',
    );
});
