import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import {
    type InsertTransaction,
    invoices,
    transactions,
    type UpdateTransaction,
} from '../schema';
import { storage } from '../storage';
import { createEvent, knownEvents } from './eventsRepo';

export async function createTransaction(transaction: InsertTransaction) {
    if (!transaction.accountId) {
        throw new Error('Transaction must have an accountId');
    }

    if (transaction.status === 'completed' && transaction.stripePaymentId) {
        const existing = await getCompletedTransactionByStripePaymentId(
            transaction.stripePaymentId,
        );
        if (existing) {
            return existing.id;
        }
    }

    const transactionId = (
        await storage()
            .insert(transactions)
            .values(transaction)
            .returning({ id: transactions.id })
    )[0].id;

    await createEvent(
        knownEvents.transactions.createdV1(transactionId.toString(), {
            accountId: transaction.accountId,
            amount: transaction.amount,
            currency: transaction.currency,
            status: transaction.status,
        }),
    );

    return transactionId;
}

export async function getCompletedTransactionByStripePaymentId(
    stripePaymentId: string,
) {
    return storage().query.transactions.findFirst({
        where: and(
            eq(transactions.stripePaymentId, stripePaymentId),
            eq(transactions.status, 'completed'),
            eq(transactions.isDeleted, false),
        ),
    });
}

export async function withStripePaymentProcessingLock<T>(
    stripePaymentId: string,
    callback: () => Promise<T>,
) {
    return storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`stripe-payment:${stripePaymentId}`}));`,
        );

        return callback();
    });
}

export async function getTransaction(transactionId: number) {
    return storage().query.transactions.findFirst({
        where: and(
            eq(transactions.id, transactionId),
            eq(transactions.isDeleted, false),
        ),
        with: {
            invoices: true,
        },
    });
}

export async function getAllTransactions({
    filter,
}: {
    filter?: { accountId?: string };
} = {}) {
    return storage().query.transactions.findMany({
        where: and(
            filter?.accountId
                ? eq(transactions.accountId, filter.accountId)
                : undefined,
            eq(transactions.isDeleted, false),
        ),
        with: {
            invoices: {
                where: eq(invoices.isDeleted, false),
            },
        },
        orderBy: transactions.createdAt,
    });
}

export async function getTransactionByStripeId(stripePaymentId: string) {
    return storage().query.transactions.findFirst({
        where: and(
            eq(transactions.stripePaymentId, stripePaymentId),
            eq(transactions.isDeleted, false),
        ),
        with: {
            invoices: true,
        },
    });
}

export async function updateTransaction(transaction: UpdateTransaction) {
    await storage()
        .update(transactions)
        .set(transaction)
        .where(
            and(
                eq(transactions.id, transaction.id),
                eq(transactions.isDeleted, false),
            ),
        );

    if (transaction.status) {
        await createEvent(
            knownEvents.transactions.updatedV1(transaction.id.toString(), {
                status: transaction.status,
            }),
        );
    }
}

export async function deleteTransaction(transactionId: number) {
    await storage()
        .update(transactions)
        .set({ isDeleted: true })
        .where(eq(transactions.id, transactionId));

    await createEvent(
        knownEvents.transactions.deletedV1(transactionId.toString()),
    );
}
