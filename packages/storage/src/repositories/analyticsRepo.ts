import { count } from "drizzle-orm";
import { accounts, events, farms, gardenBlocks, gardens, raisedBeds, transactions, users } from "../schema";
import { storage } from "../storage";

export async function getAnalyticsTotals() {
    const [usersCount, accountsCount, farmsCount, gardensCount, blocksCount, eventsCount, raisedBedsCount, transactionsCount] = await Promise.all([
        storage.select({ count: count() }).from(users),
        storage.select({ count: count() }).from(accounts),
        storage.select({ count: count() }).from(farms),
        storage.select({ count: count() }).from(gardens),
        storage.select({ count: count() }).from(gardenBlocks),
        storage.select({ count: count() }).from(events),
        storage.select({ count: count() }).from(raisedBeds),
        storage.select({ count: count() }).from(transactions),
    ]);

    return {
        users: usersCount[0].count,
        accounts: accountsCount[0].count,
        farms: farmsCount[0].count,
        gardens: gardensCount[0].count,
        blocks: blocksCount[0].count,
        events: eventsCount[0].count,
        raisedBeds: raisedBedsCount[0].count,
        transactions: transactionsCount[0].count,
    };
}