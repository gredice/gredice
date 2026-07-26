import type {
    SurveyResponseExportPreparation,
    SurveyResponseExportRequest,
    SurveyResponseExportRow,
} from '@gredice/storage';
import {
    createSurveyResponseCsvColumns,
    serializeSurveyResponseCsvRow,
    surveyResponseCsvDocumentPrefix,
    surveyResponseCsvFilename,
    surveyResponseExportBatchSize,
    surveyResponseExportBatchSizeForColumnCount,
    surveyResponseExportMaximumCellCount,
    surveyResponseExportMaximumCellsPerBatch,
    surveyResponseExportMaximumColumnCount,
    surveyResponseExportMaximumResponseCount,
} from './surveyResponseCsv';
import {
    parseSurveyResponseQuery,
    type SurveyResponseSearchParams,
    toSurveyResponseFilters,
} from './surveyResponseQuery';

type SurveyResponseExportHandlerDependencies = {
    authorize: () => Promise<unknown>;
    prepareExport: (
        request: SurveyResponseExportRequest,
    ) => Promise<SurveyResponseExportPreparation | null>;
    loadBatch: (request: {
        responseIds: string[];
        surveyId: string;
    }) => Promise<SurveyResponseExportRow[]>;
    maximumColumnCount?: number;
    maximumCellCount?: number;
    maximumCellsPerBatch?: number;
    maximumResponseCount?: number;
    batchSize?: number;
    now?: () => Date;
};

type SurveyResponseExportHandlerContext = {
    params: Promise<{ surveyId: string }>;
};

function searchParamValue(
    searchParams: URLSearchParams,
    key: keyof SurveyResponseSearchParams,
) {
    const values = searchParams.getAll(key);
    if (values.length === 0) return undefined;
    return values.length === 1 ? values[0] : values;
}

function responseSearchParams(
    searchParams: URLSearchParams,
): SurveyResponseSearchParams {
    return {
        versionId: searchParamValue(searchParams, 'versionId'),
        from: searchParamValue(searchParams, 'from'),
        to: searchParamValue(searchParams, 'to'),
        accountId: searchParamValue(searchParams, 'accountId'),
        userId: searchParamValue(searchParams, 'userId'),
        monthKey: searchParamValue(searchParams, 'monthKey'),
        context: searchParamValue(searchParams, 'context'),
        source: searchParamValue(searchParams, 'source'),
        page: searchParamValue(searchParams, 'page'),
    };
}

function privateTextResponse(message: string, status: number) {
    return new Response(message, {
        status,
        headers: {
            'Cache-Control': 'private, no-store, max-age=0',
            'Content-Type': 'text/plain; charset=utf-8',
            Pragma: 'no-cache',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}

function createSurveyResponseCsvStream({
    batchSize,
    columns,
    loadBatch,
    responseIds,
    surveyId,
}: {
    batchSize: number;
    columns: ReturnType<typeof createSurveyResponseCsvColumns>;
    loadBatch: SurveyResponseExportHandlerDependencies['loadBatch'];
    responseIds: string[];
    surveyId: string;
}) {
    const encoder = new TextEncoder();
    let headerPending = true;
    let offset = 0;
    let pendingRows: SurveyResponseExportRow[] = [];
    let pendingRowIndex = 0;

    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            if (headerPending) {
                headerPending = false;
                controller.enqueue(
                    encoder.encode(surveyResponseCsvDocumentPrefix(columns)),
                );
                if (responseIds.length === 0) {
                    controller.close();
                }
                return;
            }

            try {
                while (pendingRowIndex >= pendingRows.length) {
                    const batchIds = responseIds.slice(
                        offset,
                        offset + batchSize,
                    );
                    if (batchIds.length === 0) {
                        controller.close();
                        return;
                    }
                    pendingRows = await loadBatch({
                        responseIds: batchIds,
                        surveyId,
                    });
                    pendingRowIndex = 0;
                    offset += batchIds.length;
                }

                const row = pendingRows[pendingRowIndex];
                if (!row) {
                    controller.close();
                    return;
                }
                pendingRowIndex += 1;
                controller.enqueue(
                    encoder.encode(serializeSurveyResponseCsvRow(columns, row)),
                );
                if (
                    offset >= responseIds.length &&
                    pendingRowIndex >= pendingRows.length
                ) {
                    controller.close();
                }
            } catch (error) {
                controller.error(error);
            }
        },
    });
}

export function createSurveyResponseExportHandler(
    dependencies: SurveyResponseExportHandlerDependencies,
) {
    return async function surveyResponseExportHandler(
        request: Request,
        { params }: SurveyResponseExportHandlerContext,
    ) {
        await dependencies.authorize();

        const { surveyId } = await params;
        const parsedQuery = parseSurveyResponseQuery(
            responseSearchParams(new URL(request.url).searchParams),
        );
        const maximumResponseCount =
            dependencies.maximumResponseCount ??
            surveyResponseExportMaximumResponseCount;
        const preparation = await dependencies.prepareExport({
            surveyId,
            ...toSurveyResponseFilters(parsedQuery),
            maximumResponseCount,
        });
        if (!preparation) {
            return privateTextResponse('Survey not found.', 404);
        }
        if (
            preparation.status === 'too_large' ||
            preparation.responseIds.length > maximumResponseCount
        ) {
            return privateTextResponse(
                `Export exceeds the ${maximumResponseCount} response limit. Narrow the filters and try again.`,
                413,
            );
        }

        const columns = createSurveyResponseCsvColumns(
            preparation.versions,
            preparation.questions,
        );
        const maximumColumnCount =
            dependencies.maximumColumnCount ??
            surveyResponseExportMaximumColumnCount;
        if (columns.length > maximumColumnCount) {
            return privateTextResponse(
                `Export exceeds the ${maximumColumnCount} column limit. Select a single survey version and try again.`,
                413,
            );
        }
        const maximumCellCount =
            dependencies.maximumCellCount ??
            surveyResponseExportMaximumCellCount;
        if (
            preparation.responseIds.length * columns.length >
            maximumCellCount
        ) {
            return privateTextResponse(
                `Export exceeds the ${maximumCellCount} cell limit. Narrow the filters or select a single survey version and try again.`,
                413,
            );
        }
        const batchSize = surveyResponseExportBatchSizeForColumnCount(
            columns.length,
            dependencies.batchSize ?? surveyResponseExportBatchSize,
            dependencies.maximumCellsPerBatch ??
                surveyResponseExportMaximumCellsPerBatch,
        );
        const stream = createSurveyResponseCsvStream({
            batchSize,
            columns,
            loadBatch: dependencies.loadBatch,
            responseIds: preparation.responseIds,
            surveyId,
        });

        return new Response(stream, {
            headers: {
                'Cache-Control': 'private, no-store, max-age=0',
                'Content-Disposition': `attachment; filename="${surveyResponseCsvFilename(
                    preparation.survey.key,
                    dependencies.now?.() ?? new Date(),
                )}"`,
                'Content-Type': 'text/csv; charset=utf-8',
                Pragma: 'no-cache',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    };
}
