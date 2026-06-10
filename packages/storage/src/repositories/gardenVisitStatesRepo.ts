import 'server-only';

import { and, eq } from 'drizzle-orm';
import { storage } from '..';
import { gardenVisitStates, type SelectGardenVisitState } from '../schema';

export type GardenVisitStateKey = {
    userId: string;
    accountId: string;
    gardenId: number;
};

export type UpsertGardenOpenedAtInput = GardenVisitStateKey & {
    openedAt?: Date;
};

export type MarkGardenVisitSummarySeenInput = GardenVisitStateKey & {
    seenAt?: Date;
    factsHash?: string | null;
};

export async function getGardenVisitState({
    userId,
    accountId,
    gardenId,
}: GardenVisitStateKey): Promise<SelectGardenVisitState | null> {
    return (
        (await storage().query.gardenVisitStates.findFirst({
            where: and(
                eq(gardenVisitStates.userId, userId),
                eq(gardenVisitStates.accountId, accountId),
                eq(gardenVisitStates.gardenId, gardenId),
            ),
        })) ?? null
    );
}

export async function upsertGardenOpenedAt({
    userId,
    accountId,
    gardenId,
    openedAt = new Date(),
}: UpsertGardenOpenedAtInput): Promise<SelectGardenVisitState> {
    const [state] = await storage()
        .insert(gardenVisitStates)
        .values({
            userId,
            accountId,
            gardenId,
            lastOpenedAt: openedAt,
        })
        .onConflictDoUpdate({
            target: [
                gardenVisitStates.userId,
                gardenVisitStates.accountId,
                gardenVisitStates.gardenId,
            ],
            set: {
                lastOpenedAt: openedAt,
                updatedAt: openedAt,
            },
        })
        .returning();

    if (!state) {
        throw new Error('Failed to upsert garden visit state');
    }

    return state;
}

export async function markGardenVisitSummarySeen({
    userId,
    accountId,
    gardenId,
    seenAt = new Date(),
    factsHash = null,
}: MarkGardenVisitSummarySeenInput): Promise<SelectGardenVisitState> {
    const [state] = await storage()
        .insert(gardenVisitStates)
        .values({
            userId,
            accountId,
            gardenId,
            lastOpenedAt: seenAt,
            lastSummarySeenAt: seenAt,
            lastSummaryFactsHash: factsHash,
        })
        .onConflictDoUpdate({
            target: [
                gardenVisitStates.userId,
                gardenVisitStates.accountId,
                gardenVisitStates.gardenId,
            ],
            set: {
                lastOpenedAt: seenAt,
                lastSummarySeenAt: seenAt,
                lastSummaryFactsHash: factsHash,
                updatedAt: seenAt,
            },
        })
        .returning();

    if (!state) {
        throw new Error('Failed to mark garden visit summary seen');
    }

    return state;
}
