import 'server-only';

import { farms, storage } from "..";
import { desc } from 'drizzle-orm';

export async function getFarms() {
    return storage.query.farms.findMany({
        orderBy: desc(farms.createdAt)
    });
}
