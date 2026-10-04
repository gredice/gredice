import { SurveyResponseClient } from './SurveyResponseClient';

export async function SurveyResponse({
    params,
}: {
    params: Promise<{ assignmentId: string }>;
}) {
    const { assignmentId } = await params;

    return <SurveyResponseClient assignmentId={assignmentId} />;
}
