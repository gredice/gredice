import { eq } from 'drizzle-orm';
import { shoppingCartItems, shoppingCarts } from '../schema/shoppingCartSchema';
import { transactions } from '../schema/transactionSchema';
import { operations } from '../schema/operationsSchema';
import { gardens as dbGardens, gardenBlocks, gardenStacks, raisedBeds as dbRaisedBeds, raisedBedFields, raisedBedSensors } from '../schema/gardenSchema';
import { events } from '../schema/eventsSchema';
import { accountUsers, users } from '../schema/usersSchema';
import { accounts } from '../schema/usersSchema';
import { storage } from '../storage';
import { getAccountGardens, getRaisedBeds, updateRaisedBed } from './gardensRepo';
import { getNotificationsByUser, deleteNotification, getNotificationsByAccount } from './notificationsRepo';

/**
 * Deletes an account and all related entities in the required order.
 * If any step fails, the function can be retried to continue deletion.
 */
export async function deleteAccountWithDependencies(accountId: string, userId: string): Promise<void> {
    try {
        console.info(`[AccountDelete] Starting deletion for accountId=${accountId}, userId=${userId}`);
        const gardens = await getAccountGardens(accountId);

        // 5-8. Deactivate raised beds
        for (const garden of gardens) {
            const raisedBeds = await getRaisedBeds(garden.id);
            for (const raisedBed of raisedBeds) {
                console.info(`[AccountDelete] Abandoning and detaching raised bedId=${raisedBed.id}`);
                await storage().update(dbRaisedBeds).set({
                    status: 'abandoned',
                    accountId: null,
                    gardenId: null,
                    blockId: null,
                }).where(eq(dbRaisedBeds.id, raisedBed.id));

                console.info(`[AccountDelete] Deactivating raised bed sensors for raisedBedId=${raisedBed.id}`);
                const sensors = await storage().query.raisedBedSensors.findMany({ where: eq(raisedBedSensors.raisedBedId, raisedBed.id) });
                for (const sensor of sensors) {
                    await storage().update(raisedBedSensors).set({ isDeleted: true }).where(eq(raisedBedSensors.id, sensor.id));
                }
            }

            // Delete garden stacks, blocks, gardens, garden events
            console.info(`[AccountDelete] Deleting garden stacks for gardenId=${garden.id}`);
            await storage().delete(gardenStacks).where(eq(gardenStacks.gardenId, garden.id));

            console.info(`[AccountDelete] Deleting garden blocks for gardenId=${garden.id}`);
            await storage().delete(gardenBlocks).where(eq(gardenBlocks.gardenId, garden.id));

            console.info(`[AccountDelete] Deleting garden record for gardenId=${garden.id}`);
            await storage().delete(dbGardens).where(eq(dbGardens.id, garden.id));
        }

        // 10. Delete notifications for account
        console.info(`[AccountDelete] Deleting notifications for accountId=${accountId}`);
        const accountNotifications = await getNotificationsByAccount(accountId, false, 0, 10000);
        for (const notification of accountNotifications) {
            await deleteNotification(notification.id);
        }

        // 11. Detach shopping carts from account - set account to null or delete new carts and their items
        console.info(`[AccountDelete] Detaching/deleting shopping carts for accountId=${accountId}`);
        const carts = await storage().query.shoppingCarts.findMany({
            where: eq(shoppingCarts.accountId, accountId)
        });
        for (const cart of carts) {
            if (cart.status !== 'new') {
                await storage().update(shoppingCarts).set({ accountId: null }).where(eq(shoppingCarts.id, cart.id));
            }
            if (cart.status === 'new') {
                const items = await storage().query.shoppingCartItems.findMany({ where: eq(shoppingCartItems.cartId, cart.id) });
                for (const item of items) {
                    await storage().delete(shoppingCartItems).where(eq(shoppingCartItems.id, item.id));
                }
                await storage().delete(shoppingCarts).where(eq(shoppingCarts.id, cart.id));
            }
        }

        // 12. Detach transactions from account - set account to null
        console.info(`[AccountDelete] Detaching transactions for accountId=${accountId}`);
        const txs = await storage().query.transactions.findMany({
            where: eq(transactions.accountId, accountId)
        });
        for (const tx of txs) {
            await storage().update(transactions).set({ accountId: null }).where(eq(transactions.id, tx.id));
        }

        // 13. Detach operations from account - set account to null
        console.info(`[AccountDelete] Detaching operations for accountId=${accountId}`);
        const ops = await storage().query.operations.findMany({ where: eq(operations.accountId, accountId) });
        for (const op of ops) {
            await storage().update(operations).set({ accountId: null }).where(eq(operations.id, op.id));
        }

        // 14. Delete account events
        console.info(`[AccountDelete] Deleting account events for accountId=${accountId}`);
        await storage().delete(events).where(eq(events.aggregateId, accountId));

        // User cleanup (if user is not associated with any other account)
        const userAccounts = await storage().query.accountUsers.findMany({
            where: eq(accountUsers.accountId, accountId)
        });
        if (userAccounts.length === 0) {
            console.info(`[AccountDelete] Deleting notifications and user for userId=${userId}`);
            const userNotifications = await getNotificationsByUser(userId, false, 0, 10000);
            for (const notification of userNotifications) {
                await deleteNotification(notification.id);
            }
            console.info(`[AccountDelete] Deleting user events for userId=${userId}`);
            await storage().delete(events).where(eq(events.aggregateId, userId));

            console.info(`[AccountDelete] Deleting user userId=${userId}`);
            await storage().delete(users).where(eq(users.id, userId));
        }

        // Delete user-account association
        console.info(`[AccountDelete] Deleting user-account association for accountId=${accountId}, userId=${userId}`);
        await storage().delete(accountUsers).where(eq(accountUsers.accountId, accountId));

        // Final - Delete account
        console.info(`[AccountDelete] Deleting account record for accountId=${accountId}`);
        await storage().delete(accounts).where(eq(accounts.id, accountId));
        console.info(`[AccountDelete] Deletion complete for accountId=${accountId}, userId=${userId}`);
    } catch (error) {
        console.error('[AccountDelete] Error deleting account with dependencies:', error);
        throw error; // Re-throw to allow retry logic if needed
    }
}
