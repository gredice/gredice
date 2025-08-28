import 'server-only';
import { and, eq } from 'drizzle-orm';
import {
    entityTypeCategories,
    entityTypes,
    type InsertEntityTypeCategory,
    type UpdateEntityTypeCategory,
} from '../schema';
import { storage } from '../storage';

export function getEntityTypeCategories() {
    return storage()
        .select()
        .from(entityTypeCategories)
        .where(eq(entityTypeCategories.isDeleted, false))
        .orderBy(entityTypeCategories.order);
}

export function getEntityTypeCategoryById(id: number) {
    return storage().query.entityTypeCategories.findFirst({
        where: and(
            eq(entityTypeCategories.id, id),
            eq(entityTypeCategories.isDeleted, false),
        ),
    });
}

export async function upsertEntityTypeCategory(
    value: InsertEntityTypeCategory | UpdateEntityTypeCategory,
) {
    if ('id' in value) {
        if (!value.id) {
            throw new Error('Entity type category id is required');
        }

        await storage()
            .update(entityTypeCategories)
            .set({ ...value })
            .where(eq(entityTypeCategories.id, value.id));
    } else {
        await storage()
            .insert(entityTypeCategories)
            .values(value)
            .onConflictDoUpdate({
                target: entityTypeCategories.id,
                set: {
                    ...value,
                },
            });
    }
}

export function deleteEntityTypeCategory(id: number) {
    return storage()
        .update(entityTypeCategories)
        .set({ isDeleted: true })
        .where(eq(entityTypeCategories.id, id));
}

export function getEntityTypeCategoriesWithEntityTypes() {
    return storage().query.entityTypeCategories.findMany({
        where: eq(entityTypeCategories.isDeleted, false),
        with: {
            entityTypes: {
                where: eq(entityTypes.isDeleted, false),
            },
        },
        orderBy: entityTypeCategories.order,
    });
}
