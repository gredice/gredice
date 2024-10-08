import { eq } from "drizzle-orm";
import { entityTypes, InsertEntityType, storage } from "..";

export function getEntityTypes() {
    return storage.select().from(entityTypes).orderBy(entityTypes.order);
}

export function upsertEntityType(value: InsertEntityType) {
    return storage
        .insert(entityTypes)
        .values(value)
        .onConflictDoUpdate({
            target: entityTypes.id,
            set: {
                ...value
            },
        });
}

export function deleteEntityType(id: number) {
    return storage
        .update(entityTypes)
        .set({ isDeleted: true })
        .where(eq(entityTypes.id, id));
}