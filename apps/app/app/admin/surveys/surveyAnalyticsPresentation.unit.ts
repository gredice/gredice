import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SurveyAnalyticsAdminResult } from '@gredice/storage';
import {
    buildSurveyAnalyticsSummaryCards,
    formatSurveyAnalyticsDuration,
    formatSurveyAnalyticsRate,
    formatSurveyTrendBucket,
    resolveSurveyAnalyticsTrendInterval,
} from './surveyAnalyticsPresentation';

describe('survey analytics presentation', () => {
    it('selects stable intervals at the inclusive range thresholds', () => {
        assert.equal(
            resolveSurveyAnalyticsTrendInterval({
                from: '2026-01-01',
                to: '2026-02-14',
            }),
            'day',
        );
        assert.equal(
            resolveSurveyAnalyticsTrendInterval({
                from: '2026-01-01',
                to: '2026-02-15',
            }),
            'week',
        );
        assert.equal(
            resolveSurveyAnalyticsTrendInterval({
                from: '2026-01-01',
                to: '2026-06-29',
            }),
            'week',
        );
        assert.equal(
            resolveSurveyAnalyticsTrendInterval({
                from: '2026-01-01',
                to: '2026-06-30',
            }),
            'month',
        );
        assert.equal(resolveSurveyAnalyticsTrendInterval({}), 'month');
    });

    it('formats empty rates and completion durations without invalid values', () => {
        assert.equal(formatSurveyAnalyticsRate(null), '—');
        assert.equal(formatSurveyAnalyticsRate(Number.NaN), '—');
        assert.equal(formatSurveyAnalyticsRate(0.125), '12,5 %');
        assert.equal(formatSurveyAnalyticsDuration(null), '—');
        assert.equal(formatSurveyAnalyticsDuration(59.4), '59 s');
        assert.equal(formatSurveyAnalyticsDuration(90), '1 min 30 s');
        assert.equal(formatSurveyAnalyticsDuration(3_900), '1 h 5 min');
        assert.equal(formatSurveyAnalyticsDuration(-1), '—');
    });

    it('labels trend buckets and states rate denominators explicitly', () => {
        const analytics = {
            survey: {
                id: 'survey',
                key: 'delivery',
                title: 'Delivery survey',
                description: null,
                category: 'delivery',
                status: 'published',
                activeVersionId: 'version',
                metadata: {},
                createdByUserId: null,
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                updatedAt: new Date('2026-01-01T00:00:00.000Z'),
                archivedAt: null,
            },
            versions: [],
            appliedVersionId: null,
            asOf: new Date('2026-07-26T12:00:00.000Z'),
            timeZone: 'Europe/Zagreb',
            trendInterval: 'day',
            funnel: {
                assigned: 8,
                unopened: 2,
                opened: 1,
                started: 2,
                submitted: 2,
                expired: 1,
                canceled: 0,
                reachedOpened: 5,
                reachedStarted: 4,
                reachedSubmitted: 2,
                stateTotal: 8,
                reconciles: true,
                openRate: 5 / 8,
                startRate: 4 / 8,
                completionRate: 2 / 4,
                responseRate: 2 / 8,
            },
            responses: {
                responseCount: 3,
                linkedResponseCount: 2,
                unassignedResponseCount: 1,
                completionSampleCount: 2,
                excludedCompletionCount: 1,
                medianCompletionSeconds: 90,
            },
            trend: [],
            questions: [],
        } satisfies SurveyAnalyticsAdminResult;

        const cards = buildSurveyAnalyticsSummaryCards(analytics);
        assert.deepEqual(
            cards.find((card) => card.label === 'Stopa dovršetka'),
            {
                label: 'Stopa dovršetka',
                value: '50,0 %',
                detail: '2 od 4 započetih',
            },
        );
        assert.deepEqual(
            cards.find((card) => card.label === 'Stopa odgovora'),
            {
                label: 'Stopa odgovora',
                value: '25,0 %',
                detail: '2 od 8 dodjela',
            },
        );
        assert.equal(
            formatSurveyTrendBucket('2026-07-20', 'week'),
            'Tjedan od 20. 07. 2026.',
        );
    });
});
