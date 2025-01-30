import { and, desc, eq } from "drizzle-orm";
import { storage } from "../storage";
import { events } from "../schema";

export function getEvents(type: string, aggregateId: string) {
    return storage.query.events.findMany({
        where: and(eq(events.type, type), eq(events.aggregateId, aggregateId)),
        orderBy: [desc(events.createdAt)]
    });
}

export function createEvent({ type, version, aggregateId, data }: { type: string, version: number, aggregateId: string, data: any }) {
    return storage.insert(events).values({
        type,
        version,
        aggregateId,
        data,
    });
}
