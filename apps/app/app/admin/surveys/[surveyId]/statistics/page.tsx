import { SurveyAdminWorkspace } from '../../SurveyAdminWorkspace';
import type { SurveyAnalyticsSearchParams } from '../../SurveyStatisticsWorkspace';

export const dynamic = 'force-dynamic';

export default async function SurveyStatisticsPage({
    params,
    searchParams,
}: {
    params: Promise<{ surveyId: string }>;
    searchParams: Promise<SurveyAnalyticsSearchParams>;
}) {
    const { surveyId } = await params;
    return (
        <SurveyAdminWorkspace
            surveyId={surveyId}
            searchParams={searchParams}
            view="statistics"
        />
    );
}
