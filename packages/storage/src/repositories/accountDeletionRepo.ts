import { and, eq, inArray, or, type SQL } from 'drizzle-orm';
import { bustScheduleCache } from '../cache/scheduleCache';
import { accountAchievements } from '../schema/achievementsSchema';
import {
    aiAccountLimitOverrides,
    aiChatConversations,
    aiUsageLedger,
} from '../schema/aiChatSchema';
import { deliveryAddresses, deliveryRunStops } from '../schema/deliverySchema';
import { events } from '../schema/eventsSchema';
import {
    gardens as dbGardens,
    raisedBeds as dbRaisedBeds,
    gardenBlocks,
    gardenStacks,
    gardenStructureOperations,
    gardenStructures,
    gardenVisitStates,
    raisedBedSensors,
} from '../schema/gardenSchema';
import {
    harvestTraceLinks,
    harvestTraceScans,
} from '../schema/harvestTraceSchema';
import { invoiceItems, invoices, receipts } from '../schema/invoiceSchema';
import {
    notificationEmailLog,
    notifications,
} from '../schema/notificationsSchema';
import { operations } from '../schema/operationsSchema';
import { outletOfferReservations } from '../schema/outletSchema';
import { shoppingCartItems, shoppingCarts } from '../schema/shoppingCartSchema';
import { sunflowerLedgerEntries } from '../schema/sunflowerLedgerSchema';
import { transactions } from '../schema/transactionSchema';
import {
    accountInvitations,
    accounts,
    accountUsers,
    users,
} from '../schema/usersSchema';
import { storage } from '../storage';
import {
    lockAccountForDeletionLifecycle,
    markAccountDeletionStarted,
} from './accountDeletionFenceRepo';
import { withCheckoutCartItemLocks } from './checkoutCartItemLock';
import { knownEventTypes } from './eventsRepo';
import {
    getGardenBoxInventoryAggregateId,
    getInventoryAggregateId,
} from './inventoryRepo';
import { lockAndAssertShoppingCartsMutable } from './stripeCheckoutAttemptRepo';
import { deleteUserAuthenticationData } from './usersRepo';

const GARDEN_EVENT_TYPES = Object.values(knownEventTypes.gardens);
const INVENTORY_EVENT_TYPES = Object.values(knownEventTypes.inventory);

async function deleteNotificationsMatching(where: SQL) {
    await storage().transaction(async (db) => {
        const notificationIds = db
            .select({ id: notifications.id })
            .from(notifications)
            .where(where);
        await db
            .delete(notificationEmailLog)
            .where(
                inArray(notificationEmailLog.notificationId, notificationIds),
            );
        await db.delete(notifications).where(where);
    });
}

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

            // Reservations retain hard FKs to the account, cart, and cart item.
            // Remove them while the same cart/item locks are held, before a new
            // cart or item can be physically deleted.
            const reservationConditions: SQL[] = [
                eq(outletOfferReservations.accountId, accountId),
            ];
            if (expectedCartIds.length > 0) {
                reservationConditions.push(
                    inArray(outletOfferReservations.cartId, expectedCartIds),
                );
            }
            if (items.length > 0) {
                reservationConditions.push(
                    inArray(
                        outletOfferReservations.cartItemId,
                        items.map((item) => item.id),
                    ),
                );
            }
            const reservationWhere = or(...reservationConditions);
            if (reservationWhere) {
                await db
                    .delete(outletOfferReservations)
                    .where(reservationWhere);
            }

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
                    .update(shoppingCartItems)
                    .set({ gardenId: null, raisedBedId: null })
                    .where(inArray(shoppingCartItems.cartId, retainedCartIds));
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

        const gardenAggregateIds = gardens.map((garden) =>
            garden.id.toString(),
        );
        const gardenBoxInventoryAggregateIds: string[] = [];
        const ownedGardenBlocks: Array<{
            id: string;
            gardenId: number;
            name: string;
        }> = [];
        for (const garden of gardens) {
            const blocks = await storage().query.gardenBlocks.findMany({
                where: eq(gardenBlocks.gardenId, garden.id),
            });
            ownedGardenBlocks.push(...blocks);
            gardenBoxInventoryAggregateIds.push(
                ...blocks
                    .filter((block) => block.name === 'GardenBox')
                    .map((block) =>
                        getGardenBoxInventoryAggregateId({
                            accountId,
                            gardenId: garden.id,
                            blockId: block.id,
                        }),
                    ),
            );
        }

        const inventoryAggregateIds = [
            getInventoryAggregateId(accountId),
            ...gardenBoxInventoryAggregateIds,
        ];
        console.info(
            `[AccountDelete] Deleting inventory events for accountId=${accountId}`,
        );
        await storage()
            .delete(events)
            .where(
                and(
                    inArray(events.type, INVENTORY_EVENT_TYPES),
                    inArray(events.aggregateId, inventoryAggregateIds),
                ),
            );

        if (gardenAggregateIds.length > 0) {
            console.info(
                `[AccountDelete] Deleting garden events for accountId=${accountId}`,
            );
            await storage()
                .delete(events)
                .where(
                    and(
                        inArray(events.type, GARDEN_EVENT_TYPES),
                        inArray(events.aggregateId, gardenAggregateIds),
                    ),
                );
        }

        const gardenIds = gardens.map((garden) => garden.id);
        const gardenBlockIds = ownedGardenBlocks.map((block) => block.id);
        const raisedBedWhere =
            gardenIds.length > 0
                ? or(
                      eq(dbRaisedBeds.accountId, accountId),
                      inArray(dbRaisedBeds.gardenId, gardenIds),
                  )
                : eq(dbRaisedBeds.accountId, accountId);
        const raisedBeds = await storage().query.raisedBeds.findMany({
            where: raisedBedWhere,
        });
        const raisedBedIds = raisedBeds.map((raisedBed) => raisedBed.id);

        // Delete account-owned notifications, plus any notification whose FK
        // targets a garden dependency being physically removed. Email log rows
        // do not cascade and must be removed first in the same transaction.
        console.info(
            `[AccountDelete] Deleting notifications for accountId=${accountId}`,
        );
        const notificationConditions: SQL[] = [
            eq(notifications.accountId, accountId),
        ];
        if (gardenIds.length > 0) {
            notificationConditions.push(
                inArray(notifications.gardenId, gardenIds),
            );
        }
        if (raisedBedIds.length > 0) {
            notificationConditions.push(
                inArray(notifications.raisedBedId, raisedBedIds),
            );
        }
        if (gardenBlockIds.length > 0) {
            notificationConditions.push(
                inArray(notifications.blockId, gardenBlockIds),
            );
        }
        const notificationWhere = or(...notificationConditions);
        if (notificationWhere) {
            await deleteNotificationsMatching(notificationWhere);
        }

        // AI conversations and usage are account-owned personal data. Delete
        // them before gardens; detach only cross-account conversations that
        // happen to retain an FK to a garden dependency being erased.
        await storage()
            .delete(aiUsageLedger)
            .where(eq(aiUsageLedger.accountId, accountId));
        await storage()
            .delete(aiChatConversations)
            .where(eq(aiChatConversations.accountId, accountId));
        if (gardenIds.length > 0) {
            await storage()
                .update(aiChatConversations)
                .set({ gardenId: null })
                .where(inArray(aiChatConversations.gardenId, gardenIds));
        }
        if (raisedBedIds.length > 0) {
            await storage()
                .update(aiChatConversations)
                .set({ raisedBedId: null })
                .where(inArray(aiChatConversations.raisedBedId, raisedBedIds));
        }
        await storage()
            .delete(aiAccountLimitOverrides)
            .where(eq(aiAccountLimitOverrides.accountId, accountId));

        const visitStateConditions: SQL[] = [
            eq(gardenVisitStates.accountId, accountId),
        ];
        if (gardenIds.length > 0) {
            visitStateConditions.push(
                inArray(gardenVisitStates.gardenId, gardenIds),
            );
        }
        const visitStateWhere = or(...visitStateConditions);
        if (visitStateWhere) {
            await storage().delete(gardenVisitStates).where(visitStateWhere);
        }

        // Trace links are account-owned records with non-null garden/bed FKs.
        // Preserve delivery history by detaching its nullable pointer, then
        // remove scans before their parent links.
        const traceConditions: SQL[] = [
            eq(harvestTraceLinks.accountId, accountId),
        ];
        if (gardenIds.length > 0) {
            traceConditions.push(
                inArray(harvestTraceLinks.gardenId, gardenIds),
            );
        }
        if (raisedBedIds.length > 0) {
            traceConditions.push(
                inArray(harvestTraceLinks.raisedBedId, raisedBedIds),
            );
        }
        const traceWhere = or(...traceConditions);
        if (traceWhere) {
            await storage().transaction(async (db) => {
                const traceLinkIds = db
                    .select({ id: harvestTraceLinks.id })
                    .from(harvestTraceLinks)
                    .where(traceWhere);
                await db
                    .update(deliveryRunStops)
                    .set({ pickupTraceLinkId: null })
                    .where(
                        inArray(
                            deliveryRunStops.pickupTraceLinkId,
                            traceLinkIds,
                        ),
                    );
                await db
                    .delete(harvestTraceScans)
                    .where(
                        inArray(
                            harvestTraceScans.harvestTraceLinkId,
                            traceLinkIds,
                        ),
                    );
                await db.delete(harvestTraceLinks).where(traceWhere);
            });
        }

        // Retain paid/commercial history, but remove garden/bed FKs before the
        // referenced garden rows are physically deleted.
        if (gardenIds.length > 0) {
            await storage()
                .update(shoppingCartItems)
                .set({ gardenId: null })
                .where(inArray(shoppingCartItems.gardenId, gardenIds));
        }
        if (raisedBedIds.length > 0) {
            await storage()
                .update(shoppingCartItems)
                .set({ raisedBedId: null })
                .where(inArray(shoppingCartItems.raisedBedId, raisedBedIds));
        }

        await storage()
            .update(transactions)
            .set({ accountId: null, gardenId: null })
            .where(eq(transactions.accountId, accountId));
        if (gardenIds.length > 0) {
            await storage()
                .update(transactions)
                .set({ gardenId: null })
                .where(inArray(transactions.gardenId, gardenIds));
        }

        // Deactivate and detach every account-owned or garden-owned raised bed,
        // including already soft-deleted projections.
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
            const sensors = await storage().query.raisedBedSensors.findMany({
                where: eq(raisedBedSensors.raisedBedId, raisedBed.id),
            });
            for (const sensor of sensors) {
                await storage()
                    .update(raisedBedSensors)
                    .set({ isDeleted: true })
                    .where(eq(raisedBedSensors.id, sensor.id));
            }
        }

        for (const garden of gardens) {
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

        // Detach operations from account - set account to null
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
            `[AccountDelete] Deleting delivery addresses and invitations for accountId=${accountId}`,
        );
        await storage()
            .delete(deliveryAddresses)
            .where(eq(deliveryAddresses.accountId, accountId));
        await storage()
            .delete(accountInvitations)
            .where(eq(accountInvitations.accountId, accountId));

        // The ledger and invoice account FKs are non-null. The current hard
        // deletion contract therefore erases those account-owned rows, while
        // fiscal receipts remain as detached commercial records.
        console.info(
            `[AccountDelete] Deleting sunflower ledger and invoice rows for accountId=${accountId}`,
        );
        await storage().transaction(async (db) => {
            await db
                .delete(sunflowerLedgerEntries)
                .where(eq(sunflowerLedgerEntries.accountId, accountId));
            const accountInvoiceIds = db
                .select({ id: invoices.id })
                .from(invoices)
                .where(eq(invoices.accountId, accountId));
            await db
                .update(sunflowerLedgerEntries)
                .set({ invoiceId: null })
                .where(
                    inArray(
                        sunflowerLedgerEntries.invoiceId,
                        accountInvoiceIds,
                    ),
                );
            await db
                .update(receipts)
                .set({ invoiceId: null })
                .where(inArray(receipts.invoiceId, accountInvoiceIds));
            await db
                .delete(invoiceItems)
                .where(inArray(invoiceItems.invoiceId, accountInvoiceIds));
            await db.delete(invoices).where(eq(invoices.accountId, accountId));
        });

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
            await deleteNotificationsMatching(eq(notifications.userId, userId));
            await storage()
                .delete(notificationEmailLog)
                .where(eq(notificationEmailLog.userId, userId));
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
