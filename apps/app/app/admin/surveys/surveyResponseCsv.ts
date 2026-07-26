import type {
    SelectSurveyQuestion,
    SelectSurveyVersion,
    SurveyResponseExportRow,
} from '@gredice/storage';

export const surveyResponseExportMaximumResponseCount = 50_000;
export const surveyResponseExportMaximumColumnCount = 2_000;
export const surveyResponseExportMaximumCellCount = 2_000_000;
export const surveyResponseExportBatchSize = 500;
export const surveyResponseExportMaximumCellsPerBatch = 20_000;

type FixedColumnKey =
    | 'response_id'
    | 'assignment_id'
    | 'send_id'
    | 'survey_id'
    | 'version_id'
    | 'version_number'
    | 'version_title'
    | 'source'
    | 'status'
    | 'submitted_at'
    | 'started_at'
    | 'created_at'
    | 'account_id'
    | 'user_id'
    | 'user_name'
    | 'user_display_name'
    | 'context_key'
    | 'context_month_key'
    | 'context_json'
    | 'response_metadata_json'
    | 'imported_external_id';

type SurveyContactField = 'first_name' | 'last_name' | 'phone' | 'email';

export type SurveyResponseCsvColumn =
    | {
          kind: 'fixed';
          key: FixedColumnKey;
          header: string;
      }
    | {
          kind: 'answer';
          questionId: string;
          contactField: SurveyContactField | null;
          header: string;
      };

const fixedColumns: SurveyResponseCsvColumn[] = [
    { kind: 'fixed', key: 'response_id', header: 'response_id' },
    { kind: 'fixed', key: 'assignment_id', header: 'assignment_id' },
    { kind: 'fixed', key: 'send_id', header: 'send_id' },
    { kind: 'fixed', key: 'survey_id', header: 'survey_id' },
    { kind: 'fixed', key: 'version_id', header: 'version_id' },
    { kind: 'fixed', key: 'version_number', header: 'version_number' },
    { kind: 'fixed', key: 'version_title', header: 'version_title' },
    { kind: 'fixed', key: 'source', header: 'source' },
    { kind: 'fixed', key: 'status', header: 'status' },
    { kind: 'fixed', key: 'submitted_at', header: 'submitted_at' },
    { kind: 'fixed', key: 'started_at', header: 'started_at' },
    { kind: 'fixed', key: 'created_at', header: 'created_at' },
    { kind: 'fixed', key: 'account_id', header: 'account_id' },
    { kind: 'fixed', key: 'user_id', header: 'user_id' },
    { kind: 'fixed', key: 'user_name', header: 'user_name' },
    {
        kind: 'fixed',
        key: 'user_display_name',
        header: 'user_display_name',
    },
    { kind: 'fixed', key: 'context_key', header: 'context_key' },
    {
        kind: 'fixed',
        key: 'context_month_key',
        header: 'context_month_key',
    },
    { kind: 'fixed', key: 'context_json', header: 'context_json' },
    {
        kind: 'fixed',
        key: 'response_metadata_json',
        header: 'response_metadata_json',
    },
    {
        kind: 'fixed',
        key: 'imported_external_id',
        header: 'imported_external_id',
    },
];

const contactFieldOrder: SurveyContactField[] = [
    'first_name',
    'last_name',
    'phone',
    'email',
];

function sortedQuestions(
    versions: SelectSurveyVersion[],
    questions: SelectSurveyQuestion[],
) {
    const versionNumberById = new Map(
        versions.map((version) => [version.id, version.versionNumber]),
    );
    return [...questions].sort((left, right) => {
        const versionDifference =
            (versionNumberById.get(left.versionId) ?? 0) -
            (versionNumberById.get(right.versionId) ?? 0);
        if (versionDifference !== 0) return versionDifference;
        const orderDifference = left.sortOrder - right.sortOrder;
        return orderDifference !== 0
            ? orderDifference
            : left.id.localeCompare(right.id);
    });
}

function questionHeader(
    versionNumber: number,
    question: SelectSurveyQuestion,
    contactField: SurveyContactField | null = null,
) {
    const base = `v${versionNumber} | id:${encodeURIComponent(
        question.id,
    )} | key:${question.key} | ${question.title}`;
    return contactField ? `${base} | ${contactField}` : base;
}

export function createSurveyResponseCsvColumns(
    versions: SelectSurveyVersion[],
    questions: SelectSurveyQuestion[],
): SurveyResponseCsvColumn[] {
    const versionNumberById = new Map(
        versions.map((version) => [version.id, version.versionNumber]),
    );
    const answerColumns = sortedQuestions(versions, questions).flatMap(
        (question): SurveyResponseCsvColumn[] => {
            const versionNumber =
                versionNumberById.get(question.versionId) ?? 0;
            if (question.type !== 'contact_info') {
                return [
                    {
                        kind: 'answer',
                        questionId: question.id,
                        contactField: null,
                        header: questionHeader(versionNumber, question),
                    },
                ];
            }

            return contactFieldOrder.map((contactField) => ({
                kind: 'answer',
                questionId: question.id,
                contactField,
                header: questionHeader(versionNumber, question, contactField),
            }));
        },
    );

    return [...fixedColumns, ...answerColumns];
}

function fixedColumnValue(key: FixedColumnKey, row: SurveyResponseExportRow) {
    switch (key) {
        case 'response_id':
            return row.response.id;
        case 'assignment_id':
            return row.response.assignmentId ?? '';
        case 'send_id':
            return row.assignment?.sendId ?? '';
        case 'survey_id':
            return row.response.surveyId;
        case 'version_id':
            return row.response.versionId;
        case 'version_number':
            return row.version.versionNumber;
        case 'version_title':
            return row.version.title;
        case 'source':
            return row.response.source;
        case 'status':
            return row.response.status;
        case 'submitted_at':
            return row.response.submittedAt;
        case 'started_at':
            return row.response.startedAt;
        case 'created_at':
            return row.response.createdAt;
        case 'account_id':
            return row.accountId ?? '';
        case 'user_id':
            return row.user?.id ?? '';
        case 'user_name':
            return row.user?.userName ?? '';
        case 'user_display_name':
            return row.user?.displayName ?? '';
        case 'context_key':
            return row.assignment?.contextKey ?? '';
        case 'context_month_key':
            return typeof row.assignment?.context.monthKey === 'string'
                ? row.assignment.context.monthKey
                : '';
        case 'context_json':
            return row.assignment ? JSON.stringify(row.assignment.context) : '';
        case 'response_metadata_json':
            return JSON.stringify(row.response.metadata);
        case 'imported_external_id':
            return row.response.importedExternalId ?? '';
    }
}

function answerColumnValue(
    column: Extract<SurveyResponseCsvColumn, { kind: 'answer' }>,
    answersByQuestionId: ReadonlyMap<
        string,
        SurveyResponseExportRow['answers'][number]
    >,
) {
    const detail = answersByQuestionId.get(column.questionId);
    if (!detail || detail.answer.skipped) return '';
    const { answer } = detail;
    if (column.contactField) {
        switch (column.contactField) {
            case 'first_name':
                return answer.contactValue?.firstName ?? '';
            case 'last_name':
                return answer.contactValue?.lastName ?? '';
            case 'phone':
                return answer.contactValue?.phone ?? '';
            case 'email':
                return answer.contactValue?.email ?? '';
        }
    }
    if (answer.numericValue !== null) return answer.numericValue;
    return answer.textValue ?? '';
}

function normalizedCsvValue(value: string | number | Date | null | undefined) {
    if (value === null || value === undefined) return '';
    return value instanceof Date ? value.toISOString() : String(value);
}

export function neutralizeSpreadsheetFormula(value: string) {
    const firstVisibleCharacter = value.replace(
        /^[ \u00a0\u2000-\u200a\u200b\u202f\u205f\u3000\ufeff]*/u,
        '',
    )[0];
    const firstVisibleCharacterCode = firstVisibleCharacter?.charCodeAt(0);
    const hasControlPrefix =
        firstVisibleCharacterCode !== undefined &&
        (firstVisibleCharacterCode <= 31 || firstVisibleCharacterCode === 127);
    if (
        firstVisibleCharacter === '=' ||
        firstVisibleCharacter === '+' ||
        firstVisibleCharacter === '-' ||
        firstVisibleCharacter === '@' ||
        hasControlPrefix
    ) {
        return `'${value}`;
    }
    return value;
}

export function surveyResponseCsvCell(
    value: string | number | Date | null | undefined,
) {
    const normalized = neutralizeSpreadsheetFormula(normalizedCsvValue(value));
    return `"${normalized.replaceAll('"', '""')}"`;
}

function surveyResponseCsvLine(
    values: Array<string | number | Date | null | undefined>,
) {
    return `${values.map(surveyResponseCsvCell).join(',')}\r\n`;
}

export function surveyResponseCsvDocumentPrefix(
    columns: SurveyResponseCsvColumn[],
) {
    return `\ufeff${surveyResponseCsvLine(columns.map((column) => column.header))}`;
}

export function serializeSurveyResponseCsvRows(
    columns: SurveyResponseCsvColumn[],
    rows: SurveyResponseExportRow[],
) {
    return rows
        .map((row) => serializeSurveyResponseCsvRow(columns, row))
        .join('');
}

export function serializeSurveyResponseCsvRow(
    columns: SurveyResponseCsvColumn[],
    row: SurveyResponseExportRow,
) {
    const answersByQuestionId = new Map(
        row.answers.map((answer) => [answer.question.id, answer]),
    );
    return surveyResponseCsvLine(
        columns.map((column) =>
            column.kind === 'fixed'
                ? fixedColumnValue(column.key, row)
                : answerColumnValue(column, answersByQuestionId),
        ),
    );
}

export function surveyResponseExportBatchSizeForColumnCount(
    columnCount: number,
    maximumBatchSize = surveyResponseExportBatchSize,
    maximumCellsPerBatch = surveyResponseExportMaximumCellsPerBatch,
) {
    const normalizedColumnCount = Math.max(1, Math.trunc(columnCount));
    const normalizedMaximumBatchSize = Math.max(
        1,
        Math.min(surveyResponseExportBatchSize, Math.trunc(maximumBatchSize)),
    );
    const normalizedMaximumCellsPerBatch = Math.max(
        1,
        Math.trunc(maximumCellsPerBatch),
    );
    return Math.max(
        1,
        Math.min(
            normalizedMaximumBatchSize,
            Math.floor(normalizedMaximumCellsPerBatch / normalizedColumnCount),
        ),
    );
}

export function surveyResponseExportDateKey(exportedAt: Date) {
    const parts = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'Europe/Zagreb',
        year: 'numeric',
    }).formatToParts(exportedAt);
    const partValue = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? '';
    return `${partValue('year')}-${partValue('month')}-${partValue('day')}`;
}

export function surveyResponseCsvFilename(surveyKey: string, exportedAt: Date) {
    const safeKey =
        surveyKey
            .normalize('NFKD')
            .replace(/\p{Mark}/gu, '')
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || 'survey';
    return `survey-responses-${safeKey}-${surveyResponseExportDateKey(
        exportedAt,
    )}.csv`;
}
