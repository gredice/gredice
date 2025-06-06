import 'server-only';

import { farms, InsertFarm, storage } from "..";
import { desc } from 'drizzle-orm';

export async function getFarms() {
    return storage.query.farms.findMany({
        orderBy: desc(farms.createdAt)
    });
}

export async function createFarm(data: InsertFarm) {
    const farm = await storage
        .insert(farms)
        .values(data)
        .returning({ id: farms.id });

    if (!farm[0].id) {
        throw new Error('Failed to create farm');
    }

    return farm[0].id;
}