import {
    getSurveyWorkspaceAdminDetails,
    listSurveysAdmin,
    listSurveyTargetUsers,
} from '@gredice/storage';
import { notFound } from 'next/navigation';
import { auth } from '../../../lib/auth/auth';
import { SurveyCreateView } from './SurveyCreateView';
import { SurveyDesignView } from './SurveyDesignView';
import { SurveyIndexView } from './SurveyIndexView';
import { SurveyOverviewView } from './SurveyOverviewView';
import { SurveyResponsesWorkspace } from './SurveyResponsesWorkspace';
import { SurveySendsView } from './SurveySendsView';
import type { SurveyResponseSearchParams } from './surveyResponseQuery';
import type { SurveyWorkspaceSearchParams } from './surveyWorkspaceQuery';
import type { SurveyWorkspaceView } from './surveyWorkspaceTypes';

export type { SurveyWorkspaceView } from './surveyWorkspaceTypes';

export async function SurveyAdminWorkspace({
    surveyId = null,
    searchParams,
    view,
}: {
    surveyId?: string | null;
    searchParams?: Promise<
        SurveyWorkspaceSearchParams & SurveyResponseSearchParams
    >;
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
            getSurveyWorkspaceAdminDetails(surveyId),
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
            getSurveyWorkspaceAdminDetails(surveyId),
            listSurveyTargetUsers(),
        ]);
        if (!details) {
            notFound();
        }

        return <SurveySendsView details={details} targetUsers={targetUsers} />;
    }

    const details = await getSurveyWorkspaceAdminDetails(surveyId);
    if (!details) {
        notFound();
    }

    if (view === 'design') {
        const editVersionId =
            firstSurveyQueryParam(params.editVersionId)?.trim() || null;
        const previewVersionId =
            firstSurveyQueryParam(params.previewVersionId)?.trim() || null;
        const sourceVersionId =
            firstSurveyQueryParam(params.sourceVersionId)?.trim() || null;
        const findGroup = (versionId: string | null) =>
            versionId
                ? (details.questionGroups.find(
                      (group) => group.version.id === versionId,
                  ) ?? null)
                : null;
        const editGroup = findGroup(editVersionId);
        const previewGroup = findGroup(previewVersionId);
        const sourceGroup = findGroup(sourceVersionId);
        const selectedModeCount = [
            editVersionId,
            previewVersionId,
            sourceVersionId,
        ].filter(Boolean).length;
        if (
            selectedModeCount > 1 ||
            (editVersionId && !editGroup) ||
            (previewVersionId && !previewGroup) ||
            (sourceVersionId && !sourceGroup) ||
            (editGroup && editGroup.version.status !== 'draft')
        ) {
            notFound();
        }
        return (
            <SurveyDesignView
                details={details}
                editGroup={editGroup}
                previewGroup={previewGroup}
                sourceGroup={sourceGroup}
            />
        );
    }

    if (view === 'responses') {
        return <SurveyResponsesWorkspace details={details} params={params} />;
    }

    notFound();
}
