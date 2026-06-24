import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { events } from '../schema';
import { storage } from '../storage';
import {
    createEvent,
    getAllEvents,
    knownEvents,
    knownEventTypes,
} from './events';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = TransactionClient | StorageClient;

export const SUNFLOWER_DROP_BLOCK_NAME = 'Sunflower';
export const SUNFLOWER_DROP_REWARD_AMOUNT = 1;
export const SUNFLOWER_DROP_DAILY_LIMIT = 2;
export const SUNFLOWER_DROP_REASON = 'sunflowerDrop';

const SUNFLOWER_DROP_TIME_ZONE = 'Europe/Zagreb';
const SUNFLOWER_DROP_EXPIRATION_MS = 10 * 60 * 1000;

export type SunflowerDropSpawn = {
    amount: number;
    expiresAt: string;
    gardenId: number;
    rewardDate: string;
    sourceBlockId: string;
    spawnId: string;
};

export type SunflowerDropSpawnResult =
    | {
          created: boolean;
          reason?: undefined;
          spawn: SunflowerDropSpawn;
      }
    | {
          created: false;
          reason: 'chance' | 'daily_limit';
          spawn: null;
      };

export type SunflowerDropClaimResult =
    | {
          amount: number;
          reason?: undefined;
          status: 'claimed';
      }
    | {
          amount?: undefined;
          reason: 'already_claimed' | 'daily_limit' | 'expired' | 'not_found';
          status: 'rejected';
      };

type SunflowerDropSpawnPayload = SunflowerDropSpawn;

type SunflowerDropEarnPayload = SunflowerDropSpawn & {
    reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function readSpawnPayload(value: unknown): SunflowerDropSpawnPayload | null {
    if (!isRecord(value)) {
        return null;
    }

    const { amount, expiresAt, gardenId, rewardDate, sourceBlockId, spawnId } =
        value;
    if (
        typeof amount !== 'number' ||
        typeof expiresAt !== 'string' ||
        typeof gardenId !== 'number' ||
        typeof rewardDate !== 'string' ||
        typeof sourceBlockId !== 'string' ||
        typeof spawnId !== 'string'
    ) {
        return null;
    }

    return {
        amount,
        expiresAt,
        gardenId,
        rewardDate,
        sourceBlockId,
        spawnId,
    };
}

function readEarnPayload(value: unknown): SunflowerDropEarnPayload | null {
    const spawnPayload = readSpawnPayload(value);
    if (!spawnPayload || !isRecord(value) || typeof value.reason !== 'string') {
        return null;
    }

    return {
        ...spawnPayload,
        reason: value.reason,
    };
}

function getSunflowerDropRewardDate(date: Date) {
    return new Intl.DateTimeFormat('en-CA', {
        day: '2-digit',
        month: '2-digit',
        timeZone: SUNFLOWER_DROP_TIME_ZONE,
        year: 'numeric',
    }).format(date);
}

async function lockSunflowerDrops(accountId: string, db: DatabaseClient) {
    await db.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`sunflower-drop:${accountId}`}));`,
    );
}

async function getSunflowerDropEvents(accountId: string, db: DatabaseClient) {
    return getAllEvents(
        [
            knownEventTypes.accounts.sunflowerDropSpawn,
            knownEventTypes.accounts.earnSunflowerDrop,
        ],
        [accountId],
        { db },
    );
}

function summarizeSunflowerDropEvents({
    events,
    now,
    rewardDate,
}: {
    events: Awaited<ReturnType<typeof getSunflowerDropEvents>>;
    now: Date;
    rewardDate: string;
}) {
    const claimedSpawnIds = new Set<string>();
    let todaysClaimCount = 0;
    let todaysSpawnCount = 0;
    const activeSpawns: SunflowerDropSpawn[] = [];

    for (const event of events) {
        if (event.type !== knownEventTypes.accounts.earnSunflowerDrop) {
            continue;
        }

        const payload = readEarnPayload(event.data);
        if (!payload) {
            continue;
        }
        claimedSpawnIds.add(payload.spawnId);
        if (payload.rewardDate === rewardDate) {
            todaysClaimCount += 1;
        }
    }

    for (const event of events) {
        if (event.type !== knownEventTypes.accounts.sunflowerDropSpawn) {
            continue;
        }

        const payload = readSpawnPayload(event.data);
        if (!payload || payload.rewardDate !== rewardDate) {
            continue;
        }

        todaysSpawnCount += 1;
        if (
            !claimedSpawnIds.has(payload.spawnId) &&
            new Date(payload.expiresAt).getTime() > now.getTime()
        ) {
            activeSpawns.push(payload);
        }
    }

    return {
        activeSpawns,
        claimedSpawnIds,
        todaysClaimCount,
        todaysSpawnCount,
    };
}

export async function getOrCreateSunflowerDropSpawn({
    accountId,
    allowCreate,
    gardenId,
    now = new Date(),
    sourceBlockId,
}: {
    accountId: string;
    allowCreate: boolean;
    gardenId: number;
    now?: Date;
    sourceBlockId: string;
}): Promise<SunflowerDropSpawnResult> {
    return storage().transaction(async (tx) => {
        await lockSunflowerDrops(accountId, tx);

        const rewardDate = getSunflowerDropRewardDate(now);
        const summary = summarizeSunflowerDropEvents({
            events: await getSunflowerDropEvents(accountId, tx),
            now,
            rewardDate,
        });
        const existingSpawn = summary.activeSpawns.find(
            (spawn) => spawn.gardenId === gardenId,
        );

        if (existingSpawn) {
            return {
                created: false,
                spawn: existingSpawn,
            };
        }

        if (
            summary.todaysSpawnCount >= SUNFLOWER_DROP_DAILY_LIMIT ||
            summary.todaysClaimCount >= SUNFLOWER_DROP_DAILY_LIMIT
        ) {
            return {
                created: false,
                reason: 'daily_limit',
                spawn: null,
            };
        }

        if (!allowCreate) {
            return {
                created: false,
                reason: 'chance',
                spawn: null,
            };
        }

        const spawn: SunflowerDropSpawn = {
            amount: SUNFLOWER_DROP_REWARD_AMOUNT,
            expiresAt: new Date(
                now.getTime() + SUNFLOWER_DROP_EXPIRATION_MS,
            ).toISOString(),
            gardenId,
            rewardDate,
            sourceBlockId,
            spawnId: randomUUID(),
        };

        await createEvent(
            knownEvents.accounts.sunflowerDropSpawnedV1(accountId, spawn),
            tx,
        );

        return {
            created: true,
            spawn,
        };
    });
}

export async function claimSunflowerDrop({
    accountId,
    now = new Date(),
    spawnId,
}: {
    accountId: string;
    now?: Date;
    spawnId: string;
}): Promise<SunflowerDropClaimResult> {
    return storage().transaction(async (tx) => {
        await lockSunflowerDrops(accountId, tx);

        const rewardDate = getSunflowerDropRewardDate(now);
        const sunflowerEvents = await getSunflowerDropEvents(accountId, tx);
        const summary = summarizeSunflowerDropEvents({
            events: sunflowerEvents,
            now,
            rewardDate,
        });

        if (summary.claimedSpawnIds.has(spawnId)) {
            return {
                reason: 'already_claimed',
                status: 'rejected',
            };
        }

        if (summary.todaysClaimCount >= SUNFLOWER_DROP_DAILY_LIMIT) {
            return {
                reason: 'daily_limit',
                status: 'rejected',
            };
        }

        const spawnEvent = sunflowerEvents.find((event) => {
            if (event.type !== knownEventTypes.accounts.sunflowerDropSpawn) {
                return false;
            }
            return readSpawnPayload(event.data)?.spawnId === spawnId;
        });
        const spawn = readSpawnPayload(spawnEvent?.data);
        if (!spawn) {
            return {
                reason: 'not_found',
                status: 'rejected',
            };
        }

        if (new Date(spawn.expiresAt).getTime() <= now.getTime()) {
            return {
                reason: 'expired',
                status: 'rejected',
            };
        }

        await createEvent(
            knownEvents.accounts.sunflowerDropEarnedV1(accountId, {
                ...spawn,
                reason: SUNFLOWER_DROP_REASON,
            }),
            tx,
        );

        return {
            amount: spawn.amount,
            status: 'claimed',
        };
    });
}

export async function getSunflowerDropClaimCountForSpawn(
    accountId: string,
    spawnId: string,
) {
    const result = await storage()
        .select({ count: sql<number>`count(*)` })
        .from(events)
        .where(
            and(
                eq(events.aggregateId, accountId),
                eq(events.type, knownEventTypes.accounts.earnSunflowerDrop),
                sql`${events.data}->>'spawnId' = ${spawnId}`,
            ),
        );

    return Number(result[0]?.count ?? 0);
}
