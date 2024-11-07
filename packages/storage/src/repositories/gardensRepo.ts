import { and, eq } from "drizzle-orm";
import { storage } from "..";
import { gardens, InsertGarden, UpdateGarden } from "../schema/gardenSchema";

export async function createGarden(garden: InsertGarden) {
    await storage.insert(gardens).values(garden);
}

export async function getAccountGardens(accountId: string) {
    await storage.query.gardens.findMany({
        where: and(eq(gardens.accountId, accountId), eq(gardens.isDeleted, false))
    });
}

export async function updateGarden(garden: UpdateGarden) {
    await storage.update(gardens).set(garden).where(eq(gardens.id, garden.id));
}

export async function deleteGarden(gardenId: number) {
    await storage.update(gardens).set({ isDeleted: true }).where(eq(gardens.id, gardenId));
}