import {
    getSurveyResponsePageAdmin,
    type getSurveyWorkspaceAdminDetails,
} from '@gredice/storage';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { notFound } from 'next/navigation';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { SurveyResponseFilters } from './SurveyResponseFilters';
import { SurveyResponseList } from './SurveyResponseList';
import { SurveyResponsePagination } from './SurveyResponsePagination';
import { SurveyWorkspaceShell } from './SurveyWorkspaceShell';
import {
    canonicalSurveyResponseQuery,
    parseSurveyResponseQuery,
    type SurveyResponseSearchParams,
    toSurveyResponseFilters,
} from './surveyResponseQuery';

type SurveyDetails = NonNullable<
    Awaited<ReturnType<typeof getSurveyWorkspaceAdminDetails>>
>;

function numericSummary(value: number | null) {
    return value === null ? '-' : value.toFixed(2);
}

export async function SurveyResponsesWorkspace({
    details,
    params,
}: {
    details: SurveyDetails;
    params: SurveyResponseSearchParams;
}) {
    const parsedQuery = parseSurveyResponseQuery(params);
    const results = await getSurveyResponsePageAdmin({
        surveyId: details.survey.id,
        ...toSurveyResponseFilters(parsedQuery),
        page: parsedQuery.page,
    });
    if (!results) {
        notFound();
    }
    const query = canonicalSurveyResponseQuery(
        parsedQuery,
        results.appliedVersionId,
        results.page,
    );
    const versionById = new Map(
        results.versions.map((version) => [version.id, version]),
    );

    return (
        <SurveyWorkspaceShell survey={details.survey} view="responses">
            <Card>
                <CardHeader>
                    <CardTitle>Filtri odgovora</CardTitle>
                </CardHeader>
                <CardContent>
                    <SurveyResponseFilters
                        query={query}
                        surveyId={details.survey.id}
                        versions={results.versions}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Statistika filtriranih odgovora</CardTitle>
                </CardHeader>
                <CardContent>
                    {results.numericAggregates.length > 0 ? (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {results.numericAggregates.map((aggregate) => {
                                const version = versionById.get(
                                    aggregate.versionId,
                                );
                                return (
                                    <div
                                        key={aggregate.questionId}
                                        className="rounded-md border p-3"
                                    >
                                        <Row spacing={2} className="flex-wrap">
                                            <Typography semiBold>
                                                {aggregate.title}
                                            </Typography>
                                            {version ? (
                                                <Chip>
                                                    v{version.versionNumber}
                                                </Chip>
                                            ) : null}
                                        </Row>
                                        <Typography
                                            level="body2"
                                            className="mt-1 text-muted-foreground"
                                        >
                                            {aggregate.count} odgovora ·{' '}
                                            {aggregate.unansweredCount} bez
                                            vrijednosti
                                        </Typography>
                                        <Row
                                            spacing={2}
                                            className="mt-2 flex-wrap"
                                        >
                                            <Chip>
                                                Prosjek{' '}
                                                {numericSummary(
                                                    aggregate.average,
                                                )}
                                            </Chip>
                                            <Chip>
                                                Medijan{' '}
                                                {numericSummary(
                                                    aggregate.median,
                                                )}
                                            </Chip>
                                        </Row>
                                        <Typography
                                            level="body3"
                                            className="mt-2 break-words text-muted-foreground"
                                        >
                                            Distribucija:{' '}
                                            {Object.entries(
                                                aggregate.distribution,
                                            )
                                                .map(
                                                    ([value, count]) =>
                                                        `${value}: ${count}`,
                                                )
                                                .join(' · ') || '-'}
                                        </Typography>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <NoDataPlaceholder>
                            Nema numeričkih rezultata za odabrane filtre
                        </NoDataPlaceholder>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Odgovori ({results.totalCount})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Stack spacing={0}>
                        <CardOverflow>
                            <SurveyResponseList
                                query={query}
                                results={results}
                            />
                        </CardOverflow>
                        <SurveyResponsePagination
                            page={results.page}
                            pageCount={results.pageCount}
                            query={query}
                            surveyId={details.survey.id}
                            totalCount={results.totalCount}
                        />
                    </Stack>
                </CardContent>
            </Card>
        </SurveyWorkspaceShell>
    );
}
