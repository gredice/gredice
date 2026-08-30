import { eq, inArray } from 'drizzle-orm';
import { bustScheduleCache } from '../cache/scheduleCache';
import { accountAchievements } from '../schema/achievementsSchema';
import { events } from '../schema/eventsSchema';
import {
    gardens as dbGardens,
    raisedBeds as dbRaisedBeds,
    gardenBlocks,
    gardenStacks,
    gardenStructureOperations,
    gardenStructures,
    raisedBedSensors,
} from '../schema/gardenSchema';
import { operations } from '../schema/operationsSchema';
import { shoppingCartItems, shoppingCarts } from '../schema/shoppingCartSchema';
import { transactions } from '../schema/transactionSchema';
import { accounts, accountUsers, users } from '../schema/usersSchema';
import { storage } from '../storage';
import {
    lockAccountForDeletionLifecycle,
    markAccountDeletionStarted,
} from './accountDeletionFenceRepo';
import { withCheckoutCartItemLocks } from './checkoutCartItemLock';
import {
    deleteNotification,
    getNotificationsByAccount,
    getNotificationsByUser,
} from './notificationsRepo';
import { lockAndAssertShoppingCartsMutable } from './stripeCheckoutAttemptRepo';
import { deleteUserAuthenticationData } from './usersRepo';

export async function fenceAccountShoppingCartsForDeletion(accountId: string) {
    const expectedCarts = await storage().query.shoppingCarts.findMany({
        where: eq(shoppingCarts.accountId, accountId),
    });
    const expectedCartIds = expectedCarts.map((cart) => cart.id);
    const items =
        expectedCartIds.length > 0
            ? await storage().query.shoppingCartItems.findMany({
                  where: inArray(shoppingCartItems.cartId, expectedCartIds),
              })
            : [];

    return withCheckoutCartItemLocks(
        items.map((item) => item.id),
        async (db) => {
            const account = await lockAccountForDeletionLifecycle(
                accountId,
                db,
            );
            if (!account) {
                return false;
            }
            await lockAndAssertShoppingCartsMutable(expectedCartIds, db);
            const liveCarts = await db.query.shoppingCarts.findMany({
                where: eq(shoppingCarts.accountId, accountId),
            });
            const expectedCartIdSet = new Set(expectedCartIds);
            if (
                liveCarts.length !== expectedCartIds.length ||
                liveCarts.some((cart) => !expectedCartIdSet.has(cart.id))
            ) {
                throw new Error(
                    `Shopping carts changed while fencing account ${accountId} for deletion.`,
                );
            }

            await markAccountDeletionStarted(accountId, db);

            const newCartIds = liveCarts.flatMap((cart) =>
                cart.status === 'new' ? [cart.id] : [],
            );
            const retainedCartIds = liveCarts.flatMap((cart) =>
                cart.status === 'new' ? [] : [cart.id],
            );
            if (newCartIds.length > 0) {
                await db
                    .delete(shoppingCartItems)
                    .where(inArray(shoppingCartItems.cartId, newCartIds));
                await db
                    .delete(shoppingCarts)
                    .where(inArray(shoppingCarts.id, newCartIds));
            }
            if (retainedCartIds.length > 0) {
                await db
                    .update(shoppingCarts)
                    .set({ accountId: null })
                    .where(inArray(shoppingCarts.id, retainedCartIds));
            }
            return true;
        },
    );
}

/**
 * Deletes an account and all related entities in the required order.
 * If any step fails, the function can be retried to continue deletion.
 */
export async function deleteAccountWithDependencies(
    accountId: string,
    userId: string,
): Promise<void> {
    let hasScheduleAffectingChanges = false;

    async function bustScheduleCacheIfNeeded(context: string) {
        if (!hasScheduleAffectingChanges) {
            return;
        }

        try {
            await bustScheduleCache();
        } catch (cacheError) {
            console.error(
                `[AccountDelete] Error busting schedule cache ${context}:`,
                cacheError,
            );
        }
    }

    try {
        console.info(
            `[AccountDelete] Starting deletion for accountId=${accountId}, userId=${userId}`,
        );

        // Fence every account cart in one transaction before touching gardens,
        // notifications, or any other account data. If a checkout snapshot won
        // the race, the whole transaction rolls back and deletion has made no
        // destructive changes. If deletion wins, later snapshot creation sees
        // a detached or deleted cart and fails before Stripe session creation.
        console.info(
            `[AccountDelete] Detaching/deleting shopping carts for accountId=${accountId}`,
        );
        await fenceAccountShoppingCartsForDeletion(accountId);

        // Account deletion must include soft-deleted gardens. The customer
        // garden list intentionally excludes them, but they still retain their
        // account foreign key until this cleanup permanently removes them.
        const gardens = await storage().query.gardens.findMany({
            where: eq(dbGardens.accountId, accountId),
        });
        if (gardens.length > 0) {
            hasScheduleAffectingChanges = true;
        }

        // 5-8. Deactivate raised beds
        for (const garden of gardens) {
            // Include already soft-deleted projections. They deliberately keep
            // their garden/block foreign keys for history, so skipping them
            // would make the later physical garden cleanup fail forever.
            const raisedBeds = await storage().query.raisedBeds.findMany({
                where: eq(dbRaisedBeds.gardenId, garden.id),
            });
            for (const raisedBed of raisedBeds) {
                console.info(
                    `[AccountDelete] Abandoning and detaching raised bedId=${raisedBed.id}`,
                );
                await storage()
                    .update(dbRaisedBeds)
                    .set({
                        status: 'abandoned',
                        accountId: null,
                        gardenId: null,
                        blockId: null,
                    })
                    .where(eq(dbRaisedBeds.id, raisedBed.id));

                console.info(
                    `[AccountDelete] Deactivating raised bed sensors for raisedBedId=${raisedBed.id}`,
                );
                const sensors = await storage().query.raisedBedSensors.findMany(
                    { where: eq(raisedBedSensors.raisedBedId, raisedBed.id) },
                );
                for (const sensor of sensors) {
                    await storage()
                        .update(raisedBedSensors)
                        .set({ isDeleted: true })
                        .where(eq(raisedBedSensors.id, sensor.id));
                }
            }

            console.info('[AccountDelete] Deleting garden structure receipts', {
                gardenId: garden.id,
            });
            await storage()
                .delete(gardenStructureOperations)
                .where(eq(gardenStructureOperations.gardenId, garden.id));

            console.info('[AccountDelete] Deleting garden structures', {
                gardenId: garden.id,
            });
            await storage()
                .delete(gardenStructures)
                .where(eq(gardenStructures.gardenId, garden.id));

            // Delete garden stacks, blocks, gardens, garden events
            console.info(
                `[AccountDelete] Deleting garden stacks for gardenId=${garden.id}`,
            );
            await storage()
                .delete(gardenStacks)
                .where(eq(gardenStacks.gardenId, garden.id));

            console.info(
                `[AccountDelete] Deleting garden blocks for gardenId=${garden.id}`,
            );
            await storage()
                .delete(gardenBlocks)
                .where(eq(gardenBlocks.gardenId, garden.id));

            console.info(
                `[AccountDelete] Deleting garden record for gardenId=${garden.id}`,
            );
            await storage()
                .delete(dbGardens)
                .where(eq(dbGardens.id, garden.id));
        }

        // 10. Delete notifications for account
        console.info(
            `[AccountDelete] Deleting notifications for accountId=${accountId}`,
        );
        const accountNotifications = await getNotificationsByAccount(
            accountId,
            false,
            0,
            10000,
        );
        for (const notification of accountNotifications) {
            await deleteNotification(notification.id);
        }

        // 12. Detach transactions from account - set account to null
        console.info(
            `[AccountDelete] Detaching transactions for accountId=${accountId}`,
        );
        const txs = await storage().query.transactions.findMany({
            where: eq(transactions.accountId, accountId),
        });
        for (const tx of txs) {
            await storage()
                .update(transactions)
                .set({ accountId: null })
                .where(eq(transactions.id, tx.id));
        }

        // 13. Detach operations from account - set account to null
        console.info(
            `[AccountDelete] Detaching operations for accountId=${accountId}`,
        );
        const ops = await storage().query.operations.findMany({
            where: eq(operations.accountId, accountId),
        });
        if (ops.length > 0) {
            hasScheduleAffectingChanges = true;
        }
        for (const op of ops) {
            await storage()
                .update(operations)
                .set({ accountId: null })
                .where(eq(operations.id, op.id));
        }

        console.info(
            `[AccountDelete] Deleting achievements for accountId=${accountId}`,
        );
        await storage()
            .delete(accountAchievements)
            .where(eq(accountAchievements.accountId, accountId));
        // Delete user-account association
        console.info(
            `[AccountDelete] Deleting user-account association for accountId=${accountId}, userId=${userId}`,
        );
        await storage()
            .delete(accountUsers)
            .where(eq(accountUsers.accountId, accountId));

        // User cleanup (if user is not associated with any other account)
        const remainingUserAccounts =
            await storage().query.accountUsers.findMany({
                where: eq(accountUsers.userId, userId),
            });
        if (remainingUserAccounts.length === 0) {
            console.info(
                `[AccountDelete] Deleting notifications and user for userId=${userId}`,
            );
            const userNotifications = await getNotificationsByUser(
                userId,
                false,
                0,
                10000,
            );
            for (const notification of userNotifications) {
                await deleteNotification(notification.id);
            }
            console.info(
                `[AccountDelete] Deleting user events for userId=${userId}`,
            );
            await storage()
                .delete(events)
                .where(eq(events.aggregateId, userId));

            console.info(
                `[AccountDelete] Deleting authentication data for userId=${userId}`,
            );
            await deleteUserAuthenticationData(userId);

            console.info(`[AccountDelete] Deleting user userId=${userId}`);
            await storage().delete(users).where(eq(users.id, userId));
        }

        // Final - Delete account
        console.info(
            `[AccountDelete] Deleting account events and record for accountId=${accountId}`,
        );
        await storage().transaction(async (db) => {
            await lockAccountForDeletionLifecycle(accountId, db);
            await db.delete(events).where(eq(events.aggregateId, accountId));
            await db.delete(accounts).where(eq(accounts.id, accountId));
        });
        await bustScheduleCacheIfNeeded('after account deletion');
        console.info(
            `[AccountDelete] Deletion complete for accountId=${accountId}, userId=${userId}`,
        );
    } catch (error) {
        console.error(
            '[AccountDelete] Error deleting account with dependencies:',
            error,
        );
        await bustScheduleCacheIfNeeded('after partial deletion');
        throw error; // Re-throw to allow retry logic if needed
    }
}
