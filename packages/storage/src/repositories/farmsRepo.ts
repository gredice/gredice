import 'server-only';

import { and, desc, eq } from 'drizzle-orm';
import { farms, farmUsers, type InsertFarm, storage } from '..';

export async function getFarms() {
    return storage().query.farms.findMany({
        orderBy: desc(farms.createdAt),
    });
}

export async function getFarm(farmId: number) {
    return (
        (await storage().query.farms.findFirst({
            where: and(eq(farms.id, farmId), eq(farms.isDeleted, false)),
        })) ?? null
    );
}

export async function getFarmUsers(farmId: number) {
    return storage().query.farmUsers.findMany({
        where: eq(farmUsers.farmId, farmId),
        with: {
            user: true,
        },
        orderBy: desc(farmUsers.createdAt),
    });
}

export async function assignUserToFarm(
    farmId: number,
    userId: string,
) {
    const result = await storage()
        .insert(farmUsers)
        .values({ farmId, userId })
        .onConflictDoNothing({
            target: [farmUsers.farmId, farmUsers.userId],
        })
        .returning({ id: farmUsers.id });

    return result[0] ?? null;
}

export async function createFarm(data: InsertFarm) {
    const farm = await storage()
        .insert(farms)
        .values(data)
        .returning({ id: farms.id });

    if (!farm[0].id) {
        throw new Error('Failed to create farm');
    }

    return farm[0].id;
}
