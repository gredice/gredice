import { and, desc, eq } from "drizzle-orm";
import { storage } from "../storage";
import { events } from "../schema";

export const knownEventTypes = {
    accounts: {
        create: "account.create",
        assignUser: "account.assignUser",
        earnSunflowers: "account.earnSunflowers",
        spendSunflowers: "account.spendSunflowers",
    },
    users: {
        create: "user.create",
    },
    gardens: {
        create: "garden.create",
        rename: "garden.rename",
        delete: "garden.delete",
        blokcPlace: "garden.blockPlace",
    },
}

export const knownEvents = {
    accounts: {
        createdV1: (aggregateId: string) => ({ type: knownEventTypes.accounts.create, version: 1, aggregateId }),
        assignedUserV1: (aggregateId: string, data: { userId: string }) => ({ type: knownEventTypes.accounts.assignUser, version: 1, aggregateId, data }),
        sunflowersEarnedV1: (aggregateId: string, data: { amount: number, reason: string }) => ({ type: knownEventTypes.accounts.earnSunflowers, version: 1, aggregateId, data }),
        sunflowersSpentV1: (aggregateId: string, data: { amount: number, reason: string }) => ({ type: knownEventTypes.accounts.spendSunflowers, version: 1, aggregateId, data }),
    },
    users: {
        createdV1: (aggregateId: string) => ({ type: knownEventTypes.users.create, version: 1, aggregateId }),
    },
    gardens: {
        createdV1: (aggregateId: string, data: { name: string, accountId: string }) => ({ type: knownEventTypes.gardens.create, version: 1, aggregateId, data }),
        renamedV1: (aggregateId: string, data: { name: string }) => ({ type: knownEventTypes.gardens.rename, version: 1, aggregateId, data }),
        deletedV1: (aggregateId: string) => ({ type: knownEventTypes.gardens.delete, version: 1, aggregateId }),
        blockPlacedV1: (aggregateId: string, data: { id: string, name: string }) => ({ type: knownEventTypes.gardens.blokcPlace, version: 1, aggregateId, data }),
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
