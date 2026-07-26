import {
    getSurveyAdminDetails,
    getSurveyResultsAdmin,
    listSurveysAdmin,
    listSurveyTargetUsers,
} from '@gredice/storage';
import { notFound } from 'next/navigation';
import { auth } from '../../../lib/auth/auth';
import { SurveyCreateView } from './SurveyCreateView';
import { SurveyDesignView } from './SurveyDesignView';
import { SurveyIndexView } from './SurveyIndexView';
import { SurveyOverviewView } from './SurveyOverviewView';
import { SurveyResponsesView } from './SurveyResponsesView';
import { SurveySendsView } from './SurveySendsView';
import {
    firstSurveyQueryParam,
    type SurveyWorkspaceSearchParams,
} from './surveyWorkspaceQuery';
import type { SurveyWorkspaceView } from './surveyWorkspaceTypes';

export type { SurveyWorkspaceView } from './surveyWorkspaceTypes';

export async function SurveyAdminWorkspace({
    surveyId = null,
    searchParams,
    view,
}: {
    surveyId?: string | null;
    searchParams?: Promise<SurveyWorkspaceSearchParams>;
    view: SurveyWorkspaceView;
}) {
    await auth(['admin']);

    const params = (await searchParams) ?? {};

    if (view === 'index') {
        const surveys = await listSurveysAdmin();
        return <SurveyIndexView params={params} surveys={surveys} />;
    }

    if (view === 'create') {
        return <SurveyCreateView />;
    }

    if (!surveyId) {
        notFound();
    }

    if (view === 'overview') {
        const [details, surveys] = await Promise.all([
            getSurveyAdminDetails(surveyId),
            listSurveysAdmin(),
        ]);
        if (!details) {
            notFound();
        }

        return (
            <SurveyOverviewView
                details={details}
                listItem={
                    surveys.find((item) => item.survey.id === surveyId) ?? null
                }
            />
        );
    }

    if (view === 'sends') {
        const [details, targetUsers] = await Promise.all([
            getSurveyAdminDetails(surveyId),
            listSurveyTargetUsers(),
        ]);
        if (!details) {
            notFound();
        }

        return <SurveySendsView details={details} targetUsers={targetUsers} />;
    }

    const details = await getSurveyAdminDetails(surveyId);
    if (!details) {
        notFound();
    }

    if (view === 'design') {
        return <SurveyDesignView details={details} />;
    }

    if (view === 'responses') {
        const monthKey =
            firstSurveyQueryParam(params.monthKey)?.trim() || undefined;
        const results = await getSurveyResultsAdmin({
            surveyId,
            monthKey,
        });

        return (
            <SurveyResponsesView
                details={details}
                monthKey={monthKey}
                results={results}
            />
        );
    }

    notFound();
}
