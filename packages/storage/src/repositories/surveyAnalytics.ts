import { addCalendarDays, getTimeZoneDateKey } from '../helpers/timezoneUtils';
import type {
    SelectSurveyQuestion,
    SelectSurveyVersion,
} from '../schema/surveysSchema';

export const surveyAnalyticsTimeZone = 'Europe/Zagreb';

export type SurveyAnalyticsTrendInterval = 'day' | 'week' | 'month';

export type SurveyAnalyticsTrendPoint = {
    bucketKey: string;
    count: number;
};

export type SurveyAssignmentFunnelCounts = {
    assigned: number;
    unopened: number;
    opened: number;
    started: number;
    submitted: number;
    expired: number;
    canceled: number;
    reachedOpened: number;
    reachedStarted: number;
    reachedSubmitted: number;
};

export type SurveyAssignmentFunnel = SurveyAssignmentFunnelCounts & {
    stateTotal: number;
    reconciles: boolean;
    openRate: number | null;
    startRate: number | null;
    completionRate: number | null;
    responseRate: number | null;
};

export type SurveyNumericAnswerAggregateRow = {
    versionId: string;
    questionId: string;
    numericValue: number | null;
    skipped: boolean;
    count: number;
};

export type SurveyNumericDistributionPoint = {
    value: number;
    count: number;
    percentage: number;
};

export type SurveyNumericQuestionStatistic = {
    versionId: string;
    versionNumber: number;
    versionTitle: string;
    questionId: string;
    questionKey: string;
    title: string;
    sortOrder: number;
    minimum: number;
    maximum: number;
    responseCount: number;
    answeredCount: number;
    skippedCount: number;
    invalidCount: number;
    average: number | null;
    median: number | null;
    distribution: SurveyNumericDistributionPoint[];
};

export function surveyAnalyticsRate(numerator: number, denominator: number) {
    return denominator > 0 ? numerator / denominator : null;
}

export function buildSurveyAssignmentFunnel(
    counts: SurveyAssignmentFunnelCounts,
): SurveyAssignmentFunnel {
    const stateTotal =
        counts.unopened +
        counts.opened +
        counts.started +
        counts.submitted +
        counts.expired +
        counts.canceled;

    return {
        ...counts,
        stateTotal,
        reconciles: stateTotal === counts.assigned,
        openRate: surveyAnalyticsRate(counts.reachedOpened, counts.assigned),
        startRate: surveyAnalyticsRate(counts.reachedStarted, counts.assigned),
        completionRate: surveyAnalyticsRate(
            counts.reachedSubmitted,
            counts.reachedStarted,
        ),
        responseRate: surveyAnalyticsRate(
            counts.reachedSubmitted,
            counts.assigned,
        ),
    };
}

function weightedMedian(
    rows: Array<{ count: number; value: number }>,
    totalCount: number,
) {
    if (totalCount === 0) return null;

    const sorted = [...rows].sort((left, right) => left.value - right.value);
    const valueAtRank = (rank: number) => {
        let seen = 0;
        for (const row of sorted) {
            seen += row.count;
            if (seen >= rank) return row.value;
        }
        return null;
    };
    const left = valueAtRank(Math.ceil(totalCount / 2));
    const right = valueAtRank(Math.floor(totalCount / 2) + 1);

    return left === null || right === null ? null : (left + right) / 2;
}

export function buildSurveyNumericQuestionStatistics({
    answerRows,
    questions,
    responseCountByVersion,
    versions,
}: {
    answerRows: SurveyNumericAnswerAggregateRow[];
    questions: SelectSurveyQuestion[];
    responseCountByVersion: ReadonlyMap<string, number>;
    versions: SelectSurveyVersion[];
}): SurveyNumericQuestionStatistic[] {
    const versionById = new Map(
        versions.map((version) => [version.id, version]),
    );
    const answersByVersionAndQuestion = new Map<
        string,
        SurveyNumericAnswerAggregateRow[]
    >();

    for (const row of answerRows) {
        const key = `${row.versionId}:${row.questionId}`;
        const existing = answersByVersionAndQuestion.get(key) ?? [];
        existing.push(row);
        answersByVersionAndQuestion.set(key, existing);
    }

    return questions
        .flatMap((question) => {
            if (
                question.type !== 'opinion_scale' ||
                question.settings.type !== 'opinion_scale'
            ) {
                return [];
            }

            const version = versionById.get(question.versionId);
            if (!version) return [];

            const minimum = question.settings.min;
            const maximum = question.settings.max;
            const step = question.settings.step ?? 1;
            if (
                !Number.isInteger(minimum) ||
                !Number.isInteger(maximum) ||
                minimum > maximum ||
                maximum - minimum > 100 ||
                !Number.isInteger(step) ||
                step < 1 ||
                step > maximum - minimum ||
                (maximum - minimum) % step !== 0
            ) {
                return [];
            }
            const responseCount =
                responseCountByVersion.get(question.versionId) ?? 0;
            const validRows: Array<{ count: number; value: number }> = [];
            let presentAnswerCount = 0;
            let skippedOrEmptyCount = 0;
            let invalidCount = 0;

            const answerKey = `${question.versionId}:${question.id}`;
            for (const row of answersByVersionAndQuestion.get(answerKey) ??
                []) {
                presentAnswerCount += row.count;
                if (row.skipped || row.numericValue === null) {
                    skippedOrEmptyCount += row.count;
                    continue;
                }
                if (
                    !Number.isFinite(row.numericValue) ||
                    row.numericValue < minimum ||
                    row.numericValue > maximum ||
                    (row.numericValue - minimum) % step !== 0
                ) {
                    invalidCount += row.count;
                    continue;
                }
                validRows.push({
                    count: row.count,
                    value: row.numericValue,
                });
            }

            const answeredCount = validRows.reduce(
                (total, row) => total + row.count,
                0,
            );
            const missingCount = Math.max(
                0,
                responseCount - presentAnswerCount,
            );
            const skippedCount = skippedOrEmptyCount + missingCount;
            const sum = validRows.reduce(
                (total, row) => total + row.value * row.count,
                0,
            );
            const countByValue = new Map<number, number>();
            for (const row of validRows) {
                countByValue.set(
                    row.value,
                    (countByValue.get(row.value) ?? 0) + row.count,
                );
            }
            const distribution = Array.from(
                { length: (maximum - minimum) / step + 1 },
                (_, index) => {
                    const value = minimum + index * step;
                    const count = countByValue.get(value) ?? 0;
                    return {
                        value,
                        count,
                        percentage:
                            surveyAnalyticsRate(count, answeredCount) ?? 0,
                    };
                },
            );

            return [
                {
                    versionId: question.versionId,
                    versionNumber: version.versionNumber,
                    versionTitle: version.title,
                    questionId: question.id,
                    questionKey: question.key,
                    title: question.title,
                    sortOrder: question.sortOrder,
                    minimum,
                    maximum,
                    responseCount,
                    answeredCount,
                    skippedCount,
                    invalidCount,
                    average: answeredCount > 0 ? sum / answeredCount : null,
                    median: weightedMedian(validRows, answeredCount),
                    distribution,
                },
            ];
        })
        .sort((left, right) => {
            const versionDifference = right.versionNumber - left.versionNumber;
            if (versionDifference !== 0) return versionDifference;
            const orderDifference = left.sortOrder - right.sortOrder;
            return orderDifference !== 0
                ? orderDifference
                : left.questionId.localeCompare(right.questionId);
        });
}

function startOfWeek(dateKey: string) {
    const weekday = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
    return addCalendarDays(dateKey, -((weekday + 6) % 7));
}

function startOfMonth(dateKey: string) {
    return `${dateKey.slice(0, 7)}-01`;
}

function bucketStart(dateKey: string, interval: SurveyAnalyticsTrendInterval) {
    if (interval === 'week') return startOfWeek(dateKey);
    if (interval === 'month') return startOfMonth(dateKey);
    return dateKey;
}

function nextBucket(dateKey: string, interval: SurveyAnalyticsTrendInterval) {
    if (interval === 'day') return addCalendarDays(dateKey, 1);
    if (interval === 'week') return addCalendarDays(dateKey, 7);

    const date = new Date(`${dateKey}T00:00:00.000Z`);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
        .toISOString()
        .slice(0, 10);
}

export function fillSurveyAnalyticsTrend({
    from,
    interval,
    rows,
    to,
}: {
    from?: Date | null;
    interval: SurveyAnalyticsTrendInterval;
    rows: SurveyAnalyticsTrendPoint[];
    to?: Date | null;
}) {
    if (rows.length === 0 && (!from || !to)) return [];

    const countByBucket = new Map(
        rows.map((row) => [row.bucketKey, row.count]),
    );
    const sortedKeys = [...countByBucket.keys()].sort();
    const fromKey = from
        ? bucketStart(
              getTimeZoneDateKey(from, surveyAnalyticsTimeZone),
              interval,
          )
        : sortedKeys[0];
    const toKey = to
        ? bucketStart(getTimeZoneDateKey(to, surveyAnalyticsTimeZone), interval)
        : sortedKeys.at(-1);

    if (!fromKey || !toKey || fromKey > toKey) return [];

    const filled: SurveyAnalyticsTrendPoint[] = [];
    for (
        let bucketKey = fromKey;
        bucketKey <= toKey;
        bucketKey = nextBucket(bucketKey, interval)
    ) {
        filled.push({
            bucketKey,
            count: countByBucket.get(bucketKey) ?? 0,
        });
    }
    return filled;
}
