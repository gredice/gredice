import { SurveyAdminWorkspace } from '../../SurveyAdminWorkspace';
import type { SurveyWorkspaceSearchParams } from '../../surveyWorkspaceQuery';

export const dynamic = 'force-dynamic';

export default async function SurveyResponsesPage({
    params,
    searchParams,
}: {
    params: Promise<{ surveyId: string }>;
    searchParams: Promise<SurveyWorkspaceSearchParams>;
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
