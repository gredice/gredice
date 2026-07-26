import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { includesSelectedPath } from '../../../components/admin/navigation/adminNavigationPath';
import { communicationAdminPageHrefs } from '../../../components/admin/navigation/adminPages';
import { resolveAdminRouteTitle } from '../../../components/admin/navigation/adminRouteTitle';
import { buildDashboardQuickActionOptions } from '../../../src/dashboardQuickActions';
import { KnownPages } from '../../../src/KnownPages';
import {
    buildLegacySurveyWorkspaceRedirect,
    filterSurveyWorkspaceItems,
    firstSurveyQueryParam,
    normalizeSurveyWorkspaceFilters,
} from './surveyWorkspaceQuery';

const surveys = [
    {
        survey: {
            category: 'delivery',
            description: 'Kratka anketa nakon dostave',
            key: 'delivery-satisfaction',
            status: 'published',
            title: 'Zadovoljstvo dostavom',
        },
    },
    {
        survey: {
            category: 'product',
            description: null,
            key: 'new-feature',
            status: 'draft',
            title: 'Nova mogućnost',
        },
    },
];

describe('survey workspace query', () => {
    it('uses the first scalar query value and normalizes filters', () => {
        assert.equal(firstSurveyQueryParam([' first ', 'second']), ' first ');
        assert.deepEqual(
            normalizeSurveyWorkspaceFilters({
                category: ' Delivery ',
                q: [' DOSTAVOM ', 'ignored'],
                status: ' PUBLISHED ',
            }),
            {
                category: 'delivery',
                query: 'dostavom',
                status: 'published',
            },
        );
    });

    it('searches copy and combines category and status filters', () => {
        assert.deepEqual(
            filterSurveyWorkspaceItems(surveys, {
                category: 'DELIVERY',
                q: 'dostave',
                status: 'published',
            }),
            [surveys[0]],
        );
        assert.deepEqual(
            filterSurveyWorkspaceItems(surveys, { q: 'new-feature' }),
            [surveys[1]],
        );
        assert.deepEqual(
            filterSurveyWorkspaceItems(surveys, {
                category: 'delivery',
                status: 'draft',
            }),
            [],
        );
    });

    it('redirects legacy survey links without losing the survey or month', () => {
        assert.equal(buildLegacySurveyWorkspaceRedirect({}), null);
        assert.equal(
            buildLegacySurveyWorkspaceRedirect({
                surveyId: [' survey-id ', 'ignored'],
            }),
            KnownPages.Survey('survey-id'),
        );
        assert.equal(
            buildLegacySurveyWorkspaceRedirect({
                monthKey: ' 2026-06 ',
                surveyId: 'survey-id',
            }),
            `${KnownPages.SurveyResponses('survey-id')}?monthKey=2026-06`,
        );
    });
});

describe('survey admin navigation', () => {
    it('resolves focused route titles', () => {
        assert.equal(
            resolveAdminRouteTitle(KnownPages.SurveyCreate, undefined),
            'Nova anketa',
        );
        assert.equal(
            resolveAdminRouteTitle(KnownPages.Survey('survey-id'), undefined),
            'Anketa survey-id',
        );
        assert.equal(
            resolveAdminRouteTitle(
                KnownPages.SurveyDesign('survey-id'),
                undefined,
            ),
            'Dizajn ankete',
        );
        assert.equal(
            resolveAdminRouteTitle(
                KnownPages.SurveySends('survey-id'),
                undefined,
            ),
            'Slanja ankete',
        );
        assert.equal(
            resolveAdminRouteTitle(
                KnownPages.SurveyResponses('survey-id'),
                undefined,
            ),
            'Odgovori ankete',
        );
        assert.equal(
            resolveAdminRouteTitle(
                KnownPages.SurveyStatistics('survey-id'),
                undefined,
            ),
            'Statistika ankete',
        );
    });

    it('offers surveys as a configurable dashboard quick action', () => {
        const surveyAction = buildDashboardQuickActionOptions([]).find(
            (option) => option.id === 'builtin:surveys',
        );

        assert.deepEqual(surveyAction, {
            description: 'Otvara stranicu „Ankete”.',
            href: KnownPages.Surveys,
            id: 'builtin:surveys',
            label: 'Ankete',
        });
    });

    it('keeps communication navigation open on survey descendants', () => {
        assert.ok(communicationAdminPageHrefs.includes(KnownPages.Surveys));
        assert.equal(
            includesSelectedPath(KnownPages.SurveyResponses('survey-id'), [
                ...communicationAdminPageHrefs,
            ]),
            true,
        );
        assert.equal(
            includesSelectedPath(KnownPages.SurveyStatistics('survey-id'), [
                ...communicationAdminPageHrefs,
            ]),
            true,
        );
    });
});
