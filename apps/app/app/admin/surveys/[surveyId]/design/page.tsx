import { SurveyAdminWorkspace } from '../../SurveyAdminWorkspace';

export const dynamic = 'force-dynamic';

export default async function SurveyDesignPage({
    params,
    searchParams,
}: {
    params: Promise<{ surveyId: string }>;
    searchParams: Promise<{
        editVersionId?: string | string[];
        previewVersionId?: string | string[];
        sourceVersionId?: string | string[];
    }>;
}) {
    const { surveyId } = await params;
    return (
        <SurveyAdminWorkspace
            searchParams={searchParams}
            surveyId={surveyId}
            view="design"
        />
    );
}
