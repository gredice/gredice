import type { Route } from 'next';
import { KnownPages } from '../../../src/KnownPages';

export type SurveyWorkspaceSearchParams = {
    category?: string | string[];
    monthKey?: string | string[];
    q?: string | string[];
    status?: string | string[];
};

export type LegacySurveyWorkspaceSearchParams = SurveyWorkspaceSearchParams & {
    surveyId?: string | string[];
};

type SurveyWorkspaceListItem = {
    survey: {
        category: string;
        description: string | null;
        key: string;
        status: string;
        title: string;
    };
};

export function firstSurveyQueryParam(
    value: string | string[] | undefined,
): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

function normalizeFilter(value: string | string[] | undefined) {
    return firstSurveyQueryParam(value)?.trim().toLocaleLowerCase('hr') ?? '';
}

export function normalizeSurveyWorkspaceFilters(
    params: SurveyWorkspaceSearchParams,
) {
    return {
        category: normalizeFilter(params.category),
        query: normalizeFilter(params.q),
        status: normalizeFilter(params.status),
    };
}

export function filterSurveyWorkspaceItems<T extends SurveyWorkspaceListItem>(
    items: readonly T[],
    params: SurveyWorkspaceSearchParams,
): T[] {
    const { category, query, status } = normalizeSurveyWorkspaceFilters(params);

    return items.filter((item) => {
        if (status && item.survey.status.toLocaleLowerCase('hr') !== status) {
            return false;
        }
        if (
            category &&
            item.survey.category.toLocaleLowerCase('hr') !== category
        ) {
            return false;
        }
        if (!query) return true;

        return [
            item.survey.title,
            item.survey.key,
            item.survey.description ?? '',
        ].some((value) => value.toLocaleLowerCase('hr').includes(query));
    });
}

export function buildLegacySurveyWorkspaceRedirect(
    params: LegacySurveyWorkspaceSearchParams,
): Route | null {
    const surveyId = firstSurveyQueryParam(params.surveyId)?.trim();
    if (!surveyId) return null;

    const monthKey = firstSurveyQueryParam(params.monthKey)?.trim();
    if (!monthKey) return KnownPages.Survey(surveyId);

    return KnownPages.SurveyResponsesForMonth(surveyId, monthKey);
}
