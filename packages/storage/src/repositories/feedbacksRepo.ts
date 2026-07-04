import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { feedbacks, type InsertFeedback } from '../schema';
import { storage } from '../storage';

export type UpdateFeedback = Partial<Pick<InsertFeedback, 'comment' | 'score'>>;

export async function getFeedbacks(offset: number = 0, limit: number = 1000) {
    return storage().query.feedbacks.findMany({
        orderBy: desc(feedbacks.createdAt),
        offset,
        limit,
    });
}

export async function createFeedback(feedback: InsertFeedback) {
    return (
        await storage()
            .insert(feedbacks)
            .values({
                id: randomUUID(),
                ...feedback,
            })
            .returning({ id: feedbacks.id })
    )[0].id;
}

export async function updateFeedback(id: string, feedback: UpdateFeedback) {
    const updated = await storage()
        .update(feedbacks)
        .set(feedback)
        .where(eq(feedbacks.id, id))
        .returning({ id: feedbacks.id });

    return updated[0]?.id ?? null;
}
