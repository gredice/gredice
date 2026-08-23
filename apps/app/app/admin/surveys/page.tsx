import { redirect } from 'next/navigation';
import { SurveyAdminWorkspace } from './SurveyAdminWorkspace';
import {
    buildLegacySurveyWorkspaceRedirect,
    type LegacySurveyWorkspaceSearchParams,
} from './surveyWorkspaceQuery';

export const dynamic = 'force-dynamic';

export default async function SurveysPage({
    searchParams,
}: {
    searchParams: Promise<LegacySurveyWorkspaceSearchParams>;
}) {
    const params = await searchParams;
    const legacyRedirect = buildLegacySurveyWorkspaceRedirect(params);
    if (legacyRedirect) {
        redirect(legacyRedirect);
    }

    return (
        <SurveyAdminWorkspace
            searchParams={Promise.resolve(params)}
            view="index"
        />
    );
}
