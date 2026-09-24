import 'server-only';
import {
    getRaisedBedAnalysisConversationId,
    raisedBedAnalysisChatText,
    sanitizeRaisedBedAiMarkdown,
} from '@gredice/js/ai';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
    type aiChatConversations,
    type aiChatMessages,
    events,
    gardens,
    raisedBeds,
} from '../schema';
import { storage } from '../storage';
import { knownEventTypes } from './eventsRepo';

type PhotoConversation = typeof aiChatConversations.$inferSelect & {
    messages: Array<typeof aiChatMessages.$inferSelect>;
};

/** Saved analyses are already durable events, even before a user sends a follow-up. */
export async function getAiPhotoConversations({
    accountId,
    userId,
    analysisId,
    limit,
}: {
    accountId: string;
    userId: string;
    analysisId?: number;
    limit: number;
}): Promise<PhotoConversation[]> {
    const rows = await storage()
        .select({
            event: events,
            gardenId: gardens.id,
            raisedBedId: raisedBeds.id,
            raisedBedName: raisedBeds.name,
        })
        .from(events)
        .innerJoin(
            raisedBeds,
            sql`split_part(${events.aggregateId}, '|', 1) = ${raisedBeds.id}::text`,
        )
        .innerJoin(gardens, eq(gardens.id, raisedBeds.gardenId))
        .where(
            and(
                inArray(events.type, [
                    knownEventTypes.raisedBeds.aiAnalysis,
                    knownEventTypes.raisedBedFields.aiAnalysis,
                ]),
                eq(raisedBeds.accountId, accountId),
                eq(gardens.accountId, accountId),
                eq(raisedBeds.isDeleted, false),
                // Current bed ownership cannot establish ownership of an older analysis.
                sql`${events.data}->>'accountId' = ${accountId}`,
                sql`jsonb_typeof(${events.data}->'markdown') = 'string' AND length(trim(${events.data}->>'markdown')) > 0`,
                analysisId === undefined
                    ? undefined
                    : eq(events.id, analysisId),
            ),
        )
        .orderBy(desc(events.createdAt), desc(events.id))
        .limit(limit);

    return rows.flatMap(({ event, gardenId, raisedBedId, raisedBedName }) => {
        if (
            !event.data ||
            typeof event.data !== 'object' ||
            Array.isArray(event.data)
        )
            return [];
        const data = Object.fromEntries(Object.entries(event.data));
        if (typeof data.markdown !== 'string' || !data.markdown.trim())
            return [];
        const field =
            event.type === knownEventTypes.raisedBedFields.aiAnalysis
                ? Number(event.aggregateId.split('|')[1])
                : undefined;
        if (field !== undefined && (!Number.isInteger(field) || field < 0))
            return [];
        const imageUrls = Array.isArray(data.imageUrls)
            ? data.imageUrls.filter(
                  (url): url is string =>
                      typeof url === 'string' && Boolean(url),
              )
            : typeof data.imageUrl === 'string'
              ? [data.imageUrl]
              : [];
        const id = getRaisedBedAnalysisConversationId(event.id, userId);
        return [
            {
                id,
                accountId,
                userId,
                gardenId,
                raisedBedId,
                title: `Analiza fotografija: ${raisedBedName}${field === undefined ? '' : ` · polje ${field + 1}`}`,
                model: typeof data.model === 'string' ? data.model : null,
                status: 'active',
                createdAt: event.createdAt,
                updatedAt: event.createdAt,
                lastMessageAt: event.createdAt,
                messages: [
                    {
                        id: `${id}-0`,
                        conversationId: id,
                        role: 'assistant',
                        createdAt: event.createdAt,
                        metadata: {
                            createdAt: event.createdAt.toISOString(),
                            photoAnalysis: {
                                gardenId,
                                entryName: 'Fotografiranje gredice',
                                imageUrls,
                                positionIndex: field,
                            },
                        },
                        parts: [
                            {
                                type: 'text',
                                text: raisedBedAnalysisChatText({
                                    analysisMarkdown:
                                        sanitizeRaisedBedAiMarkdown(
                                            data.markdown,
                                        ),
                                    positionIndex: field,
                                    referenceDate:
                                        typeof data.referenceDate === 'string'
                                            ? data.referenceDate
                                            : undefined,
                                }),
                            },
                        ],
                    },
                ],
            },
        ];
    });
}

export function photoAnalysisIdForUser(conversationId: string, userId: string) {
    const suffix = `-${userId}`;
    if (
        !conversationId.startsWith('analysis-') ||
        !conversationId.endsWith(suffix)
    )
        return undefined;
    const value = conversationId.slice('analysis-'.length, -suffix.length);
    if (!/^[1-9]\d*$/.test(value)) return undefined;
    const id = Number(value);
    return Number.isSafeInteger(id) && id <= 2_147_483_647 ? id : undefined;
}
