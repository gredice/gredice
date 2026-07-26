import assert from 'node:assert/strict';
import test from 'node:test';
import {
    canonicalSurveyResponseQuery,
    parseSurveyResponseQuery,
    serializeSurveyResponseQuery,
    surveyResponseHref,
    surveyResponseQueryForPage,
    toSurveyResponseFilters,
} from './surveyResponseQuery';

test('response query parsing uses first values and rejects invalid inputs', () => {
    assert.deepEqual(
        parseSurveyResponseQuery({
            versionId: [' version-2 ', 'version-1'],
            from: '2026-02-30',
            to: '2026-07-26',
            accountId: ' account-1 ',
            userId: ' ',
            monthKey: '2026-13',
            context: ' delivery:42 ',
            source: 'unknown',
            page: '2.5',
        }),
        {
            versionId: 'version-2',
            from: null,
            to: '2026-07-26',
            accountId: 'account-1',
            userId: null,
            monthKey: null,
            context: 'delivery:42',
            source: null,
            page: 1,
        },
    );
});

test('response query converts valid dates to inclusive Zagreb boundaries', () => {
    const filters = toSurveyResponseFilters(
        parseSurveyResponseQuery({
            from: '2026-03-29',
            to: '2026-03-29',
            monthKey: '2026-03',
            source: 'typeform',
            page: '3',
        }),
    );

    assert.equal(
        filters.submittedFrom?.toISOString(),
        '2026-03-28T23:00:00.000Z',
    );
    assert.equal(
        filters.submittedTo?.toISOString(),
        '2026-03-29T21:59:59.999Z',
    );
    assert.equal(filters.monthKey, '2026-03');
    assert.equal(filters.source, 'typeform');
});

test('response query serialization is normalized and omits page one', () => {
    const query = parseSurveyResponseQuery({
        versionId: 'version/2',
        from: '2026-07-01',
        accountId: 'account one',
        source: 'admin_import',
        page: '1',
    });

    assert.equal(
        serializeSurveyResponseQuery(query).toString(),
        'versionId=version%2F2&from=2026-07-01&accountId=account+one&source=admin_import',
    );
    assert.equal(
        surveyResponseHref('/admin/surveys/survey/responses', query),
        '/admin/surveys/survey/responses?versionId=version%2F2&from=2026-07-01&accountId=account+one&source=admin_import',
    );

    const completeQuery = parseSurveyResponseQuery({
        versionId: 'version-2',
        from: '2026-07-01',
        to: '2026-07-31',
        accountId: 'account-2',
        userId: 'user-2',
        monthKey: '2026-07',
        context: 'delivery',
        source: 'typeform',
        page: '4',
    });
    assert.equal(
        serializeSurveyResponseQuery(completeQuery).toString(),
        'versionId=version-2&from=2026-07-01&to=2026-07-31&accountId=account-2&userId=user-2&monthKey=2026-07&context=delivery&source=typeform&page=4',
    );
});

test('response navigation preserves filters, canonicalizes version, and resets pages', () => {
    const parsed = parseSurveyResponseQuery({
        versionId: 'foreign-version',
        context: 'delivery',
        page: '8',
    });
    const canonical = canonicalSurveyResponseQuery(parsed, null, 3);
    const firstPage = surveyResponseQueryForPage(canonical, 1);
    const nextPage = surveyResponseQueryForPage(canonical, 2);

    assert.equal(
        serializeSurveyResponseQuery(firstPage).toString(),
        'context=delivery',
    );
    assert.equal(
        serializeSurveyResponseQuery(nextPage).toString(),
        'context=delivery&page=2',
    );
    assert.equal(canonical.page, 3);
});
