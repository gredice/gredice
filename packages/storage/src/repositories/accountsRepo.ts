import 'server-only';
import { accounts, accountUsers, storage } from "..";
import { desc, eq } from 'drizzle-orm';
import { createEvent, getEvents, knownEvents, knownEventTypes } from './eventsRepo';

export function getAccounts() {
    return storage.query.accounts.findMany({
        orderBy: desc(accounts.createdAt),
    });
}

export function getAccount(accountId: string) {
    return storage.query.accounts.findFirst({
        where: eq(accounts.id, accountId),
    });
}

export function getAccountUsers(accountId: string) {
    return storage.query.accountUsers.findMany({
        where: eq(accountUsers.accountId, accountId),
        with: {
            user: true
        }
    });
}

export async function getSunflowers(accountId: string) {
    // Calculate sunflowers based on events
    let currentSunflowers = 0;
    const events = await getEvents(
        [knownEventTypes.accounts.earnSunflowers, knownEventTypes.accounts.spendSunflowers],
        accountId);
    for (const event of events) {
        currentSunflowers += event.type === knownEventTypes.accounts.spendSunflowers
            ? -Number((event.data as any).amount ?? 0)
            : Number((event.data as any).amount ?? 0);
    }
    return currentSunflowers;
}

export async function getSunflowersHistory(accountId: string, offset: number = 0, limit: number = 10) {
    const earnEvents = await getEvents(
        [knownEventTypes.accounts.earnSunflowers, knownEventTypes.accounts.spendSunflowers],
        accountId, offset, limit);
    return earnEvents.map((event) => ({
        ...event,
        amount: Number((event.data as any).amount),
        reason: (event.data as any).reason,
    }));
}

export async function earnSunflowers(accountId: string, amount: number, reason: string) {
    await createEvent(knownEvents.accounts.sunflowersEarnedV1(accountId, { amount, reason }));
}

export async function spendSunflowers(accountId: string, amount: number, reason: string) {
    const currentSunflowers = await getSunflowers(accountId);
    if (currentSunflowers < amount) {
        throw new Error('Insufficient sunflowers');
    }

    await createEvent(knownEvents.accounts.sunflowersSpentV1(accountId, { amount, reason }));
}