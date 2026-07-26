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
import { Stack } from '@gredice/ui/Stack';
import { notFound } from 'next/navigation';
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
        includeNumericAggregates: false,
    });
    if (!results) {
        notFound();
    }
    const query = canonicalSurveyResponseQuery(
        parsedQuery,
        results.appliedVersionId,
        results.page,
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
