import { and, eq } from "drizzle-orm";
import { entityTypes, InsertEntityType, storage, UpdateEntityType } from "..";

export function getEntityTypes() {
    return storage.select().from(entityTypes).orderBy(entityTypes.order);
}

export function getEntityTypeByName(entityTypeName: string) {
    return storage.query.entityTypes.findFirst({
        where: and(eq(entityTypes.name, entityTypeName), eq(entityTypes.isDeleted, false)),
    });
}

export async function upsertEntityType(value: InsertEntityType | UpdateEntityType) {
    if ('id' in value) {
        if (!value.id) {
            throw new Error('Entity type id is required');
        }

        await storage
            .update(entityTypes)
            .set({ ...value })
            .where(eq(entityTypes.id, value.id));
    } else {
        await storage
            .insert(entityTypes)
            .values(value)
            .onConflictDoUpdate({
                target: entityTypes.id,
                set: {
                    ...value
                },
            });
    }
}

export function deleteEntityType(id: number) {
    return storage
        .update(entityTypes)
        .set({ isDeleted: true })
        .where(eq(entityTypes.id, id));
}