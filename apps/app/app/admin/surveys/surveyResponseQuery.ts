import {
    getTimeZoneDayRange,
    isCalendarDateKey,
    type SurveyResponseFilters,
    type SurveyResponseSource,
} from '@gredice/storage';

export const surveyResponseTimeZone = 'Europe/Zagreb';

export type SurveyResponseSearchParams = {
    versionId?: string | string[];
    from?: string | string[];
    to?: string | string[];
    accountId?: string | string[];
    userId?: string | string[];
    monthKey?: string | string[];
    context?: string | string[];
    source?: string | string[];
    page?: string | string[];
};

export type SurveyResponseQuery = {
    versionId: string | null;
    from: string | null;
    to: string | null;
    accountId: string | null;
    userId: string | null;
    monthKey: string | null;
    context: string | null;
    source: SurveyResponseSource | null;
    page: number;
};

function firstValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function normalizedText(value: string | string[] | undefined) {
    return firstValue(value)?.trim() || null;
}

function normalizedDate(value: string | string[] | undefined) {
    const normalized = normalizedText(value);
    return normalized && isCalendarDateKey(normalized) ? normalized : null;
}

function normalizedMonth(value: string | string[] | undefined) {
    const normalized = normalizedText(value);
    return normalized && /^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)
        ? normalized
        : null;
}

function normalizedSource(value: string | string[] | undefined) {
    const normalized = normalizedText(value);
    switch (normalized) {
        case 'in_app':
        case 'typeform':
        case 'admin_import':
            return normalized;
        default:
            return null;
    }
}

function normalizedPage(value: string | string[] | undefined) {
    const normalized = normalizedText(value);
    if (!normalized || !/^[1-9]\d*$/.test(normalized)) return 1;
    const page = Number(normalized);
    return Number.isSafeInteger(page) ? page : 1;
}

export function parseSurveyResponseQuery(
    params: SurveyResponseSearchParams,
): SurveyResponseQuery {
    return {
        versionId: normalizedText(params.versionId),
        from: normalizedDate(params.from),
        to: normalizedDate(params.to),
        accountId: normalizedText(params.accountId),
        userId: normalizedText(params.userId),
        monthKey: normalizedMonth(params.monthKey),
        context: normalizedText(params.context),
        source: normalizedSource(params.source),
        page: normalizedPage(params.page),
    };
}

export function toSurveyResponseFilters(
    query: SurveyResponseQuery,
): SurveyResponseFilters {
    return {
        versionId: query.versionId,
        submittedFrom: query.from
            ? getTimeZoneDayRange(query.from, surveyResponseTimeZone).from
            : null,
        submittedTo: query.to
            ? getTimeZoneDayRange(query.to, surveyResponseTimeZone).to
            : null,
        accountId: query.accountId,
        userId: query.userId,
        monthKey: query.monthKey,
        contextQuery: query.context,
        source: query.source,
    };
}

export function serializeSurveyResponseQuery(
    query: SurveyResponseQuery,
): URLSearchParams {
    const params = new URLSearchParams();
    if (query.versionId) params.set('versionId', query.versionId);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    if (query.accountId) params.set('accountId', query.accountId);
    if (query.userId) params.set('userId', query.userId);
    if (query.monthKey) params.set('monthKey', query.monthKey);
    if (query.context) params.set('context', query.context);
    if (query.source) params.set('source', query.source);
    if (query.page > 1) params.set('page', query.page.toString());
    return params;
}

export function surveyResponseHref(
    pathname: string,
    query: SurveyResponseQuery,
) {
    const search = serializeSurveyResponseQuery(query).toString();
    return search ? `${pathname}?${search}` : pathname;
}

export function canonicalSurveyResponseQuery(
    query: SurveyResponseQuery,
    appliedVersionId: string | null,
    page: number = query.page,
): SurveyResponseQuery {
    return {
        ...query,
        versionId: appliedVersionId,
        page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    };
}

export function surveyResponseQueryForPage(
    query: SurveyResponseQuery,
    page: number,
): SurveyResponseQuery {
    return {
        ...query,
        page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    };
}

export function surveyResponsePaginationPages(page: number, pageCount: number) {
    return {
        previousPage: pageCount > 0 && page > 1 ? page - 1 : null,
        nextPage: pageCount > 0 && page < pageCount ? page + 1 : null,
    };
}
