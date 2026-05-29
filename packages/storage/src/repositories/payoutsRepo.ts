import 'server-only';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
    type InsertFarmerPayoutRequest,
    type InsertOperationPrice,
    farmerPayoutRequests,
    type PayoutStatus,
    operationPrices,
    type SelectFarmerPayoutRequest,
    type SelectOperationPrice,
} from '../schema';
import { storage } from '../storage';
import { createReceipt } from './invoicesRepo';
import { getFarmUserAcceptedOperations } from './operationsRepo';
import { getRaisedBedFieldPlantCycles } from './gardensRepo';
import { createEvent, knownEvents } from './eventsRepo';
import { createNotification } from './notificationsRepo';
import { getUser } from './usersRepo';
import { farmUsers, gardens, raisedBeds } from '../schema';

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
    const isEntitySpecific = input.entityId !== null && input.entityId !== undefined;

    const [row] = await storage()
        .insert(operationPrices)
        .values(input)
        .onConflictDoUpdate({
            target: isEntitySpecific
                ? [operationPrices.farmId, operationPrices.entityTypeName, operationPrices.entityId]
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
    await storage()
        .delete(operationPrices)
        .where(eq(operationPrices.id, id));
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

// Returns one entry per verified sowing cycle, with the farmId it belongs to
async function getVerifiedSowingsForFarmer(
    userId: string,
): Promise<{ farmId: number; sowingLocation: string }[]> {
    const raisedBedRows = await storage()
        .select({
            raisedBedId: raisedBeds.id,
            farmId: gardens.farmId,
        })
        .from(raisedBeds)
        .innerJoin(gardens, eq(raisedBeds.gardenId, gardens.id))
        .innerJoin(farmUsers, eq(gardens.farmId, farmUsers.farmId))
        .where(
            and(
                eq(farmUsers.userId, userId),
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
            }));
        }),
    );

    return allCycles
        .flat()
        .filter(
            (c) =>
                c.plantStatus !== undefined &&
                VERIFIED_SOWING_STATUSES.has(c.plantStatus),
        );
}

// ── Farmer Balance ────────────────────────────────────────────────────────────

export type FarmerEarning = {
    entityTypeName: string;
    entityTypeLabel?: string;
    operationCount: number;
    pricePerUnit: number;
    totalEarned: number;
    currency: string;
};

export type FarmerBalance = {
    totalEarned: number;
    totalPaid: number;
    totalPending: number;
    availableBalance: number;
    currency: string;
    earningsByType: FarmerEarning[];
};

export async function getFarmerBalance(
    userId: string,
    farmId: number,
): Promise<FarmerBalance> {
    const [prices, completedOperations, payouts, verifiedSowings] =
        await Promise.all([
            getOperationPrices(farmId),
            getFarmUserAcceptedOperations(userId, { status: 'completed' }),
            getFarmerPayoutRequests(userId, farmId),
            getVerifiedSowingsForFarmer(userId),
        ]);

    // Two maps: entityId-keyed (for specific operations) and typeName-keyed (for sowing)
    const priceByEntityId = new Map<number, SelectOperationPrice>(
        prices
            .filter((p) => p.entityId !== null)
            .map((p) => [p.entityId as number, p]),
    );
    const priceByTypeName = new Map<string, SelectOperationPrice>(
        prices.filter((p) => p.entityId === null).map((p) => [p.entityTypeName, p]),
    );

    const earningsByKey = new Map<string, FarmerEarning>();
    let currency = 'eur';

    // Operations
    for (const op of completedOperations) {
        const opFarmId =
            op.farmId ??
            (op as unknown as { garden?: { farmId?: number } }).garden?.farmId;
        if (opFarmId !== farmId) continue;

        // Look up price by entityId first, then fall back to entityTypeName
        const price =
            priceByEntityId.get(op.entityId) ??
            priceByTypeName.get(op.entityTypeName);
        if (!price) continue;

        currency = price.currency;
        const priceValue = parseFloat(price.pricePerUnit);
        const key = `operation:${op.entityId}`;
        const existing = earningsByKey.get(key);

        if (existing) {
            existing.operationCount += 1;
            existing.totalEarned += priceValue;
        } else {
            earningsByKey.set(key, {
                entityTypeName: op.entityTypeName,
                operationCount: 1,
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
            existing.totalEarned += priceValue;
        } else {
            earningsByKey.set(typeName, {
                entityTypeName: typeName,
                operationCount: 1,
                pricePerUnit: priceValue,
                totalEarned: priceValue,
                currency: price.currency,
            });
        }
    }

    const totalEarned = Array.from(earningsByKey.values()).reduce(
        (acc, e) => acc + e.totalEarned,
        0,
    );

    const totalPaid = payouts
        .filter((p) => p.status === 'paid')
        .reduce((acc, p) => acc + parseFloat(p.requestedAmount), 0);

    const totalPending = payouts
        .filter((p) => p.status === 'pending' || p.status === 'approved')
        .reduce((acc, p) => acc + parseFloat(p.requestedAmount), 0);

    const availableBalance = Math.max(
        0,
        totalEarned - totalPaid - totalPending,
    );

    return {
        totalEarned,
        totalPaid,
        totalPending,
        availableBalance,
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

export type PayoutRequestWithDetails = SelectFarmerPayoutRequest & {
    userName: string;
    displayName: string | null;
    avatarUrl: string | null;
    farmName: string;
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
        },
    });

    return rows.map((row) => ({
        ...row,
        userName: row.user?.userName ?? '',
        displayName: row.user?.displayName ?? null,
        avatarUrl: row.user?.avatarUrl ?? null,
        farmName: row.farm?.name ?? '',
    }));
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
): Promise<SelectFarmerPayoutRequest> {
    const existing = await getPayoutRequest(id);
    if (!existing) throw new Error('Zahtjev za isplatu nije pronađen.');
    if (existing.status !== 'pending') {
        throw new Error(
            `Nije moguće odobriti zahtjev sa statusom "${existing.status}".`,
        );
    }

    const [row] = await storage()
        .update(farmerPayoutRequests)
        .set({
            status: 'approved',
            approvedByUserId,
            approvedAt: new Date(),
            adminNote: adminNote ?? null,
            updatedAt: new Date(),
        })
        .where(eq(farmerPayoutRequests.id, id))
        .returning();

    await createEvent(
        knownEvents.payouts.approvedV1(id.toString(), {
            approvedByUserId,
            adminNote,
        }),
    );

    // Notify the farmer
    await notifyFarmerPayoutStatus(existing.userId, 'approved', parseFloat(existing.requestedAmount), existing.currency);

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
    await notifyFarmerPayoutStatus(existing.userId, 'rejected', parseFloat(existing.requestedAmount), existing.currency);

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
    await notifyFarmerPayoutStatus(existing.userId, 'paid', parseFloat(existing.requestedAmount), existing.currency);

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

        const messages: Record<typeof status, { header: string; content: string }> = {
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
