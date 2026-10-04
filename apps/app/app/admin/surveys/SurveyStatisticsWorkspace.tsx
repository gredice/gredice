import { getSurveyAnalyticsAdmin, getSurveyById } from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Warning } from '@gredice/ui/icons';
import { notFound } from 'next/navigation';
import {
    resolveStatisticsPeriod,
    type StatisticsPeriodSearchParams,
} from '../statistics/statisticsPeriod';
import { SurveyStatisticsView } from './SurveyStatisticsView';
import { SurveyWorkspaceShell } from './SurveyWorkspaceShell';
import { resolveSurveyAnalyticsTrendInterval } from './surveyAnalyticsPresentation';
import {
    canonicalSurveyResponseQuery,
    parseSurveyResponseQuery,
    type SurveyResponseSearchParams,
    toSurveyResponseFilters,
} from './surveyResponseQuery';

export type SurveyAnalyticsSearchParams = SurveyResponseSearchParams &
    StatisticsPeriodSearchParams;

export async function SurveyStatisticsWorkspace({
    params,
    surveyId,
}: {
    params: SurveyAnalyticsSearchParams;
    surveyId: string;
}) {
    const parsedQuery = parseSurveyResponseQuery(params);
    const period = resolveStatisticsPeriod(params);
    const responseFilters = toSurveyResponseFilters(parsedQuery);
    const trendInterval = resolveSurveyAnalyticsTrendInterval({
        from: period.fromDate ? period.pickerFrom : null,
        to: period.toDate ? period.pickerTo : null,
    });
    const periodEndExclusive = period.toDate
        ? new Date(period.toDate.getTime() + 1)
        : undefined;

    let analytics: Awaited<ReturnType<typeof getSurveyAnalyticsAdmin>>;
    try {
        analytics = await getSurveyAnalyticsAdmin({
            surveyId,
            versionId: responseFilters.versionId,
            assignmentCreatedFrom: period.fromDate,
            assignmentCreatedBefore: periodEndExclusive,
            responseSubmittedFrom: period.fromDate,
            responseSubmittedBefore: periodEndExclusive,
            accountId: responseFilters.accountId,
            userId: responseFilters.userId,
            monthKey: responseFilters.monthKey,
            contextQuery: responseFilters.contextQuery,
            responseSource: responseFilters.source,
            trendInterval,
        });
    } catch (error) {
        console.error('Failed to load survey analytics.', {
            error,
            surveyId,
        });
        const survey = await getSurveyById(surveyId);
        if (!survey) {
            notFound();
        }

        return (
            <SurveyWorkspaceShell survey={survey} view="statistics">
                <Alert color="danger" startDecorator={<Warning />}>
                    Analitika ankete trenutačno nije dostupna. Pokušaj ponovno.
                </Alert>
            </SurveyWorkspaceShell>
        );
    }

    if (!analytics) {
        notFound();
    }
    const query = canonicalSurveyResponseQuery(
        {
            ...parsedQuery,
            from: period.key === 'custom' ? period.pickerFrom : null,
            to: period.key === 'custom' ? period.pickerTo : null,
            page: 1,
        },
        analytics.appliedVersionId,
        1,
    );

    return (
        <SurveyStatisticsView
            analytics={analytics}
            period={period.key}
            pickerFrom={period.pickerFrom}
            pickerTo={period.pickerTo}
            maxDate={period.maxDate}
            query={query}
            rangeLabel={period.rangeLabel}
        />
    );
}
