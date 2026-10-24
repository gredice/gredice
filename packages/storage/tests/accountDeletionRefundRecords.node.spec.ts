import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { and, eq } from 'drizzle-orm';
import {
    AccountDeletionRequiresReviewError,
    accountDeletionStartedEventType,
    deleteAccountWithDependencies,
    fenceAccountShoppingCartsForDeletion,
    knownEventTypes,
} from '../src';
import {
    accounts,
    accountUsers,
    events,
    invoiceItems,
    invoices,
    operations,
    shoppingCarts,
    sunflowerLedgerEntries,
    transactions,
    users,
} from '../src/schema';
import { storage } from '../src/storage';
import { createTestDb } from './testDb';

for (const history of [
    'ledger',
    'invoice',
    'transaction',
    'legacy-credit',
    'operation',
    'submitted-cart',
]) {
    test(`account deletion preserves ${history} and leaves the account usable`, async () => {
        createTestDb();
        const accountId = randomUUID();
        const userId = randomUUID();
        await storage().insert(accounts).values({ id: accountId });
        await storage()
            .insert(users)
            .values({
                id: userId,
                role: 'user',
                userName: `${userId}@example.test`,
            });
        await storage().insert(accountUsers).values({ accountId, userId });
        const [cart] = await storage()
            .insert(shoppingCarts)
            .values({ accountId, status: 'new' })
            .returning();

        if (history === 'ledger') {
            // Even an exhausted balance must retain its original payment trail.
            await storage().insert(sunflowerLedgerEntries).values({
                accountId,
                entryType: 'top_up',
                amount: 1000,
                amountEur: '1.00',
                availableDelta: 1000,
                reservedDelta: 0,
                availableBalanceAfter: 0,
                reservedBalanceAfter: 0,
                totalBalanceAfter: 0,
                idempotencyKey: randomUUID(),
            });
        } else if (history === 'invoice') {
            const [invoice] = await storage()
                .insert(invoices)
                .values({
                    accountId,
                    invoiceNumber: randomUUID(),
                    billToEmail: `${userId}@example.test`,
                    subtotal: '1.00',
                    totalAmount: '1.00',
                    status: 'paid',
                    issueDate: new Date(),
                    dueDate: new Date(),
                })
                .returning();
            await storage().insert(invoiceItems).values({
                invoiceId: invoice.id,
                description: 'Paid sunflower package',
                quantity: '1.00',
                unitPrice: '1.00',
                totalPrice: '1.00',
            });
        } else if (history === 'transaction') {
            await storage().insert(transactions).values({
                accountId,
                stripePaymentId: randomUUID(),
                amount: 100,
                currency: 'eur',
                status: 'paid',
            });
        } else if (history === 'legacy-credit') {
            await storage()
                .insert(events)
                .values({
                    aggregateId: accountId,
                    type: knownEventTypes.accounts.earnSunflowers,
                    data: { amount: 1000, reason: 'legacy purchase' },
                    version: 1,
                });
        } else if (history === 'operation') {
            await storage().insert(operations).values({
                accountId,
                entityId: 1,
                entityTypeName: 'operation',
            });
        } else if (history === 'submitted-cart') {
            await storage()
                .update(shoppingCarts)
                .set({ status: 'paid' })
                .where(eq(shoppingCarts.id, cart.id));
        }

        async function snapshot() {
            return {
                account: await storage().query.accounts.findFirst({
                    where: eq(accounts.id, accountId),
                }),
                user: await storage().query.users.findFirst({
                    where: eq(users.id, userId),
                }),
                membership: await storage().query.accountUsers.findMany({
                    where: eq(accountUsers.accountId, accountId),
                }),
                carts: await storage().query.shoppingCarts.findMany({
                    where: eq(shoppingCarts.accountId, accountId),
                }),
                ledger: await storage().query.sunflowerLedgerEntries.findMany({
                    where: eq(sunflowerLedgerEntries.accountId, accountId),
                }),
                invoices: await storage().query.invoices.findMany({
                    where: eq(invoices.accountId, accountId),
                    with: { invoiceItems: true },
                }),
                transactions: await storage().query.transactions.findMany({
                    where: eq(transactions.accountId, accountId),
                }),
                operations: await storage().query.operations.findMany({
                    where: eq(operations.accountId, accountId),
                }),
                events: await storage().query.events.findMany({
                    where: eq(events.aggregateId, accountId),
                }),
            };
        }

        const before = await snapshot();
        for (let attempt = 0; attempt < 2; attempt++) {
            await assert.rejects(
                () => deleteAccountWithDependencies(accountId, userId),
                AccountDeletionRequiresReviewError,
            );
            // The exported fencing entrypoint must not bypass this safeguard.
            await assert.rejects(
                () => fenceAccountShoppingCartsForDeletion(accountId),
                AccountDeletionRequiresReviewError,
            );
            assert.deepEqual(await snapshot(), before);
            assert.equal(
                await storage().query.events.findFirst({
                    where: and(
                        eq(events.aggregateId, accountId),
                        eq(events.type, accountDeletionStartedEventType),
                    ),
                }),
                undefined,
            );
        }
    });
}
