import { SurveyAdminWorkspace } from '../../SurveyAdminWorkspace';
import type { SurveyResponseSearchParams } from '../../surveyResponseQuery';

export const dynamic = 'force-dynamic';

export default async function SurveyResponsesPage({
    params,
    searchParams,
}: {
    params: Promise<{ surveyId: string }>;
    searchParams: Promise<SurveyResponseSearchParams>;
}) {
    const { surveyId } = await params;
    return (
        <SurveyAdminWorkspace
            searchParams={searchParams}
            surveyId={surveyId}
            view="responses"
        />
    );
}
