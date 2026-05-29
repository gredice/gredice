import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
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
    const [row] = await storage()
        .insert(operationPrices)
        .values(input)
        .onConflictDoUpdate({
            target: [operationPrices.farmId, operationPrices.entityTypeName],
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
    const [prices, completedOperations, payouts] = await Promise.all([
        getOperationPrices(farmId),
        getFarmUserAcceptedOperations(userId, { status: 'completed' }),
        getFarmerPayoutRequests(userId, farmId),
    ]);

    const priceMap = new Map<string, SelectOperationPrice>(
        prices.map((p) => [p.entityTypeName, p]),
    );

    // Group completed operations by entity type and count earnings
    const earningsByType = new Map<string, FarmerEarning>();
    let currency = 'eur';

    for (const op of completedOperations) {
        const opFarmId =
            op.farmId ??
            (op as unknown as { garden?: { farmId?: number } }).garden?.farmId;
        if (opFarmId !== farmId) continue;

        const price = priceMap.get(op.entityTypeName);
        if (!price) continue;

        currency = price.currency;
        const priceValue = parseFloat(price.pricePerUnit);
        const existing = earningsByType.get(op.entityTypeName);

        if (existing) {
            existing.operationCount += 1;
            existing.totalEarned += priceValue;
        } else {
            earningsByType.set(op.entityTypeName, {
                entityTypeName: op.entityTypeName,
                operationCount: 1,
                pricePerUnit: priceValue,
                totalEarned: priceValue,
                currency: price.currency,
            });
        }
    }

    const totalEarned = Array.from(earningsByType.values()).reduce(
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
        earningsByType: Array.from(earningsByType.values()),
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
    // Verify the amount doesn't exceed available balance
    const balance = await getFarmerBalance(userId, farmId);
    if (requestedAmount > balance.availableBalance + 0.001) {
        throw new Error(
            `Zatraženi iznos (${requestedAmount} ${currency.toUpperCase()}) premašuje raspoloživo stanje (${balance.availableBalance.toFixed(2)} ${balance.currency.toUpperCase()}).`,
        );
    }

    if (requestedAmount <= 0) {
        throw new Error('Iznos isplate mora biti veći od nule.');
    }

    const [row] = await storage()
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

    return row;
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

    // Create a receipt for the payout (no invoice — payout receipts are standalone)
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

    return { payoutRequest: row, receiptId };
}
