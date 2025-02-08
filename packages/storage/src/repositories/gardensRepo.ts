import 'server-only';
import { and, eq } from "drizzle-orm";
import { storage } from "..";
import { gardens, InsertGarden, UpdateGarden } from "../schema/gardenSchema";
import { createEvent, knownEvents } from './eventsRepo';

export async function createGarden(garden: InsertGarden) {
    const createdGarden = (await storage
        .insert(gardens)
        .values(garden)
        .returning({ id: gardens.id, name: gardens.name, accountId: gardens.accountId }))[0];
    if (!createdGarden) {
        throw new Error('Failed to create garden');
    }

    await createEvent(knownEvents.gardens.createdV1(
        createdGarden.id.toString(),
        {
            name: createdGarden.name,
            accountId: createdGarden.accountId
        }));

    return createdGarden;
}

export async function getGardens() {
    return await storage.query.gardens.findMany();
}

export async function getAccountGardens(accountId: string) {
    return await storage.query.gardens.findMany({
        where: and(eq(gardens.accountId, accountId), eq(gardens.isDeleted, false))
    });
}

export async function getGarden(gardenId: number) {
    return await storage.query.gardens.findFirst({
        where: and(eq(gardens.id, gardenId), eq(gardens.isDeleted, false)),
        with: {
            farm: true
        }
    });
}

export async function updateGarden(garden: UpdateGarden) {
    await storage.update(gardens).set(garden).where(eq(gardens.id, garden.id));
}

export async function deleteGarden(gardenId: number) {
    await storage.update(gardens).set({ isDeleted: true }).where(eq(gardens.id, gardenId));
}