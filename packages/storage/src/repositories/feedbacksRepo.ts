import { desc } from "drizzle-orm";
import { storage } from "../storage";
import { feedbacks, InsertFeedback } from "../schema";
import { randomUUID } from 'node:crypto';

export async function getFeedbacks(offset: number = 0, limit: number = 1000) {
    return storage.query.feedbacks.findMany({
        orderBy: desc(feedbacks.createdAt),
        offset,
        limit
    });
}

export async function createFeedback(feedback: InsertFeedback) {
    return (await storage.insert(feedbacks).values({
        id: randomUUID(),
        ...feedback
    }).returning({ id: feedbacks.id }))[0].id;
}
