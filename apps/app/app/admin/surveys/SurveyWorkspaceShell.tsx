import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
    AdminPageHeader,
    AdminPageTitle,
} from '../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { KnownPages } from '../../../src/KnownPages';
import { surveyStatusLabel } from './surveyPresentation';
import type { SurveyWorkspaceView } from './surveyWorkspaceTypes';

type SurveyWorkspaceHeader = {
    id: string;
    key: string;
    status: string;
    title: string;
};

const sectionLabels = {
    design: 'Dizajn',
    overview: 'Pregled',
    responses: 'Odgovori',
    sends: 'Slanja',
    statistics: 'Statistika',
} as const;

function surveyWorkspaceTabs(surveyId: string) {
    return [
        {
            href: KnownPages.Survey(surveyId),
            label: sectionLabels.overview,
            view: 'overview',
        },
        {
            href: KnownPages.SurveyDesign(surveyId),
            label: sectionLabels.design,
            view: 'design',
        },
        {
            href: KnownPages.SurveySends(surveyId),
            label: sectionLabels.sends,
            view: 'sends',
        },
        {
            href: KnownPages.SurveyResponses(surveyId),
            label: sectionLabels.responses,
            view: 'responses',
        },
        {
            href: KnownPages.SurveyStatistics(surveyId),
            label: sectionLabels.statistics,
            view: 'statistics',
        },
    ] satisfies Array<{
        href: string;
        label: string;
        view: SurveyWorkspaceView;
    }>;
}

function documentTitle(
    survey: SurveyWorkspaceHeader | null,
    view: SurveyWorkspaceView,
) {
    if (!survey) {
        return view === 'create' ? 'Nova anketa' : 'Ankete';
    }

    if (view === 'overview') {
        return survey.title;
    }

    if (
        view === 'design' ||
        view === 'responses' ||
        view === 'sends' ||
        view === 'statistics'
    ) {
        return `${survey.title} · ${sectionLabels[view]}`;
    }

    return survey.title;
}

function workspaceBreadcrumbs(
    survey: SurveyWorkspaceHeader | null,
    view: SurveyWorkspaceView,
) {
    const items: Array<{ href?: string; label: ReactNode }> = [
        {
            href: KnownPages.Surveys,
            label: <AdminBreadcrumbLevelSelector />,
        },
    ];

    if (view === 'create') {
        items.push({ label: 'Nova anketa' });
        return items;
    }

    if (!survey) {
        return items;
    }

    items.push({
        href: view === 'overview' ? undefined : KnownPages.Survey(survey.id),
        label: survey.title,
    });

    if (
        view === 'design' ||
        view === 'responses' ||
        view === 'sends' ||
        view === 'statistics'
    ) {
        items.push({ label: sectionLabels[view] });
    }

    return items;
}

export function SurveyWorkspaceShell({
    actions,
    children,
    survey = null,
    view,
}: {
    actions?: ReactNode;
    children: ReactNode;
    survey?: SurveyWorkspaceHeader | null;
    view: SurveyWorkspaceView;
}) {
    const title = documentTitle(survey, view);
    const heading = survey?.title ?? title;

    return (
        <Stack spacing={5}>
            <AdminPageTitle title={title} />
            <AdminPageHeader
                actions={actions}
                breadcrumbs={
                    <Breadcrumbs items={workspaceBreadcrumbs(survey, view)} />
                }
                heading={heading}
            />

            <Stack spacing={1}>
                <Typography level="h4" component="h1">
                    {heading}
                </Typography>
                <Typography level="body2" className="text-muted-foreground">
                    {survey
                        ? `${survey.key} · ${surveyStatusLabel(survey.status)}`
                        : 'Definicije, verzije, slanja i rezultati za ankete unutar Gredica.'}
                </Typography>
            </Stack>

            {survey ? (
                <nav
                    aria-label="Sekcije ankete"
                    className="flex gap-1 overflow-x-auto border-b"
                >
                    {surveyWorkspaceTabs(survey.id).map((tab) => (
                        <Link
                            key={tab.view}
                            href={tab.href}
                            aria-current={
                                tab.view === view ? 'page' : undefined
                            }
                            className={
                                tab.view === view
                                    ? 'whitespace-nowrap border-b-2 border-primary px-3 py-2 text-sm font-semibold text-primary'
                                    : 'whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground'
                            }
                        >
                            {tab.label}
                        </Link>
                    ))}
                </nav>
            ) : null}

            {children}
        </Stack>
    );
}
