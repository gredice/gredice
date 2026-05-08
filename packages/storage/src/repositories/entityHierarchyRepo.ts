import 'server-only';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { entities, storage } from '..';

type EntityHierarchyNode = {
    id: number;
    parentId: number | null;
    hierarchyOrder: number;
};

export async function getEntityChildren(entityId: number) {
    return storage().query.entities.findMany({
        where: and(
            eq(entities.parentId, entityId),
            eq(entities.isDeleted, false),
        ),
        orderBy: (table) => [asc(table.hierarchyOrder), asc(table.id)],
    });
}

export async function getEntityRoots(entityTypeName: string) {
    return storage().query.entities.findMany({
        where: and(
            eq(entities.entityTypeName, entityTypeName),
            eq(entities.isDeleted, false),
            eq(entities.parentId, null),
        ),
        orderBy: (table) => [asc(table.hierarchyOrder), asc(table.id)],
    });
}

export async function getEntityAncestors(entityId: number) {
    const ancestors: EntityHierarchyNode[] = [];
    const visited = new Set<number>();
    let current = await storage().query.entities.findFirst({
        where: and(eq(entities.id, entityId), eq(entities.isDeleted, false)),
        columns: { id: true, parentId: true, hierarchyOrder: true },
    });

    while (current?.parentId) {
        if (visited.has(current.parentId)) {
            throw new Error('Cycle detected in entity hierarchy');
        }
        visited.add(current.parentId);
        const parent = await storage().query.entities.findFirst({
            where: and(
                eq(entities.id, current.parentId),
                eq(entities.isDeleted, false),
            ),
            columns: { id: true, parentId: true, hierarchyOrder: true },
        });
        if (!parent) break;
        ancestors.push(parent);
        current = parent;
    }

    return ancestors;
}

export async function getEntityDescendants(entityId: number) {
    const descendants: EntityHierarchyNode[] = [];
    const queue = [entityId];
    const visited = new Set<number>([entityId]);

    while (queue.length > 0) {
        const batch = queue.splice(0, queue.length);
        const children = await storage().query.entities.findMany({
            where: and(
                inArray(entities.parentId, batch),
                eq(entities.isDeleted, false),
            ),
            columns: { id: true, parentId: true, hierarchyOrder: true },
            orderBy: (table) => [asc(table.hierarchyOrder), asc(table.id)],
        });
        for (const child of children) {
            if (visited.has(child.id)) {
                throw new Error('Cycle detected in entity hierarchy');
            }
            visited.add(child.id);
            descendants.push(child);
            queue.push(child.id);
        }
    }

    return descendants;
}
