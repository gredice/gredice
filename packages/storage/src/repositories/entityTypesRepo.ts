import 'server-only';
import { and, eq, isNull } from "drizzle-orm";
import { storage } from "../storage";
import { entityTypes, entityTypeCategories, InsertEntityType, UpdateEntityType } from '../schema';

export function getEntityTypes() {
    return storage().select().from(entityTypes)
        .where(eq(entityTypes.isDeleted, false))
        .orderBy(entityTypes.order);
}

export function getEntityTypesWithCategory() {
    return storage().query.entityTypes.findMany({
        where: eq(entityTypes.isDeleted, false),
        with: {
            category: true,
        },
        orderBy: entityTypes.order,
    });
}

export function getEntityTypesByCategory(categoryId: number) {
    return storage().query.entityTypes.findMany({
        where: and(
            eq(entityTypes.categoryId, categoryId),
            eq(entityTypes.isDeleted, false)
        ),
        orderBy: entityTypes.order,
    });
}

export function getEntityTypesWithoutCategory() {
    return storage().query.entityTypes.findMany({
        where: and(
            isNull(entityTypes.categoryId),
            eq(entityTypes.isDeleted, false)
        ),
        orderBy: entityTypes.order,
    });
}

export function getEntityTypeByName(entityTypeName: string) {
    return storage().query.entityTypes.findFirst({
        where: and(eq(entityTypes.name, entityTypeName), eq(entityTypes.isDeleted, false)),
    });
}

export function getEntityTypeByNameWithCategory(entityTypeName: string) {
    return storage().query.entityTypes.findFirst({
        where: and(eq(entityTypes.name, entityTypeName), eq(entityTypes.isDeleted, false)),
        with: {
            category: true,
        },
    });
}

export async function getEntityTypesOrganizedByCategories() {
    const [categoriesWithTypes, typesWithoutCategory] = await Promise.all([
        storage().query.entityTypeCategories.findMany({
            where: eq(entityTypeCategories.isDeleted, false),
            with: {
                entityTypes: {
                    where: eq(entityTypes.isDeleted, false),
                    orderBy: entityTypes.order,
                },
            },
            orderBy: entityTypeCategories.order,
        }),
        getEntityTypesWithoutCategory(),
    ]);

    return {
        categorizedTypes: categoriesWithTypes,
        uncategorizedTypes: typesWithoutCategory,
    };
}

export async function upsertEntityType(value: InsertEntityType | UpdateEntityType) {
    if ('id' in value) {
        if (!value.id) {
            throw new Error('Entity type id is required');
        }

        await storage()
            .update(entityTypes)
            .set({ ...value })
            .where(eq(entityTypes.id, value.id));
    } else {
        await storage()
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
    return storage()
        .update(entityTypes)
        .set({ isDeleted: true })
        .where(eq(entityTypes.id, id));
}