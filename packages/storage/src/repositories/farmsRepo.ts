import 'server-only';

import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
    farms,
    farmUsers,
    type InsertFarm,
    storage,
    type UpdateFarm,
    users,
} from '..';

export type FarmAssignableFarmUser = {
    id: string;
    userName: string;
    displayName: string | null;
    avatarUrl: string | null;
    farmId: number;
};

export type UniqueFarmAssignableFarmUser = Omit<
    FarmAssignableFarmUser,
    'farmId'
>;

export async function getFarms() {
    return storage().query.farms.findMany({
        orderBy: desc(farms.createdAt),
    });
}

export async function getFarmsForUser(userId: string) {
    const rows = await storage()
        .select({ farm: farms })
        .from(farmUsers)
        .innerJoin(farms, eq(farmUsers.farmId, farms.id))
        .where(and(eq(farmUsers.userId, userId), eq(farms.isDeleted, false)))
        .orderBy(desc(farms.createdAt));

    return rows.map((row) => row.farm);
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

export async function getAssignableFarmUsersByFarmIds(farmIds: number[]) {
    const uniqueFarmIds = Array.from(new Set(farmIds));
    if (uniqueFarmIds.length === 0) {
        const emptyAssignableFarmUsersByFarmId: Record<
            number,
            FarmAssignableFarmUser[]
        > = {};

        return emptyAssignableFarmUsersByFarmId;
    }

    const farmUserRows = await storage()
        .selectDistinct({
            farmId: farmUsers.farmId,
            userId: users.id,
            userName: users.userName,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
        })
        .from(farmUsers)
        .innerJoin(users, eq(farmUsers.userId, users.id))
        .where(inArray(farmUsers.farmId, uniqueFarmIds))
        .orderBy(asc(farmUsers.farmId), asc(users.userName));

    const assignableFarmUsersByFarmId: Record<
        number,
        FarmAssignableFarmUser[]
    > = {};
    for (const row of farmUserRows) {
        const existingUsers = assignableFarmUsersByFarmId[row.farmId] ?? [];
        existingUsers.push({
            id: row.userId,
            userName: row.userName,
            displayName: row.displayName,
            avatarUrl: row.avatarUrl,
            farmId: row.farmId,
        });
        assignableFarmUsersByFarmId[row.farmId] = existingUsers;
    }

    return assignableFarmUsersByFarmId;
}

export async function getUniqueAssignableFarmUsersByFarmIds(farmIds: number[]) {
    const assignableFarmUsersByFarmId =
        await getAssignableFarmUsersByFarmIds(farmIds);

    return Array.from(
        new Map(
            Object.values(assignableFarmUsersByFarmId)
                .flat()
                .map((row) => [
                    row.id,
                    {
                        id: row.id,
                        userName: row.userName,
                        displayName: row.displayName,
                        avatarUrl: row.avatarUrl,
                    },
                ]),
        ).values(),
    ) satisfies UniqueFarmAssignableFarmUser[];
}

export async function assignUserToFarm(farmId: number, userId: string) {
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

export async function updateFarm(data: UpdateFarm) {
    const { id, ...updates } = data;
    const updateValues = Object.fromEntries(
        Object.entries(updates).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(updateValues).length === 0) {
        return getFarm(id);
    }

    const result = await storage()
        .update(farms)
        .set(updateValues)
        .where(eq(farms.id, id))
        .returning();

    return result[0] ?? null;
}
