import 'server-only';
import {
    and,
    asc,
    desc,
    eq,
    gte,
    inArray,
    isNotNull,
    isNull,
    lt,
    lte,
    or,
    sql,
} from 'drizzle-orm';
import {
    type SelectSurvey,
    type SelectSurveyVersion,
    surveyAnswers,
    surveyAssignments,
    surveyQuestions,
    surveyResponses,
    surveys,
    surveyVersions,
} from '../schema';
import { storage } from '../storage';
import {
    buildSurveyAssignmentFunnel,
    buildSurveyNumericQuestionStatistics,
    fillSurveyAnalyticsTrend,
    type SurveyAnalyticsTrendInterval,
    type SurveyAnalyticsTrendPoint,
    surveyAnalyticsTimeZone,
} from './surveyAnalytics';
import type {
    SurveyResponseFilters,
    SurveyResponseSource,
} from './surveysRepo';

export type SurveyAnalyticsAdminRequest = {
    surveyId: string;
    versionId?: string | null;
    assignmentCreatedFrom?: Date | null;
    assignmentCreatedBefore?: Date | null;
    responseSubmittedFrom?: Date | null;
    responseSubmittedBefore?: Date | null;
    accountId?: string | null;
    userId?: string | null;
    monthKey?: string | null;
    contextQuery?: string | null;
    responseSource?: SurveyResponseSource | null;
    trendInterval: SurveyAnalyticsTrendInterval;
    asOf?: Date;
};

export type SurveyAnalyticsResponseSummary = {
    responseCount: number;
    linkedResponseCount: number;
    unassignedResponseCount: number;
    completionSampleCount: number;
    excludedCompletionCount: number;
    medianCompletionSeconds: number | null;
};

export type SurveyAnalyticsAdminResult = {
    survey: SelectSurvey;
    versions: SelectSurveyVersion[];
    appliedVersionId: string | null;
    asOf: Date;
    timeZone: typeof surveyAnalyticsTimeZone;
    trendInterval: SurveyAnalyticsTrendInterval;
    funnel: ReturnType<typeof buildSurveyAssignmentFunnel>;
    responses: SurveyAnalyticsResponseSummary;
    trend: SurveyAnalyticsTrendPoint[];
    questions: ReturnType<typeof buildSurveyNumericQuestionStatistics>;
};

type SurveyAnalyticsResponseFilters = Omit<
    SurveyResponseFilters,
    'submittedTo'
> & {
    submittedBefore?: Date | null;
};

function escapeSurveyContextSearch(value: string) {
    return value
        .replaceAll('\\', '\\\\')
        .replaceAll('%', '\\%')
        .replaceAll('_', '\\_');
}

function normalizedFilterText(value: string | null | undefined) {
    return value?.trim() || null;
}

function assignmentWhere({
    filters,
    surveyId,
    versionIds,
}: {
    filters: SurveyAnalyticsAdminRequest;
    surveyId: string;
    versionIds: string[];
}) {
    const accountId = normalizedFilterText(filters.accountId);
    const userId = normalizedFilterText(filters.userId);
    const monthKey = normalizedFilterText(filters.monthKey);
    const contextQuery = normalizedFilterText(filters.contextQuery);
    const contextPattern = contextQuery
        ? `%${escapeSurveyContextSearch(contextQuery)}%`
        : null;
    const contextEscapeCharacter = '\\';

    return and(
        eq(surveyAssignments.surveyId, surveyId),
        inArray(surveyAssignments.versionId, versionIds),
        filters.assignmentCreatedFrom
            ? gte(surveyAssignments.createdAt, filters.assignmentCreatedFrom)
            : undefined,
        filters.assignmentCreatedBefore
            ? lt(surveyAssignments.createdAt, filters.assignmentCreatedBefore)
            : undefined,
        accountId ? eq(surveyAssignments.accountId, accountId) : undefined,
        userId ? eq(surveyAssignments.userId, userId) : undefined,
        monthKey
            ? sql`${surveyAssignments.context}->>'monthKey' = ${monthKey}`
            : undefined,
        contextPattern
            ? or(
                  sql`${surveyAssignments.contextKey} ilike ${contextPattern} escape ${contextEscapeCharacter}`,
                  sql`${surveyAssignments.context}::text ilike ${contextPattern} escape ${contextEscapeCharacter}`,
              )
            : undefined,
    );
}

function resolvedResponseAccountId() {
    return sql<
        string | null
    >`coalesce(${surveyResponses.accountId}, ${surveyAssignments.accountId})`;
}

function resolvedResponseUserId() {
    return sql<
        string | null
    >`coalesce(${surveyResponses.userId}, ${surveyAssignments.userId})`;
}

function responseWhere({
    filters,
    surveyId,
    versionIds,
}: {
    filters: SurveyAnalyticsResponseFilters;
    surveyId: string;
    versionIds: string[];
}) {
    const accountId = normalizedFilterText(filters.accountId);
    const userId = normalizedFilterText(filters.userId);
    const monthKey = normalizedFilterText(filters.monthKey);
    const contextQuery = normalizedFilterText(filters.contextQuery);
    const contextPattern = contextQuery
        ? `%${escapeSurveyContextSearch(contextQuery)}%`
        : null;
    const contextEscapeCharacter = '\\';

    return and(
        eq(surveyResponses.surveyId, surveyId),
        eq(surveyResponses.status, 'submitted'),
        inArray(surveyResponses.versionId, versionIds),
        filters.submittedFrom
            ? gte(surveyResponses.submittedAt, filters.submittedFrom)
            : undefined,
        filters.submittedBefore
            ? lt(surveyResponses.submittedAt, filters.submittedBefore)
            : undefined,
        accountId ? eq(resolvedResponseAccountId(), accountId) : undefined,
        userId ? eq(resolvedResponseUserId(), userId) : undefined,
        filters.source ? eq(surveyResponses.source, filters.source) : undefined,
        monthKey
            ? sql`${surveyAssignments.context}->>'monthKey' = ${monthKey}`
            : undefined,
        contextPattern
            ? or(
                  sql`${surveyAssignments.contextKey} ilike ${contextPattern} escape ${contextEscapeCharacter}`,
                  sql`${surveyAssignments.context}::text ilike ${contextPattern} escape ${contextEscapeCharacter}`,
                  sql`${surveyResponses.metadata}::text ilike ${contextPattern} escape ${contextEscapeCharacter}`,
              )
            : undefined,
    );
}

function trendBucketExpression(interval: SurveyAnalyticsTrendInterval) {
    const localSubmittedAt = sql`((${surveyResponses.submittedAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Zagreb')`;

    if (interval === 'day') {
        return sql`date_trunc('day', ${localSubmittedAt})`;
    }
    if (interval === 'week') {
        return sql`date_trunc('week', ${localSubmittedAt})`;
    }
    return sql`date_trunc('month', ${localSubmittedAt})`;
}

function zeroResponseSummary(): SurveyAnalyticsResponseSummary {
    return {
        responseCount: 0,
        linkedResponseCount: 0,
        unassignedResponseCount: 0,
        completionSampleCount: 0,
        excludedCompletionCount: 0,
        medianCompletionSeconds: null,
    };
}

const zeroFunnelCounts = {
    assigned: 0,
    unopened: 0,
    opened: 0,
    started: 0,
    submitted: 0,
    expired: 0,
    canceled: 0,
    reachedOpened: 0,
    reachedStarted: 0,
    reachedSubmitted: 0,
} as const;

export async function getSurveyAnalyticsAdmin({
    asOf = new Date(),
    ...filters
}: SurveyAnalyticsAdminRequest): Promise<SurveyAnalyticsAdminResult | null> {
    const survey = await storage().query.surveys.findFirst({
        where: eq(surveys.id, filters.surveyId),
    });
    if (!survey) return null;

    const versions = await storage().query.surveyVersions.findMany({
        where: eq(surveyVersions.surveyId, filters.surveyId),
        orderBy: desc(surveyVersions.versionNumber),
    });
    const requestedVersionId = normalizedFilterText(filters.versionId);
    const appliedVersionId =
        requestedVersionId &&
        versions.some((version) => version.id === requestedVersionId)
            ? requestedVersionId
            : null;
    const selectedVersionIds = appliedVersionId
        ? [appliedVersionId]
        : versions.map((version) => version.id);

    if (selectedVersionIds.length === 0) {
        return {
            survey,
            versions,
            appliedVersionId,
            asOf,
            timeZone: surveyAnalyticsTimeZone,
            trendInterval: filters.trendInterval,
            funnel: buildSurveyAssignmentFunnel(zeroFunnelCounts),
            responses: zeroResponseSummary(),
            trend: [],
            questions: [],
        };
    }

    const numericQuestions = await storage().query.surveyQuestions.findMany({
        where: and(
            inArray(surveyQuestions.versionId, selectedVersionIds),
            eq(surveyQuestions.type, 'opinion_scale'),
        ),
        orderBy: [
            asc(surveyQuestions.versionId),
            asc(surveyQuestions.sortOrder),
        ],
    });
    const numericQuestionIds = numericQuestions.map((question) => question.id);
    const assignmentCohort = assignmentWhere({
        filters: { ...filters, asOf },
        surveyId: filters.surveyId,
        versionIds: selectedVersionIds,
    });
    const responseFilters: SurveyAnalyticsResponseFilters = {
        versionId: appliedVersionId,
        submittedFrom: filters.responseSubmittedFrom,
        submittedBefore: filters.responseSubmittedBefore,
        accountId: filters.accountId,
        userId: filters.userId,
        monthKey: filters.monthKey,
        contextQuery: filters.contextQuery,
        source: filters.responseSource,
    };
    const responseCohort = responseWhere({
        filters: responseFilters,
        surveyId: filters.surveyId,
        versionIds: selectedVersionIds,
    });
    const effectiveOverdue = sql`(
        ${inArray(surveyAssignments.status, ['pending', 'started'])}
        and ${isNotNull(surveyAssignments.expiresAt)}
        and ${lte(surveyAssignments.expiresAt, asOf)}
    )`;
    const activeAssignment = sql`not ${effectiveOverdue}`;
    const effectiveExpired = sql`(
        ${eq(surveyAssignments.status, 'expired')}
        or ${effectiveOverdue}
    )`;
    const reachedOpened = sql`(
        ${isNotNull(surveyAssignments.openedAt)}
        or ${isNotNull(surveyAssignments.startedAt)}
        or ${isNotNull(surveyAssignments.submittedAt)}
        or ${inArray(surveyAssignments.status, ['started', 'submitted'])}
    )`;
    const reachedStarted = sql`(
        ${isNotNull(surveyAssignments.startedAt)}
        or ${isNotNull(surveyAssignments.submittedAt)}
        or ${inArray(surveyAssignments.status, ['started', 'submitted'])}
    )`;
    const reachedSubmitted = sql`(
        ${isNotNull(surveyAssignments.submittedAt)}
        or ${eq(surveyAssignments.status, 'submitted')}
    )`;
    const effectiveStartedAt = sql<Date | null>`coalesce(${surveyResponses.startedAt}, ${surveyAssignments.startedAt})`;
    const validCompletionDuration = sql`${effectiveStartedAt} is not null and ${surveyResponses.submittedAt} >= ${effectiveStartedAt}`;
    const trendBucket = trendBucketExpression(filters.trendInterval);

    const [
        funnelRows,
        responseSummaryRows,
        trendRows,
        responseCountRows,
        answerRows,
    ] = await Promise.all([
        storage()
            .select({
                assigned: sql<number>`count(*)::int`,
                unopened: sql<number>`count(*) filter (
                    where ${eq(surveyAssignments.status, 'pending')}
                    and ${activeAssignment}
                    and ${isNull(surveyAssignments.openedAt)}
                )::int`,
                opened: sql<number>`count(*) filter (
                    where ${eq(surveyAssignments.status, 'pending')}
                    and ${activeAssignment}
                    and ${isNotNull(surveyAssignments.openedAt)}
                )::int`,
                started: sql<number>`count(*) filter (
                    where ${eq(surveyAssignments.status, 'started')}
                    and ${activeAssignment}
                )::int`,
                submitted: sql<number>`count(*) filter (
                    where ${eq(surveyAssignments.status, 'submitted')}
                )::int`,
                expired: sql<number>`count(*) filter (
                    where ${effectiveExpired}
                )::int`,
                canceled: sql<number>`count(*) filter (
                    where ${eq(surveyAssignments.status, 'canceled')}
                )::int`,
                reachedOpened: sql<number>`count(*) filter (
                    where ${reachedOpened}
                )::int`,
                reachedStarted: sql<number>`count(*) filter (
                    where ${reachedStarted}
                )::int`,
                reachedSubmitted: sql<number>`count(*) filter (
                    where ${reachedSubmitted}
                )::int`,
            })
            .from(surveyAssignments)
            .where(assignmentCohort),
        storage()
            .select({
                responseCount: sql<number>`count(*)::int`,
                linkedResponseCount: sql<number>`count(*) filter (
                    where ${isNotNull(surveyAssignments.id)}
                )::int`,
                completionSampleCount: sql<number>`count(*) filter (
                    where ${validCompletionDuration}
                )::int`,
                medianCompletionSeconds: sql<number | null>`(
                    percentile_cont(0.5) within group (
                        order by extract(
                            epoch from (
                                ${surveyResponses.submittedAt} - ${effectiveStartedAt}
                            )
                        )
                    ) filter (where ${validCompletionDuration})
                )::double precision`,
            })
            .from(surveyResponses)
            .leftJoin(
                surveyAssignments,
                and(
                    eq(surveyAssignments.id, surveyResponses.assignmentId),
                    eq(surveyAssignments.surveyId, surveyResponses.surveyId),
                    eq(surveyAssignments.versionId, surveyResponses.versionId),
                ),
            )
            .where(responseCohort),
        storage()
            .select({
                bucketKey: sql<string>`to_char(${trendBucket}, 'YYYY-MM-DD')`,
                count: sql<number>`count(*)::int`,
            })
            .from(surveyResponses)
            .leftJoin(
                surveyAssignments,
                and(
                    eq(surveyAssignments.id, surveyResponses.assignmentId),
                    eq(surveyAssignments.surveyId, surveyResponses.surveyId),
                    eq(surveyAssignments.versionId, surveyResponses.versionId),
                ),
            )
            .where(responseCohort)
            .groupBy(trendBucket)
            .orderBy(trendBucket),
        storage()
            .select({
                versionId: surveyResponses.versionId,
                count: sql<number>`count(*)::int`,
            })
            .from(surveyResponses)
            .leftJoin(
                surveyAssignments,
                and(
                    eq(surveyAssignments.id, surveyResponses.assignmentId),
                    eq(surveyAssignments.surveyId, surveyResponses.surveyId),
                    eq(surveyAssignments.versionId, surveyResponses.versionId),
                ),
            )
            .where(responseCohort)
            .groupBy(surveyResponses.versionId),
        numericQuestionIds.length > 0
            ? storage()
                  .select({
                      versionId: surveyResponses.versionId,
                      questionId: surveyAnswers.questionId,
                      numericValue: surveyAnswers.numericValue,
                      skipped: surveyAnswers.skipped,
                      count: sql<number>`count(*)::int`,
                  })
                  .from(surveyResponses)
                  .leftJoin(
                      surveyAssignments,
                      and(
                          eq(
                              surveyAssignments.id,
                              surveyResponses.assignmentId,
                          ),
                          eq(
                              surveyAssignments.surveyId,
                              surveyResponses.surveyId,
                          ),
                          eq(
                              surveyAssignments.versionId,
                              surveyResponses.versionId,
                          ),
                      ),
                  )
                  .innerJoin(
                      surveyAnswers,
                      eq(surveyAnswers.responseId, surveyResponses.id),
                  )
                  .innerJoin(
                      surveyQuestions,
                      and(
                          eq(surveyQuestions.id, surveyAnswers.questionId),
                          eq(
                              surveyQuestions.versionId,
                              surveyResponses.versionId,
                          ),
                      ),
                  )
                  .where(
                      and(
                          responseCohort,
                          inArray(surveyAnswers.questionId, numericQuestionIds),
                      ),
                  )
                  .groupBy(
                      surveyResponses.versionId,
                      surveyAnswers.questionId,
                      surveyAnswers.numericValue,
                      surveyAnswers.skipped,
                  )
            : [],
    ]);

    const funnelCounts = funnelRows[0] ?? zeroFunnelCounts;
    const responseSummary = responseSummaryRows[0] ?? zeroResponseSummary();
    const responses: SurveyAnalyticsResponseSummary = {
        ...responseSummary,
        unassignedResponseCount:
            responseSummary.responseCount - responseSummary.linkedResponseCount,
        excludedCompletionCount:
            responseSummary.responseCount -
            responseSummary.completionSampleCount,
    };
    const responseCountByVersion = new Map(
        responseCountRows.map((row) => [row.versionId, row.count]),
    );

    return {
        survey,
        versions,
        appliedVersionId,
        asOf,
        timeZone: surveyAnalyticsTimeZone,
        trendInterval: filters.trendInterval,
        funnel: buildSurveyAssignmentFunnel(funnelCounts),
        responses,
        trend: fillSurveyAnalyticsTrend({
            from: filters.responseSubmittedFrom,
            to: filters.responseSubmittedBefore
                ? new Date(filters.responseSubmittedBefore.getTime() - 1)
                : null,
            interval: filters.trendInterval,
            rows: trendRows,
        }),
        questions: buildSurveyNumericQuestionStatistics({
            answerRows,
            questions: numericQuestions,
            responseCountByVersion,
            versions,
        }),
    };
}
