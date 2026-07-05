import 'server-only';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import {
    type SelectSunflowerLedgerEntry,
    storage,
    sunflowerLedgerEntries,
} from '..';

export const sunflowerLedgerEntryTypes = [
    'top_up',
    'top_up_bonus',
    'reservation',
    'reservation_release',
    'daily_capture',
    'refund',
    'correction',
    'manual_adjustment',
    'expiry',
] as const;

export type SunflowerLedgerEntryType =
    (typeof sunflowerLedgerEntryTypes)[number];

export type SunflowerLedgerBalance = {
    available: number;
    reserved: number;
    total: number;
};

export type SunflowerLedgerResult =
    | {
          status: 'created' | 'existing';
          entry: SelectSunflowerLedgerEntry;
      }
    | {
          status: 'skipped';
          reason: 'no_active_reservation';
          entry?: undefined;
      };

type StorageClient = ReturnType<typeof storage>;

type LedgerMetadata = Record<string, unknown>;

type LedgerSourceInput = {
    amountEur?: string | null;
    packageCode?: string | null;
    packageEntityId?: number | null;
    operationId?: number | null;
    transactionId?: number | null;
    invoiceId?: number | null;
    receiptId?: number | null;
    reservationKey?: string | null;
    sourceType?: string | null;
    sourceId?: string | null;
    reason?: string | null;
    actorId?: string | null;
    metadata?: LedgerMetadata | null;
};

type CreateLedgerEntryInput = LedgerSourceInput & {
    accountId: string;
    entryType: SunflowerLedgerEntryType;
    amount: number;
    availableDelta: number;
    reservedDelta: number;
    idempotencyKey: string;
};

export type SunflowerPackageTopUpInput = LedgerSourceInput & {
    accountId: string;
    packageCode: string;
    packageEntityId?: number | null;
    sunflowers: number;
    bonusSunflowers?: number;
    priceCents?: number | null;
    idempotencyKey: string;
};

export type ReserveSunflowersInput = LedgerSourceInput & {
    accountId: string;
    amount: number;
    reservationKey: string;
    idempotencyKey: string;
};

export type ReleaseSunflowerReservationInput = LedgerSourceInput & {
    accountId: string;
    reservationKey: string;
    amount?: number;
    idempotencyKey: string;
};

export type CaptureSunflowerReservationInput = LedgerSourceInput & {
    accountId: string;
    reservationKey: string;
    amount?: number;
    idempotencyKey: string;
};

export type RefundSunflowersInput = LedgerSourceInput & {
    accountId: string;
    amount: number;
    idempotencyKey: string;
};

export type CorrectSunflowerBalanceInput = LedgerSourceInput & {
    accountId: string;
    amountDelta: number;
    idempotencyKey: string;
    entryType?: Extract<
        SunflowerLedgerEntryType,
        'correction' | 'manual_adjustment' | 'expiry'
    >;
};

function assertPositiveInteger(fieldName: string, value: number) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${fieldName} must be a positive integer.`);
    }
}

function assertNonZeroInteger(fieldName: string, value: number) {
    if (!Number.isInteger(value) || value === 0) {
        throw new Error(`${fieldName} must be a non-zero integer.`);
    }
}

function assertReason(reason: string | null | undefined) {
    if (!reason || reason.trim().length === 0) {
        throw new Error('reason is required.');
    }
}

function priceCentsToEur(priceCents: number | null | undefined) {
    if (priceCents == null) {
        return null;
    }
    if (!Number.isInteger(priceCents) || priceCents < 0) {
        throw new Error('priceCents must be a non-negative integer.');
    }
    return (priceCents / 100).toFixed(2);
}

async function getExistingLedgerEntry(
    accountId: string,
    idempotencyKey: string,
    db: StorageClient,
) {
    return db.query.sunflowerLedgerEntries.findFirst({
        where: and(
            eq(sunflowerLedgerEntries.accountId, accountId),
            eq(sunflowerLedgerEntries.idempotencyKey, idempotencyKey),
            eq(sunflowerLedgerEntries.isDeleted, false),
        ),
    });
}

async function getActiveReservationBalance(
    accountId: string,
    reservationKey: string,
    db: StorageClient,
) {
    const [result] = await db
        .select({
            amount: sql<number>`coalesce(sum(${sunflowerLedgerEntries.reservedDelta}), 0)::int`,
        })
        .from(sunflowerLedgerEntries)
        .where(
            and(
                eq(sunflowerLedgerEntries.accountId, accountId),
                eq(sunflowerLedgerEntries.reservationKey, reservationKey),
                eq(sunflowerLedgerEntries.isDeleted, false),
            ),
        );

    return Number(result?.amount ?? 0);
}

export async function getSunflowerLedgerBalance(
    accountId: string,
    db: StorageClient = storage(),
): Promise<SunflowerLedgerBalance> {
    const latestEntry = await db.query.sunflowerLedgerEntries.findFirst({
        where: and(
            eq(sunflowerLedgerEntries.accountId, accountId),
            eq(sunflowerLedgerEntries.isDeleted, false),
        ),
        orderBy: [
            desc(sunflowerLedgerEntries.createdAt),
            desc(sunflowerLedgerEntries.id),
        ],
    });

    if (!latestEntry) {
        return { available: 0, reserved: 0, total: 0 };
    }

    return {
        available: latestEntry.availableBalanceAfter,
        reserved: latestEntry.reservedBalanceAfter,
        total: latestEntry.totalBalanceAfter,
    };
}

export async function getSunflowerLedgerHistory({
    accountId,
    offset = 0,
    limit = 50,
    db = storage(),
}: {
    accountId: string;
    offset?: number;
    limit?: number;
    db?: StorageClient;
}) {
    return db.query.sunflowerLedgerEntries.findMany({
        where: and(
            eq(sunflowerLedgerEntries.accountId, accountId),
            eq(sunflowerLedgerEntries.isDeleted, false),
        ),
        orderBy: [
            desc(sunflowerLedgerEntries.createdAt),
            desc(sunflowerLedgerEntries.id),
        ],
        offset,
        limit,
    });
}

export async function hasPurchasedSunflowerPackage(
    accountId: string,
    packageCode: string,
    db: StorageClient = storage(),
) {
    const entry = await db.query.sunflowerLedgerEntries.findFirst({
        where: and(
            eq(sunflowerLedgerEntries.accountId, accountId),
            eq(sunflowerLedgerEntries.entryType, 'top_up'),
            eq(sunflowerLedgerEntries.packageCode, packageCode),
            eq(sunflowerLedgerEntries.isDeleted, false),
        ),
    });

    return Boolean(entry);
}

async function insertLedgerEntry(
    input: CreateLedgerEntryInput,
    db: StorageClient,
): Promise<SelectSunflowerLedgerEntry> {
    const balance = await getSunflowerLedgerBalance(input.accountId, db);
    const availableBalanceAfter = balance.available + input.availableDelta;
    const reservedBalanceAfter = balance.reserved + input.reservedDelta;
    if (availableBalanceAfter < 0) {
        throw new Error('Insufficient available sunflowers.');
    }
    if (reservedBalanceAfter < 0) {
        throw new Error('Insufficient reserved sunflowers.');
    }

    const [entry] = await db
        .insert(sunflowerLedgerEntries)
        .values({
            accountId: input.accountId,
            entryType: input.entryType,
            amount: input.amount,
            availableDelta: input.availableDelta,
            reservedDelta: input.reservedDelta,
            availableBalanceAfter,
            reservedBalanceAfter,
            totalBalanceAfter: availableBalanceAfter + reservedBalanceAfter,
            amountEur: input.amountEur ?? null,
            packageCode: input.packageCode ?? null,
            packageEntityId: input.packageEntityId ?? null,
            operationId: input.operationId ?? null,
            transactionId: input.transactionId ?? null,
            invoiceId: input.invoiceId ?? null,
            receiptId: input.receiptId ?? null,
            reservationKey: input.reservationKey ?? null,
            sourceType: input.sourceType ?? null,
            sourceId: input.sourceId ?? null,
            reason: input.reason ?? null,
            actorId: input.actorId ?? null,
            metadata: input.metadata ?? null,
            idempotencyKey: input.idempotencyKey,
        })
        .returning();

    if (!entry) {
        throw new Error('Failed to create sunflower ledger entry.');
    }

    return entry;
}

async function createLedgerEntryWithLock(
    input: CreateLedgerEntryInput,
): Promise<SunflowerLedgerResult> {
    return storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`sunflower-ledger:${input.accountId}`}));`,
        );

        const existing = await getExistingLedgerEntry(
            input.accountId,
            input.idempotencyKey,
            tx,
        );
        if (existing) {
            return { status: 'existing', entry: existing };
        }

        const entry = await insertLedgerEntry(input, tx);
        return { status: 'created', entry };
    });
}

export async function topUpSunflowerPackage(input: SunflowerPackageTopUpInput) {
    assertPositiveInteger('sunflowers', input.sunflowers);
    if (input.bonusSunflowers != null && input.bonusSunflowers < 0) {
        throw new Error('bonusSunflowers must not be negative.');
    }
    const bonusSunflowers = input.bonusSunflowers ?? 0;
    if (bonusSunflowers >= input.sunflowers) {
        throw new Error('bonusSunflowers must be less than sunflowers.');
    }
    const purchasedSunflowers = input.sunflowers - bonusSunflowers;

    return storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`sunflower-ledger:${input.accountId}`}));`,
        );

        const topUpIdempotencyKey = `${input.idempotencyKey}:top_up`;
        const existingTopUp = await getExistingLedgerEntry(
            input.accountId,
            topUpIdempotencyKey,
            tx,
        );
        const bonusIdempotencyKey = `${input.idempotencyKey}:top_up_bonus`;
        const existingBonus = await getExistingLedgerEntry(
            input.accountId,
            bonusIdempotencyKey,
            tx,
        );

        if (existingTopUp) {
            if (bonusSunflowers > 0 && !existingBonus) {
                throw new Error(
                    'Sunflower package top-up already exists without a matching bonus entry.',
                );
            }
            return {
                topUp: { status: 'existing' as const, entry: existingTopUp },
                bonus: existingBonus
                    ? { status: 'existing' as const, entry: existingBonus }
                    : null,
            };
        }

        const topUp = {
            status: 'created' as const,
            entry: await insertLedgerEntry(
                {
                    ...input,
                    entryType: 'top_up',
                    amount: purchasedSunflowers,
                    availableDelta: purchasedSunflowers,
                    reservedDelta: 0,
                    amountEur: priceCentsToEur(input.priceCents),
                    idempotencyKey: topUpIdempotencyKey,
                    reason:
                        input.reason ?? `sunflowerPackage:${input.packageCode}`,
                },
                tx,
            ),
        };

        if (bonusSunflowers === 0) {
            return { topUp, bonus: null };
        }
        assertPositiveInteger('bonusSunflowers', bonusSunflowers);

        const bonus = existingBonus
            ? { status: 'existing' as const, entry: existingBonus }
            : {
                  status: 'created' as const,
                  entry: await insertLedgerEntry(
                      {
                          ...input,
                          entryType: 'top_up_bonus',
                          amount: bonusSunflowers,
                          availableDelta: bonusSunflowers,
                          reservedDelta: 0,
                          amountEur: null,
                          idempotencyKey: bonusIdempotencyKey,
                          reason:
                              input.reason ??
                              `sunflowerPackage:${input.packageCode}:bonus`,
                      },
                      tx,
                  ),
              };

        return { topUp, bonus };
    });
}

export async function reserveSunflowers(input: ReserveSunflowersInput) {
    assertPositiveInteger('amount', input.amount);
    return createLedgerEntryWithLock({
        ...input,
        entryType: 'reservation',
        availableDelta: -input.amount,
        reservedDelta: input.amount,
    });
}

export async function releaseSunflowerReservation(
    input: ReleaseSunflowerReservationInput,
): Promise<SunflowerLedgerResult> {
    return storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`sunflower-ledger:${input.accountId}`}));`,
        );

        const existing = await getExistingLedgerEntry(
            input.accountId,
            input.idempotencyKey,
            tx,
        );
        if (existing) {
            return { status: 'existing', entry: existing };
        }

        const activeReservation = await getActiveReservationBalance(
            input.accountId,
            input.reservationKey,
            tx,
        );
        if (activeReservation <= 0) {
            return { status: 'skipped', reason: 'no_active_reservation' };
        }

        const amount = input.amount ?? activeReservation;
        assertPositiveInteger('amount', amount);
        if (amount > activeReservation) {
            throw new Error('Release amount exceeds active reservation.');
        }

        const entry = await insertLedgerEntry(
            {
                ...input,
                entryType: 'reservation_release',
                amount,
                availableDelta: amount,
                reservedDelta: -amount,
            },
            tx,
        );
        return { status: 'created', entry };
    });
}

export async function captureSunflowerReservation(
    input: CaptureSunflowerReservationInput,
): Promise<SunflowerLedgerResult> {
    return storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`sunflower-ledger:${input.accountId}`}));`,
        );

        const existing = await getExistingLedgerEntry(
            input.accountId,
            input.idempotencyKey,
            tx,
        );
        if (existing) {
            return { status: 'existing', entry: existing };
        }

        const activeReservation = await getActiveReservationBalance(
            input.accountId,
            input.reservationKey,
            tx,
        );
        if (activeReservation <= 0) {
            return { status: 'skipped', reason: 'no_active_reservation' };
        }

        const amount = input.amount ?? activeReservation;
        assertPositiveInteger('amount', amount);
        if (amount > activeReservation) {
            throw new Error('Capture amount exceeds active reservation.');
        }

        const entry = await insertLedgerEntry(
            {
                ...input,
                entryType: 'daily_capture',
                amount,
                availableDelta: 0,
                reservedDelta: -amount,
            },
            tx,
        );
        return { status: 'created', entry };
    });
}

export async function refundSunflowers(input: RefundSunflowersInput) {
    assertPositiveInteger('amount', input.amount);
    assertReason(input.reason);
    return createLedgerEntryWithLock({
        ...input,
        entryType: 'refund',
        availableDelta: input.amount,
        reservedDelta: 0,
    });
}

export async function correctSunflowerBalance(
    input: CorrectSunflowerBalanceInput,
) {
    assertNonZeroInteger('amountDelta', input.amountDelta);
    assertReason(input.reason);
    const entryType = input.entryType ?? 'manual_adjustment';
    return createLedgerEntryWithLock({
        ...input,
        entryType,
        amount: Math.abs(input.amountDelta),
        availableDelta: input.amountDelta,
        reservedDelta: 0,
    });
}

export async function getSunflowerReservationEntries({
    accountId,
    reservationKey,
    db = storage(),
}: {
    accountId: string;
    reservationKey: string;
    db?: StorageClient;
}) {
    return db.query.sunflowerLedgerEntries.findMany({
        where: and(
            eq(sunflowerLedgerEntries.accountId, accountId),
            eq(sunflowerLedgerEntries.reservationKey, reservationKey),
            eq(sunflowerLedgerEntries.isDeleted, false),
        ),
        orderBy: [
            asc(sunflowerLedgerEntries.createdAt),
            asc(sunflowerLedgerEntries.id),
        ],
    });
}
