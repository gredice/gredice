import { SurveyAdminWorkspace } from '../SurveyAdminWorkspace';

export const dynamic = 'force-dynamic';

export default async function SurveyOverviewPage({
    params,
}: {
    params: Promise<{ surveyId: string }>;
}) {
    const { surveyId } = await params;
    return <SurveyAdminWorkspace surveyId={surveyId} view="overview" />;
}
