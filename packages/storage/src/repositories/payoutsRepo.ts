import 'server-only';
import type { OperationData } from '@gredice/directory-types';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
    farmerPayoutRequestAdjustments,
    farmerPayoutRequests,
    farmUsers,
    gardens,
    type InsertOperationPrice,
    operationPrices,
    operations,
    type PayoutStatus,
    raisedBeds,
    type SelectFarmerPayoutRequest,
    type SelectFarmerPayoutRequestAdjustment,
    type SelectOperationPrice,
} from '../schema';
import { storage } from '../storage';
import { getEntitiesFormatted } from './entitiesRepo';
import { createEvent, knownEvents } from './eventsRepo';
import { getRaisedBedFieldPlantCycles } from './gardensRepo';
import { createReceipt } from './invoicesRepo';
import { createNotification } from './notificationsRepo';
import { getFarmAcceptedOperations } from './operationsRepo';
import { getUser } from './usersRepo';

// ── Operation Prices ─────────────────────────────────────────────────────────

export async function getOperationPrices(
    farmId: number,
): Promise<SelectOperationPrice[]> {
    return storage().query.operationPrices.findMany({
        where: eq(operationPrices.farmId, farmId),
        orderBy: operationPrices.entityTypeName,
    });
}

export async function getAllOperationPrices(): Promise<SelectOperationPrice[]> {
    return storage().query.operationPrices.findMany({
        orderBy: [operationPrices.farmId, operationPrices.entityTypeName],
    });
}

export async function upsertOperationPrice(
    input: InsertOperationPrice,
): Promise<SelectOperationPrice> {
    const isEntitySpecific =
        input.entityId !== null && input.entityId !== undefined;

    const [row] = await storage()
        .insert(operationPrices)
        .values(input)
        .onConflictDoUpdate({
            target: isEntitySpecific
                ? [
                      operationPrices.farmId,
                      operationPrices.entityTypeName,
                      operationPrices.entityId,
                  ]
                : [operationPrices.farmId, operationPrices.entityTypeName],
            targetWhere: isEntitySpecific
                ? sql`${operationPrices.entityId} IS NOT NULL`
                : sql`${operationPrices.entityId} IS NULL`,
            set: {
                pricePerUnit: input.pricePerUnit,
                currency: input.currency,
                updatedAt: new Date(),
            },
        })
        .returning();
    return row;
}

export async function deleteOperationPrice(id: number): Promise<void> {
    await storage().delete(operationPrices).where(eq(operationPrices.id, id));
}

// ── Sowing helpers ────────────────────────────────────────────────────────────

// Plant statuses that confirm a sowing was verified by admin
const VERIFIED_SOWING_STATUSES = new Set([
    'sowed',
    'notSprouted',
    'sprouted',
    'firstFlowers',
    'firstFruitSet',
    'ready',
    'harvested',
    'died',
    'removed',
]);

const SOWING_DURATION_MINUTES = 5;

function getOperationDurationMinutes(operationData: OperationData | undefined) {
    const durationValue = operationData?.attributes?.duration;

    if (typeof durationValue === 'number' && Number.isFinite(durationValue)) {
        return Math.max(durationValue, 0);
    }

    if (typeof durationValue === 'string') {
        const parsed = Number.parseFloat(durationValue);
        if (Number.isFinite(parsed)) {
            return Math.max(parsed, 0);
        }
    }

    return 0;
}

// Returns one entry per verified sowing cycle for a farm.
async function getVerifiedSowingsForFarm(
    farmId: number,
    verifiedFrom?: Date,
): Promise<{ farmId: number; sowingLocation: string }[]> {
    const raisedBedRows = await storage()
        .select({
            raisedBedId: raisedBeds.id,
            farmId: gardens.farmId,
        })
        .from(raisedBeds)
        .innerJoin(gardens, eq(raisedBeds.gardenId, gardens.id))
        .where(
            and(
                eq(gardens.farmId, farmId),
                eq(raisedBeds.isDeleted, false),
                eq(gardens.isDeleted, false),
            ),
        );

    if (raisedBedRows.length === 0) return [];

    const allCycles = await Promise.all(
        raisedBedRows.map(async (row) => {
            const cycles = await getRaisedBedFieldPlantCycles(row.raisedBedId);
            return cycles.map((cycle) => ({
                farmId: row.farmId,
                sowingLocation: cycle.sowingLocation,
                plantStatus: cycle.plantStatus,
                verifiedAt:
                    cycle.plantSowDate ??
                    cycle.plantGrowthDate ??
                    cycle.plantDeadDate ??
                    cycle.plantReadyDate ??
                    cycle.plantHarvestedDate ??
                    cycle.plantRemovedDate ??
                    cycle.endedAt,
            }));
        }),
    );

    return allCycles
        .flat()
        .filter(
            (c) =>
                c.plantStatus !== undefined &&
                VERIFIED_SOWING_STATUSES.has(c.plantStatus) &&
                (!verifiedFrom ||
                    (c.verifiedAt && c.verifiedAt > verifiedFrom)),
        );
}

async function getOperationEffectiveFarmIds(operationIds: number[]) {
    const uniqueOperationIds = Array.from(new Set(operationIds));
    if (uniqueOperationIds.length === 0) {
        return new Map<number, number>();
    }

    const rows = await storage()
        .select({
            operationId: operations.id,
            farmId: sql<
                number | null
            >`coalesce(${operations.farmId}, ${gardens.farmId})`,
        })
        .from(operations)
        .leftJoin(raisedBeds, eq(operations.raisedBedId, raisedBeds.id))
        .leftJoin(
            gardens,
            eq(
                gardens.id,
                sql<
                    number | null
                >`coalesce(${operations.gardenId}, ${raisedBeds.gardenId})`,
            ),
        )
        .where(inArray(operations.id, uniqueOperationIds));

    return new Map(
        rows
            .filter((row) => row.farmId !== null)
            .map((row) => [row.operationId, row.farmId]),
    );
}

function getLastPaidPayoutRequestedAt(payouts: SelectFarmerPayoutRequest[]) {
    return (
        payouts
            .filter((payout) => payout.status === 'paid')
            // A completed payout closes the earning window at request time, not payment time.
            .map((payout) => payout.createdAt)
            .filter(
                (requestedAt): requestedAt is Date =>
                    requestedAt instanceof Date,
            )
            .sort((left, right) => right.getTime() - left.getTime())[0]
    );
}

function getOperationPayoutEligibleAt(operation: {
    verifiedAt?: Date;
    completedAt?: Date;
    timestamp: Date;
}) {
    return operation.verifiedAt ?? operation.completedAt ?? operation.timestamp;
}

async function isUserAssignedToFarm(userId: string, farmId: number) {
    const farmUser = await storage().query.farmUsers.findFirst({
        where: and(eq(farmUsers.userId, userId), eq(farmUsers.farmId, farmId)),
    });

    return Boolean(farmUser);
}

// ── Farmer Balance ────────────────────────────────────────────────────────────

export type FarmerEarning = {
    entityTypeName: string;
    entityId: number | null;
    entityLabel?: string;
    operationCount: number;
    durationMinutes: number;
    totalDurationMinutes: number;
    pricePerUnit: number;
    totalEarned: number;
    currency: string;
};

export type FarmerBalance = {
    totalEarned: number;
    totalOperationEarned: number;
    totalAdjustment: number;
    adjustmentCount: number;
    totalPaid: number;
    totalPending: number;
    availableBalance: number;
    totalDurationMinutes: number;
    currency: string;
    earningsByType: FarmerEarning[];
};

export type PayoutAdjustmentInput = {
    label: string;
    amount: number;
};

type NormalizedPayoutAdjustment = {
    label: string;
    amount: string;
    amountCents: number;
    currency: string;
    createdByUserId: string;
};

const MAX_PAYOUT_ADJUSTMENT_LABEL_LENGTH = 160;

function moneyToCents(value: number | string) {
    const amount = typeof value === 'string' ? Number.parseFloat(value) : value;

    if (!Number.isFinite(amount)) {
        throw new Error('Nevažeći iznos isplate.');
    }

    return Math.round(amount * 100);
}

function centsToMoney(cents: number) {
    return (cents / 100).toFixed(2);
}

function getAdjustmentTotalCents(
    adjustments: Pick<SelectFarmerPayoutRequestAdjustment, 'amount'>[],
) {
    return adjustments.reduce(
        (total, adjustment) => total + moneyToCents(adjustment.amount),
        0,
    );
}

function getActivePayoutAdjustmentTotal(
    payouts: (SelectFarmerPayoutRequest & {
        adjustments: Pick<SelectFarmerPayoutRequestAdjustment, 'amount'>[];
    })[],
) {
    return payouts
        .filter(
            (payout) =>
                payout.status === 'pending' || payout.status === 'approved',
        )
        .reduce(
            (result, payout) => ({
                amountCents:
                    result.amountCents +
                    getAdjustmentTotalCents(payout.adjustments),
                count: result.count + payout.adjustments.length,
            }),
            { amountCents: 0, count: 0 },
        );
}

function normalizePayoutAdjustments(
    adjustments: readonly PayoutAdjustmentInput[] | undefined,
    currency: string,
    createdByUserId: string,
): NormalizedPayoutAdjustment[] {
    return (adjustments ?? []).map((adjustment) => {
        const label = adjustment.label.trim();
        const amountCents = moneyToCents(adjustment.amount);

        if (!label) {
            throw new Error('Korekcija isplate mora imati opis.');
        }

        if (label.length > MAX_PAYOUT_ADJUSTMENT_LABEL_LENGTH) {
            throw new Error(
                `Opis korekcije može imati najviše ${MAX_PAYOUT_ADJUSTMENT_LABEL_LENGTH} znakova.`,
            );
        }

        if (amountCents === 0) {
            throw new Error('Korekcija isplate mora biti različita od nule.');
        }

        return {
            label,
            amount: centsToMoney(amountCents),
            amountCents,
            currency,
            createdByUserId,
        };
    });
}

export async function getFarmerBalance(
    _userId: string,
    farmId: number,
): Promise<FarmerBalance> {
    const [prices, payouts, operationsData] = await Promise.all([
        getOperationPrices(farmId),
        getFarmPayoutRequestsWithAdjustments(farmId),
        getEntitiesFormatted<OperationData>('operation'),
    ]);
    const lastPaidPayoutRequestedAt = getLastPaidPayoutRequestedAt(payouts);
    const [completedOperations, verifiedSowings] = await Promise.all([
        getFarmAcceptedOperations(farmId, { status: 'completed' }),
        getVerifiedSowingsForFarm(farmId, lastPaidPayoutRequestedAt),
    ]);
    const payableOperations = completedOperations.filter((operation) => {
        if (!lastPaidPayoutRequestedAt) {
            return true;
        }

        return (
            getOperationPayoutEligibleAt(operation) > lastPaidPayoutRequestedAt
        );
    });
    const completedOperationFarmIds = await getOperationEffectiveFarmIds(
        payableOperations.map((operation) => operation.id),
    );

    // Two maps: entityId-keyed (for specific operations) and typeName-keyed (for sowing)
    const priceByEntityId = new Map<number, SelectOperationPrice>(
        prices
            .filter((p) => p.entityId !== null)
            .map((p) => [p.entityId as number, p]),
    );
    const priceByTypeName = new Map<string, SelectOperationPrice>(
        prices
            .filter((p) => p.entityId === null)
            .map((p) => [p.entityTypeName, p]),
    );
    const operationLabelById = new Map(
        operationsData.map((operation) => [
            operation.id,
            operation.information?.label || operation.information?.name,
        ]),
    );
    const operationDurationById = new Map(
        operationsData.map((operation) => [
            operation.id,
            getOperationDurationMinutes(operation),
        ]),
    );

    const earningsByKey = new Map<string, FarmerEarning>();
    let currency = 'eur';

    // Operations
    for (const op of payableOperations) {
        const opFarmId = completedOperationFarmIds.get(op.id);
        if (opFarmId !== farmId) continue;

        // Look up price by entityId first, then fall back to entityTypeName
        const price =
            priceByEntityId.get(op.entityId) ??
            priceByTypeName.get(op.entityTypeName);
        if (!price) continue;

        currency = price.currency;
        const priceValue = parseFloat(price.pricePerUnit);
        const durationMinutes = operationDurationById.get(op.entityId) ?? 0;
        const key = `operation:${op.entityId}`;
        const existing = earningsByKey.get(key);

        if (existing) {
            existing.operationCount += 1;
            existing.totalDurationMinutes += durationMinutes;
            existing.totalEarned += priceValue;
        } else {
            earningsByKey.set(key, {
                entityTypeName: op.entityTypeName,
                entityId: op.entityId,
                entityLabel: operationLabelById.get(op.entityId),
                operationCount: 1,
                durationMinutes,
                totalDurationMinutes: durationMinutes,
                pricePerUnit: priceValue,
                totalEarned: priceValue,
                currency: price.currency,
            });
        }
    }

    // Sowing
    for (const sowing of verifiedSowings) {
        if (sowing.farmId !== farmId) continue;

        const typeName =
            sowing.sowingLocation === 'greenhouse'
                ? 'sowingGreenhouse'
                : 'sowing';
        const price = priceByTypeName.get(typeName);
        if (!price) continue;

        currency = price.currency;
        const priceValue = parseFloat(price.pricePerUnit);
        const existing = earningsByKey.get(typeName);

        if (existing) {
            existing.operationCount += 1;
            existing.totalDurationMinutes += SOWING_DURATION_MINUTES;
            existing.totalEarned += priceValue;
        } else {
            earningsByKey.set(typeName, {
                entityTypeName: typeName,
                entityId: null,
                operationCount: 1,
                durationMinutes: SOWING_DURATION_MINUTES,
                totalDurationMinutes: SOWING_DURATION_MINUTES,
                pricePerUnit: priceValue,
                totalEarned: priceValue,
                currency: price.currency,
            });
        }
    }

    const totalOperationEarned = Array.from(earningsByKey.values()).reduce(
        (acc, e) => acc + e.totalEarned,
        0,
    );
    const totalDurationMinutes = Array.from(earningsByKey.values()).reduce(
        (acc, e) => acc + e.totalDurationMinutes,
        0,
    );

    const totalPaidCents = payouts
        .filter((p) => p.status === 'paid')
        .reduce((acc, p) => acc + moneyToCents(p.requestedAmount), 0);

    const totalPendingCents = payouts
        .filter((p) => p.status === 'pending' || p.status === 'approved')
        .reduce((acc, p) => acc + moneyToCents(p.requestedAmount), 0);

    const activeAdjustments = getActivePayoutAdjustmentTotal(payouts);
    const totalOperationEarnedCents = moneyToCents(totalOperationEarned);
    const totalEarnedCents =
        totalOperationEarnedCents + activeAdjustments.amountCents;
    const availableBalanceCents = Math.max(
        0,
        totalEarnedCents - totalPendingCents,
    );

    return {
        totalEarned: totalEarnedCents / 100,
        totalOperationEarned: totalOperationEarnedCents / 100,
        totalAdjustment: activeAdjustments.amountCents / 100,
        adjustmentCount: activeAdjustments.count,
        totalPaid: totalPaidCents / 100,
        totalPending: totalPendingCents / 100,
        availableBalance: availableBalanceCents / 100,
        totalDurationMinutes,
        currency,
        earningsByType: Array.from(earningsByKey.values()),
    };
}

// ── Payout Requests ───────────────────────────────────────────────────────────

export async function createPayoutRequest(
    userId: string,
    farmId: number,
    requestedAmount: number,
    currency: string,
    farmerNote?: string,
): Promise<SelectFarmerPayoutRequest> {
    if (requestedAmount <= 0) {
        throw new Error('Iznos isplate mora biti veći od nule.');
    }
    if (!(await isUserAssignedToFarm(userId, farmId))) {
        throw new Error('Nemaš pristup odabranoj farmi.');
    }

    return storage().transaction(async (tx) => {
        // Lock and re-verify balance inside the transaction
        const balance = await getFarmerBalance(userId, farmId);
        if (requestedAmount > balance.availableBalance + 0.001) {
            throw new Error(
                `Zatraženi iznos (${requestedAmount} ${currency.toUpperCase()}) premašuje raspoloživo stanje (${balance.availableBalance.toFixed(2)} ${balance.currency.toUpperCase()}).`,
            );
        }

        const [row] = await tx
            .insert(farmerPayoutRequests)
            .values({
                userId,
                farmId,
                requestedAmount: requestedAmount.toFixed(2),
                currency,
                farmerNote: farmerNote ?? null,
                status: 'pending',
            })
            .returning();

        await createEvent(
            knownEvents.payouts.requestedV1(row.id.toString(), {
                userId,
                farmId,
                amount: requestedAmount,
                currency,
            }),
        );

        return row;
    });
}

export async function getPayoutRequest(
    id: number,
): Promise<SelectFarmerPayoutRequest | null> {
    return (
        (await storage().query.farmerPayoutRequests.findFirst({
            where: eq(farmerPayoutRequests.id, id),
        })) ?? null
    );
}

export async function getFarmerPayoutRequests(
    userId: string,
    farmId?: number,
): Promise<SelectFarmerPayoutRequest[]> {
    return storage().query.farmerPayoutRequests.findMany({
        where: and(
            eq(farmerPayoutRequests.userId, userId),
            farmId !== undefined
                ? eq(farmerPayoutRequests.farmId, farmId)
                : undefined,
        ),
        orderBy: desc(farmerPayoutRequests.createdAt),
    });
}

export async function getFarmPayoutRequests(
    farmId: number,
): Promise<SelectFarmerPayoutRequest[]> {
    return storage().query.farmerPayoutRequests.findMany({
        where: eq(farmerPayoutRequests.farmId, farmId),
        orderBy: desc(farmerPayoutRequests.createdAt),
    });
}

async function getFarmPayoutRequestsWithAdjustments(farmId: number): Promise<
    (SelectFarmerPayoutRequest & {
        adjustments: Pick<SelectFarmerPayoutRequestAdjustment, 'amount'>[];
    })[]
> {
    return storage().query.farmerPayoutRequests.findMany({
        where: eq(farmerPayoutRequests.farmId, farmId),
        orderBy: desc(farmerPayoutRequests.createdAt),
        with: {
            adjustments: {
                columns: {
                    amount: true,
                },
            },
        },
    });
}

export type PayoutRequestWithDetails = SelectFarmerPayoutRequest & {
    userName: string;
    displayName: string | null;
    avatarUrl: string | null;
    farmName: string;
    adjustments: SelectFarmerPayoutRequestAdjustment[];
    adjustmentTotal: string;
    originalRequestedAmount: string;
};

export async function getAllPayoutRequests(filter?: {
    status?: PayoutStatus;
    farmId?: number;
}): Promise<PayoutRequestWithDetails[]> {
    const rows = await storage().query.farmerPayoutRequests.findMany({
        where: and(
            filter?.status
                ? eq(farmerPayoutRequests.status, filter.status)
                : undefined,
            filter?.farmId !== undefined
                ? eq(farmerPayoutRequests.farmId, filter.farmId)
                : undefined,
        ),
        orderBy: desc(farmerPayoutRequests.createdAt),
        with: {
            user: {
                columns: {
                    id: true,
                    userName: true,
                    displayName: true,
                    avatarUrl: true,
                },
            },
            farm: {
                columns: {
                    id: true,
                    name: true,
                },
            },
            adjustments: {
                orderBy: (table, { asc }) => [asc(table.id)],
            },
        },
    });

    return rows.map((row) => {
        const adjustmentTotalCents = getAdjustmentTotalCents(row.adjustments);
        const originalRequestedAmountCents =
            moneyToCents(row.requestedAmount) - adjustmentTotalCents;

        return {
            ...row,
            userName: row.user?.userName ?? '',
            displayName: row.user?.displayName ?? null,
            avatarUrl: row.user?.avatarUrl ?? null,
            farmName: row.farm?.name ?? '',
            adjustmentTotal: centsToMoney(adjustmentTotalCents),
            originalRequestedAmount: centsToMoney(originalRequestedAmountCents),
        };
    });
}

export async function getPendingPayoutRequestsCount(): Promise<number> {
    const rows = await storage().query.farmerPayoutRequests.findMany({
        where: eq(farmerPayoutRequests.status, 'pending'),
        columns: { id: true },
    });
    return rows.length;
}

export async function approvePayoutRequest(
    id: number,
    approvedByUserId: string,
    adminNote?: string,
    adjustments?: PayoutAdjustmentInput[],
): Promise<SelectFarmerPayoutRequest> {
    const existing = await getPayoutRequest(id);
    if (!existing) throw new Error('Zahtjev za isplatu nije pronađen.');
    if (existing.status !== 'pending') {
        throw new Error(
            `Nije moguće odobriti zahtjev sa statusom "${existing.status}".`,
        );
    }

    const normalizedAdjustments = normalizePayoutAdjustments(
        adjustments,
        existing.currency,
        approvedByUserId,
    );
    const originalAmountCents = moneyToCents(existing.requestedAmount);
    const adjustmentTotalCents = normalizedAdjustments.reduce(
        (total, adjustment) => total + adjustment.amountCents,
        0,
    );
    const approvedAmountCents = originalAmountCents + adjustmentTotalCents;

    if (approvedAmountCents <= 0) {
        throw new Error('Konačni iznos isplate mora biti veći od nule.');
    }

    const approvedAmount = centsToMoney(approvedAmountCents);

    const row = await storage().transaction(async (tx) => {
        const [updatedRow] = await tx
            .update(farmerPayoutRequests)
            .set({
                requestedAmount: approvedAmount,
                status: 'approved',
                approvedByUserId,
                approvedAt: new Date(),
                adminNote: adminNote ?? null,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(farmerPayoutRequests.id, id),
                    eq(farmerPayoutRequests.status, 'pending'),
                ),
            )
            .returning();

        if (!updatedRow) {
            throw new Error('Zahtjev za isplatu više nije moguće odobriti.');
        }

        if (normalizedAdjustments.length > 0) {
            await tx.insert(farmerPayoutRequestAdjustments).values(
                normalizedAdjustments.map((adjustment) => ({
                    payoutRequestId: id,
                    label: adjustment.label,
                    amount: adjustment.amount,
                    currency: adjustment.currency,
                    createdByUserId: adjustment.createdByUserId,
                })),
            );
        }

        return updatedRow;
    });

    await createEvent(
        knownEvents.payouts.approvedV1(id.toString(), {
            approvedByUserId,
            adminNote,
            originalAmount: originalAmountCents / 100,
            adjustmentTotal: adjustmentTotalCents / 100,
            approvedAmount: approvedAmountCents / 100,
            currency: existing.currency,
            adjustments: normalizedAdjustments.map((adjustment) => ({
                label: adjustment.label,
                amount: adjustment.amountCents / 100,
            })),
        }),
    );

    // Notify the farmer
    await notifyFarmerPayoutStatus(
        existing.userId,
        'approved',
        approvedAmountCents / 100,
        existing.currency,
    );

    return row;
}

export async function rejectPayoutRequest(
    id: number,
    rejectionReason?: string,
): Promise<SelectFarmerPayoutRequest> {
    const existing = await getPayoutRequest(id);
    if (!existing) throw new Error('Zahtjev za isplatu nije pronađen.');
    if (existing.status !== 'pending' && existing.status !== 'approved') {
        throw new Error(
            `Nije moguće odbiti zahtjev sa statusom "${existing.status}".`,
        );
    }

    const [row] = await storage()
        .update(farmerPayoutRequests)
        .set({
            status: 'rejected',
            rejectedAt: new Date(),
            rejectionReason: rejectionReason ?? null,
            updatedAt: new Date(),
        })
        .where(eq(farmerPayoutRequests.id, id))
        .returning();

    await createEvent(
        knownEvents.payouts.rejectedV1(id.toString(), { rejectionReason }),
    );

    // Notify the farmer
    await notifyFarmerPayoutStatus(
        existing.userId,
        'rejected',
        parseFloat(existing.requestedAmount),
        existing.currency,
    );

    return row;
}

export async function markPayoutAsPaid(
    id: number,
    bankReference: string,
    receiptData: {
        businessPin?: string | null;
        businessName?: string | null;
        businessAddress?: string | null;
        farmerName?: string | null;
        farmerPin?: string | null;
        farmerAddress?: string | null;
    },
): Promise<{ payoutRequest: SelectFarmerPayoutRequest; receiptId: number }> {
    const existing = await getPayoutRequest(id);
    if (!existing) throw new Error('Zahtjev za isplatu nije pronađen.');
    if (existing.status !== 'approved') {
        throw new Error(
            `Nije moguće označiti kao plaćeno zahtjev sa statusom "${existing.status}". Zahtjev mora biti odobren.`,
        );
    }

    const paidDate = new Date();

    const receiptId = await createReceipt({
        invoiceId: null,
        subtotal: existing.requestedAmount,
        taxAmount: '0.00',
        totalAmount: existing.requestedAmount,
        currency: existing.currency,
        paymentMethod: 'bank_transfer',
        paymentReference: bankReference,
        businessPin: receiptData.businessPin,
        businessName: receiptData.businessName,
        businessAddress: receiptData.businessAddress,
        customerPin: receiptData.farmerPin,
        customerName: receiptData.farmerName,
        customerAddress: receiptData.farmerAddress,
        issuedAt: paidDate,
    });

    const [row] = await storage()
        .update(farmerPayoutRequests)
        .set({
            status: 'paid',
            paidAt: paidDate,
            bankReference,
            receiptId,
            updatedAt: new Date(),
        })
        .where(eq(farmerPayoutRequests.id, id))
        .returning();

    await createEvent(
        knownEvents.payouts.paidV1(id.toString(), {
            bankReference,
            receiptId,
        }),
    );

    // Notify the farmer
    await notifyFarmerPayoutStatus(
        existing.userId,
        'paid',
        parseFloat(existing.requestedAmount),
        existing.currency,
    );

    return { payoutRequest: row, receiptId };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function notifyFarmerPayoutStatus(
    userId: string,
    status: 'approved' | 'rejected' | 'paid',
    amount: number,
    currency: string,
) {
    try {
        const user = await getUser(userId);
        if (!user?.accounts?.[0]?.account?.id) return;
        const accountId = user.accounts[0].account.id;
        const amountStr = `${amount.toFixed(2)} ${currency.toUpperCase()}`;

        const messages: Record<
            typeof status,
            { header: string; content: string }
        > = {
            approved: {
                header: 'Zahtjev za isplatu odobren',
                content: `Tvoj zahtjev za isplatu ${amountStr} je odobren. Uskoro će biti obrađen.`,
            },
            rejected: {
                header: 'Zahtjev za isplatu odbijen',
                content: `Tvoj zahtjev za isplatu ${amountStr} je odbijen. Kontaktiraj administrator za više informacija.`,
            },
            paid: {
                header: 'Isplata odrađena',
                content: `Isplata u iznosu ${amountStr} je uspješno odrađena na tvoj račun.`,
            },
        };

        const msg = messages[status];
        await createNotification({
            header: msg.header,
            content: msg.content,
            category: 'payout',
            type: 'payout',
            accountId,
            userId,
            timestamp: new Date(),
        });
    } catch {
        // Notification failure should not break the payout flow
    }
}
