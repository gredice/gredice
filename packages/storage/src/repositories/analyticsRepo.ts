import { count } from "drizzle-orm";
import { accounts, events, farms, gardenBlocks, gardens, users } from "../schema";
import { storage } from "../storage";

export async function getAnalyticsTotals() {
    return {
        users: (await storage.select({ count: count() }).from(users))[0].count,
        accounts: (await storage.select({ count: count() }).from(accounts))[0].count,
        farms: (await storage.select({ count: count() }).from(farms))[0].count,
        gardens: (await storage.select({ count: count() }).from(gardens))[0].count,
        blocks: (await storage.select({ count: count() }).from(gardenBlocks))[0].count,
        events: (await storage.select({ count: count() }).from(events))[0].count
    };
}