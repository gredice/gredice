import 'server-only';
import { and, eq } from "drizzle-orm";
import { transactions, transactionEntities, InsertTransaction, UpdateTransaction, InsertTransactionEntity } from "../schema";
import { storage } from "../storage";
import { createEvent, knownEvents } from "./eventsRepo";

export async function createTransaction(transaction: InsertTransaction, entities?: InsertTransactionEntity[]) {
    const transactionId = (await storage
        .insert(transactions)
        .values(transaction)
        .returning({ id: transactions.id }))[0].id;

    if (entities && entities.length > 0) {
        const transactionEntitiesData = entities.map(entity => ({
            ...entity,
            transactionId,
        }));
        await storage.insert(transactionEntities).values(transactionEntitiesData);
    }

    await createEvent(knownEvents.transactions.createdV1(transactionId.toString(), {
        accountId: transaction.accountId,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
    }));

    return transactionId;
}

export async function getTransaction(transactionId: number) {
    return storage.query.transactions.findFirst({
        where: and(eq(transactions.id, transactionId), eq(transactions.isDeleted, false)),
        with: {
            transactionEntities: true,
        },
    });
}

export async function getTransactions(accountId: string) {
    return storage.query.transactions.findMany({
        where: and(eq(transactions.accountId, accountId), eq(transactions.isDeleted, false)),
        with: {
            transactionEntities: true,
        },
    });
}

export async function getAllTransactions() {
    return storage.query.transactions.findMany({
        where: eq(transactions.isDeleted, false),
        with: {
            transactionEntities: true,
        },
    });
}

export async function getTransactionByStripeId(stripePaymentId: string) {
    return storage.query.transactions.findFirst({
        where: and(eq(transactions.stripePaymentId, stripePaymentId), eq(transactions.isDeleted, false)),
        with: {
            transactionEntities: true,
        },
    });
}

export async function updateTransaction(transaction: UpdateTransaction) {
    await storage
        .update(transactions)
        .set(transaction)
        .where(
            and(
                eq(transactions.id, transaction.id),
                eq(transactions.isDeleted, false)
            ));

    if (transaction.status) {
        await createEvent(knownEvents.transactions.updatedV1(transaction.id.toString(), {
            status: transaction.status,
        }));
    }
}

export async function deleteTransaction(transactionId: number) {
    await storage
        .update(transactions)
        .set({ isDeleted: true })
        .where(eq(transactions.id, transactionId));

    await createEvent(knownEvents.transactions.deletedV1(transactionId.toString()));
}