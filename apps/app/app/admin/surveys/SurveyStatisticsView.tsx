import type { SurveyAnalyticsAdminResult } from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Info, Warning } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { StatisticsSummaryCards } from '../../../components/admin/statistics/StatisticsSummaryCards';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import type { StatisticsPeriodKey } from '../statistics/statisticsPeriod';
import { SurveyAnalyticsFilters } from './SurveyAnalyticsFilters';
import { SurveyFunnelCard } from './SurveyFunnelCard';
import { SurveyQuestionStatisticsCard } from './SurveyQuestionStatisticsCard';
import { SurveyResponseTrendChart } from './SurveyResponseTrendChart';
import { SurveyWorkspaceShell } from './SurveyWorkspaceShell';
import {
    buildSurveyAnalyticsSummaryCards,
    formatSurveyAnalyticsDuration,
} from './surveyAnalyticsPresentation';
import type { SurveyResponseQuery } from './surveyResponseQuery';

export function SurveyStatisticsView({
    analytics,
    period,
    pickerFrom,
    pickerTo,
    maxDate,
    query,
    rangeLabel,
}: {
    analytics: SurveyAnalyticsAdminResult;
    period: StatisticsPeriodKey;
    pickerFrom: string;
    pickerTo: string;
    maxDate: string;
    query: SurveyResponseQuery;
    rangeLabel: string;
}) {
    const summaryCards = buildSurveyAnalyticsSummaryCards(analytics);
    const responseCountLabel =
        analytics.responses.responseCount.toLocaleString('hr-HR');

    return (
        <SurveyWorkspaceShell survey={analytics.survey} view="statistics">
            <Card>
                <CardHeader>
                    <CardTitle>Filtri analitike</CardTitle>
                </CardHeader>
                <CardContent>
                    <SurveyAnalyticsFilters
                        maxDate={maxDate}
                        period={period}
                        pickerFrom={pickerFrom}
                        pickerTo={pickerTo}
                        query={query}
                        rangeLabel={rangeLabel}
                        surveyId={analytics.survey.id}
                        versions={analytics.versions}
                    />
                </CardContent>
            </Card>

            <StatisticsSummaryCards cards={summaryCards} />

            {analytics.responses.unassignedResponseCount > 0 ? (
                <Alert color="info" startDecorator={<Info />}>
                    {analytics.responses.unassignedResponseCount.toLocaleString(
                        'hr-HR',
                    )}{' '}
                    filtriranih odgovora nema povezanu dodjelu. Uključeni su u
                    statistiku odgovora i pitanja, ali ne u tok dodjela.
                </Alert>
            ) : null}

            {analytics.responses.excludedCompletionCount > 0 ? (
                <Alert color="warning" startDecorator={<Warning />}>
                    {analytics.responses.excludedCompletionCount.toLocaleString(
                        'hr-HR',
                    )}{' '}
                    od{' '}
                    {analytics.responses.responseCount.toLocaleString('hr-HR')}{' '}
                    odgovora nema valjan početak prije predaje pa ne ulazi u
                    medijan trajanja. Trenutačni medijan je{' '}
                    {formatSurveyAnalyticsDuration(
                        analytics.responses.medianCompletionSeconds,
                    )}
                    .
                </Alert>
            ) : null}

            <SurveyFunnelCard analytics={analytics} />

            <Card>
                <CardHeader>
                    <CardTitle>
                        Predani odgovori kroz vrijeme ({responseCountLabel})
                    </CardTitle>
                    <Typography level="body3" className="text-muted-foreground">
                        Grupirano po zagrebačkom kalendaru ({analytics.timeZone}
                        ). Zbroj stupaca odgovara filtriranom broju predanih
                        odgovora.
                    </Typography>
                </CardHeader>
                <CardContent>
                    {analytics.responses.responseCount > 0 ? (
                        <SurveyResponseTrendChart
                            interval={analytics.trendInterval}
                            points={analytics.trend}
                        />
                    ) : (
                        <NoDataPlaceholder>
                            Nema predanih odgovora za odabrane filtre.
                        </NoDataPlaceholder>
                    )}
                </CardContent>
            </Card>

            <Stack spacing={3}>
                <Stack spacing={1}>
                    <Typography level="h4" component="h2">
                        Statistika pitanja
                    </Typography>
                    <Typography level="body3" className="text-muted-foreground">
                        Svaka kartica koristi formulaciju i ljestvicu svoje
                        verzije. Tekstualni i kontaktni odgovori nisu dio
                        agregatnog podatka.
                    </Typography>
                </Stack>
                {analytics.questions.length > 0 ? (
                    <div className="grid gap-4 xl:grid-cols-2">
                        {analytics.questions.map((question) => (
                            <SurveyQuestionStatisticsCard
                                key={question.questionId}
                                question={question}
                            />
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent noHeader>
                            <NoDataPlaceholder>
                                Nema numeričkih pitanja ili odgovora za odabrane
                                filtre.
                            </NoDataPlaceholder>
                        </CardContent>
                    </Card>
                )}
            </Stack>
        </SurveyWorkspaceShell>
    );
}
