import { getEntitiesFormatted, getOperations } from '@gredice/storage';
import { streamText } from 'ai';

const AI_MODEL = process.env.AI_GATEWAY_MODEL ?? 'openai/gpt-5';

/** Vercel Blob Storage hostnames that are allowed as image sources. */
const ALLOWED_IMAGE_HOSTS = new Set([
    'myegtvromcktt2y7.public.blob.vercel-storage.com',
    '7ql7fvz1vzzo6adz.public.blob.vercel-storage.com',
]);

/** Max AI analysis requests per account per day. */
export const AI_ANALYSIS_DAILY_LIMIT = 10;

export function validateImageUrl(imageUrl: string): string | null {
    let parsed: URL;
    try {
        parsed = new URL(imageUrl);
    } catch {
        return 'Invalid image URL';
    }

    if (parsed.protocol !== 'https:') {
        return 'Image URL must use HTTPS';
    }

    if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) {
        return 'Image URL must be hosted on allowed storage';
    }

    return null;
}

function daysSince(date: Date | string | null | undefined) {
    if (!date) {
        return null;
    }

    const dateValue = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(dateValue.getTime())) {
        return null;
    }

    const oneDayMs = 1000 * 60 * 60 * 24;
    return Math.max(
        0,
        Math.floor((Date.now() - dateValue.getTime()) / oneDayMs),
    );
}

type RaisedBedAnalysisTarget = {
    id: number;
    fields: Array<{
        id: number;
        positionIndex: number;
        plantSortId?: number | string | null;
        plantStatus?: string | null;
        plantSowDate?: Date | string | null;
        plantGrowthDate?: Date | string | null;
        plantReadyDate?: Date | string | null;
        plantHarvestedDate?: Date | string | null;
        plantDeadDate?: Date | string | null;
        toBeRemoved?: boolean | null;
        active?: boolean | null;
    }>;
};

type AnalysisParams = {
    accountId: string;
    gardenId: number;
    raisedBed: RaisedBedAnalysisTarget;
    imageUrl: string;
    positionIndex?: number;
};

async function buildAnalysisMessages({
    accountId,
    gardenId,
    raisedBed,
    imageUrl,
    positionIndex,
}: AnalysisParams) {
    const [plantSorts, operations, operationsData] = await Promise.all([
        getEntitiesFormatted<{
            id: string;
            information?: { name?: string };
        }>('plantSort'),
        getOperations(accountId, gardenId, raisedBed.id),
        getEntitiesFormatted<{
            id: string;
            information?: { label?: string; name?: string };
        }>('operation'),
    ]);

    const plantSortNameById = new Map(
        plantSorts.map((sort) => [
            Number(sort.id),
            sort.information?.name ?? sort.id,
        ]),
    );
    const operationNameById = new Map(
        operationsData.map((entity) => [
            Number(entity.id),
            entity.information?.label ?? entity.information?.name ?? entity.id,
        ]),
    );

    const plantedFields = raisedBed.fields
        .filter((field) => field.active && field.plantSortId)
        .map((field) => ({
            positionIndex: field.positionIndex,
            plantSortId: field.plantSortId,
            plantName:
                plantSortNameById.get(Number(field.plantSortId)) ??
                String(field.plantSortId),
            plantStatus: field.plantStatus,
            daysFromSowing: daysSince(field.plantSowDate),
            daysFromGrowth: daysSince(field.plantGrowthDate),
            daysFromReady: daysSince(field.plantReadyDate),
            daysFromHarvest: daysSince(field.plantHarvestedDate),
            daysFromDead: daysSince(field.plantDeadDate),
            needsRemoval: Boolean(field.toBeRemoved),
            isAnalyzedField:
                typeof positionIndex === 'number' &&
                field.positionIndex === positionIndex,
        }));

    const executedOperations = operations.map((op) => ({
        id: op.id,
        operationId: op.entityId,
        operationName: operationNameById.get(op.entityId) ?? op.entityId,
        status: op.status,
        createdAt: op.createdAt,
        scheduledDate: op.scheduledDate,
        completedAt: op.completedAt,
        fieldId: op.raisedBedFieldId,
    }));

    return [
        {
            role: 'system' as const,
            content:
                'Ti si stručni agronom za urbane vrtove. Piši ISKLJUČIVO na hrvatskom jeziku i vrati odgovor kao uredno formatiran markdown.',
        },
        {
            role: 'user' as const,
            content: [
                {
                    type: 'text' as const,
                    text: [
                        typeof positionIndex === 'number'
                            ? 'Analiziraj fotografiju vrta i kontekst te napiši praktične preporuke za označeno polje i ostatak gredice.'
                            : 'Analiziraj fotografiju gredice i kontekst te napiši praktične preporuke za cijelu gredicu.',
                        'Odgovor MORA imati ove markdown sekcije:',
                        '## Sažetak stanja',
                        '## Globalne preporuke (2-4 stavke)',
                        '## Biljke koje traže najviše pažnje (2-4 biljke, po biljci navedi problem + konkretan idući korak)',
                        '## Plan za sljedeća 3 dana',
                        '',
                        'Kontekst (JSON):',
                        JSON.stringify(
                            {
                                analyzedField:
                                    typeof positionIndex === 'number'
                                        ? positionIndex
                                        : null,
                                plantedFields,
                                executedOperations,
                            },
                            null,
                            2,
                        ),
                    ].join('\n'),
                },
                {
                    type: 'image' as const,
                    image: new URL(imageUrl),
                },
            ],
        },
    ];
}

export async function streamRaisedBedImageAnalysis(
    params: AnalysisParams,
    onFinish: (result: {
        markdown: string;
        model: string;
        analyzedAt: string;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    }) => void | Promise<void>,
) {
    const messages = await buildAnalysisMessages(params);

    const result = streamText({
        model: AI_MODEL,
        messages,
        onFinish: async ({ text, usage }) => {
            await onFinish({
                markdown: text,
                model: AI_MODEL,
                analyzedAt: new Date().toISOString(),
                inputTokens: usage.inputTokens ?? 0,
                outputTokens: usage.outputTokens ?? 0,
                totalTokens: usage.totalTokens ?? 0,
            });
        },
    });

    return result;
}
