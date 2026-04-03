import { openai } from '@ai-sdk/openai';
import { getEntitiesFormatted, getOperations } from '@gredice/storage';
import { generateText } from 'ai';

const AI_MODEL = 'gpt-5.4';

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

export async function analyzeRaisedBedFieldImage({
    accountId,
    gardenId,
    raisedBed,
    positionIndex,
    imageUrl,
}: {
    accountId: string;
    gardenId: number;
    raisedBed: {
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
    positionIndex: number;
    imageUrl: string;
}) {
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
            isAnalyzedField: field.positionIndex === positionIndex,
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

    const { text } = await generateText({
        model: openai(AI_MODEL),
        messages: [
            {
                role: 'system',
                content:
                    'Ti si stručni agronom za urbane vrtove. Piši ISKLJUČIVO na hrvatskom jeziku i vrati odgovor kao uredno formatiran markdown.',
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: [
                            'Analiziraj fotografiju vrta i kontekst te napiši praktične preporuke.',
                            'Odgovor MORA imati ove markdown sekcije:',
                            '## Sažetak stanja',
                            '## Globalne preporuke (2-4 stavke)',
                            '## Biljke koje traže najviše pažnje (2-4 biljke, po biljci navedi problem + konkretan idući korak)',
                            '## Plan za sljedeća 3 dana',
                            '',
                            'Kontekst (JSON):',
                            JSON.stringify(
                                {
                                    analyzedField: positionIndex,
                                    plantedFields,
                                    executedOperations,
                                },
                                null,
                                2,
                            ),
                        ].join('\n'),
                    },
                    {
                        type: 'image',
                        image: new URL(imageUrl),
                    },
                ],
            },
        ],
    });

    return {
        markdown: text,
        model: AI_MODEL,
        analyzedAt: new Date().toISOString(),
    };
}
