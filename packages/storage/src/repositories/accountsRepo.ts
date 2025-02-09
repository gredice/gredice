import 'server-only';
import { accounts, accountUsers, storage } from "..";
import { eq } from 'drizzle-orm';
import { createEvent, getEvents, knownEvents, knownEventTypes } from './eventsRepo';

export function getAccounts() {
    return storage.query.accounts.findMany();
}

export function getAccount(accountId: string) {
    return storage.query.accounts.findFirst({
        where: eq(accounts.id, accountId),
        with: {
            accounts: {
                with: {
                    account: true
                }
            }
        }
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
    const earnEvents = await getEvents(knownEventTypes.accounts.earnSunflowers, accountId);
    const spendEvents = await getEvents(knownEventTypes.accounts.spendSunflowers, accountId);
    for (const event of earnEvents) {
        currentSunflowers += (event.data as any).amount ?? 0;
    }
    for (const event of spendEvents) {
        currentSunflowers -= (event.data as any).amount ?? 0;
    }
    return currentSunflowers;
}

export async function earnSunflowers(accountId: string, amount: number) {
    await createEvent(knownEvents.accounts.sunflowersEarnedV1(accountId, { amount }));
}

export async function spendSunflowers(accountId: string, amount: number) {
    const currentSunflowers = await getSunflowers(accountId);
    if (currentSunflowers < amount) {
        throw new Error('Insufficient sunflowers');
    }

    await createEvent(knownEvents.accounts.sunflowersSpentV1(accountId, { amount }));
}