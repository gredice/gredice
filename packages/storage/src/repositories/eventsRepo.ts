import { and, desc, eq } from "drizzle-orm";
import { storage } from "../storage";
import { events } from "../schema";

export const knownEvents = {
    accounts: {
        createdV1: (aggregateId: string) => ({ type: "account.create", version: 1, aggregateId }),
        assignedUserV1: (aggregateId: string, data: { userId: string }) => ({ type: "account.assignUser", version: 1, aggregateId, data }),
    },
    users: {
        createdV1: (aggregateId: string) => ({ type: "user.create", version: 1, aggregateId }),
    },
    gardens: {
        createdV1: (aggregateId: string, data: { name: string, accountId: string }) => ({ type: "garden.create", version: 1, aggregateId, data }),
        renamedV1: (aggregateId: string, data: { name: string }) => ({ type: "garden.rename", version: 1, aggregateId, data }),
    },
}

export function getEvents(type: string, aggregateId: string) {
    return storage.query.events.findMany({
        where: and(eq(events.type, type), eq(events.aggregateId, aggregateId)),
        orderBy: [desc(events.createdAt)]
    });
}

export type Event = {
    type: string;
    version: number;
    aggregateId: string;
    data?: any | null | undefined;
}

export function createEvent({ type, version, aggregateId, data }: Event) {
    return storage.insert(events).values({
        type,
        version,
        aggregateId,
        data,
    });
}
