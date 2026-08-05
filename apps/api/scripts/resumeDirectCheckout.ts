import {
    closeStorage,
    events,
    getAccount,
    getShoppingCart,
    knownEventTypes,
    markCartPaidAndEnqueueOrderConfirmation,
    setCartItemPaid,
    storage,
} from '@gredice/storage';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getCartInfo } from '../lib/checkout/cartInfo';
import { withDirectSunflowerCheckoutBatch } from '../lib/checkout/directSunflowerCheckout';
import { buildCheckoutAdditionalData } from '../lib/checkout/harvestCheckout';
import {
    buildOrderConfirmationItems,
    ORDER_CONFIRMATION_MANAGE_URL,
} from '../lib/checkout/orderConfirmationEmail';
import {
    assertCheckoutItemFulfilled,
    processItem,
} from '../lib/stripe/processCheckoutSession';

function readRequiredOption(argv: string[], name: string) {
    const prefix = `--${name}=`;
    const value = argv
        .find((argument) => argument.startsWith(prefix))
        ?.slice(prefix.length)
        .trim();
    if (!value) {
        throw new Error(`${prefix}<value> is required.`);
    }
    return value;
}

function readCartId(argv: string[]) {
    const rawCartId = readRequiredOption(argv, 'cart-id');
    const cartId = Number(rawCartId);
    if (!Number.isSafeInteger(cartId) || cartId <= 0) {
        throw new Error('--cart-id must be a positive integer.');
    }
    return cartId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseSpendEvent(data: unknown) {
    if (!isRecord(data)) {
        return null;
    }
    const { amount, reason } = data;
    if (
        typeof reason !== 'string' ||
        typeof amount !== 'number' ||
        !Number.isSafeInteger(amount) ||
        amount <= 0
    ) {
        return null;
    }
    return { amount, reason };
}

async function getExistingCartItemDebits(
    accountId: string,
    cartItemIds: readonly number[],
) {
    const reasons = cartItemIds.map(
        (cartItemId) => `shoppingCartItem:${cartItemId.toString()}`,
    );
    const spendEvents = await storage()
        .select({ data: events.data, id: events.id })
        .from(events)
        .where(
            and(
                eq(events.aggregateId, accountId),
                eq(events.type, knownEventTypes.accounts.spendSunflowers),
                inArray(sql<string>`${events.data}->>'reason'`, reasons),
            ),
        );
    const amountsByReason = new Map<string, number>();
    for (const event of spendEvents) {
        const parsed = parseSpendEvent(event.data);
        if (!parsed || !reasons.includes(parsed.reason)) {
            throw new Error(
                `Cart debit event ${event.id.toString()} is malformed.`,
            );
        }
        if (amountsByReason.has(parsed.reason)) {
            throw new Error(`Duplicate cart debit found for ${parsed.reason}.`);
        }
        amountsByReason.set(parsed.reason, parsed.amount);
    }

    const missingReasons = reasons.filter(
        (reason) => !amountsByReason.has(reason),
    );
    if (missingReasons.length > 0) {
        throw new Error(
            `Refusing to resume because original debits are missing: ${missingReasons.join(', ')}.`,
        );
    }
    return amountsByReason;
}

const argv = process.argv.slice(2);
const accountId = readRequiredOption(argv, 'account-id');
const cartId = readCartId(argv);
const recipient = readRequiredOption(argv, 'recipient').toLowerCase();
const execute = argv.includes('--execute');

try {
    const [account, cart] = await Promise.all([
        getAccount(accountId),
        getShoppingCart(cartId),
    ]);
    if (!account) {
        throw new Error(`Account ${accountId} was not found.`);
    }
    if (!cart || cart.accountId !== accountId) {
        throw new Error(
            `Cart ${cartId.toString()} does not belong to account ${accountId}.`,
        );
    }
    if (cart.status !== 'new' && cart.status !== 'paid') {
        throw new Error(
            `Cart ${cartId.toString()} has unsupported status ${cart.status}.`,
        );
    }

    const recipientBelongsToAccount = account.accountUsers.some(
        ({ user }) => user.userName.toLowerCase() === recipient,
    );
    if (!recipientBelongsToAccount) {
        throw new Error('Confirmation recipient is not linked to the account.');
    }
    if (
        cart.items.length === 0 ||
        cart.items.some(
            (item) =>
                item.entityTypeName !== 'plantSort' ||
                item.currency !== 'sunflower' ||
                item.isDeleted,
        )
    ) {
        throw new Error(
            'This recovery command only supports a cart of live sunflower plant items.',
        );
    }

    const cartInfo = await getCartInfo(cart.items, accountId);
    if (cartInfo.items.length !== cart.items.length) {
        throw new Error('Not every cart item resolved to current shop data.');
    }
    if (!cartInfo.allowPurchase && cart.status !== 'paid') {
        throw new Error(
            `Cart is not currently purchasable: ${cartInfo.notes.join(' ')}`,
        );
    }

    const existingDebits = await getExistingCartItemDebits(
        accountId,
        cartInfo.items.map((item) => item.id),
    );
    console.log(
        JSON.stringify(
            {
                accountId,
                cartId,
                cartStatus: cart.status,
                items: cartInfo.items.map((item) => ({
                    debit: existingDebits.get(
                        `shoppingCartItem:${item.id.toString()}`,
                    ),
                    entityId: item.entityId,
                    id: item.id,
                    positionIndex: item.positionIndex,
                    raisedBedId: item.raisedBedId,
                    status: item.status,
                })),
                mode: execute ? 'execute' : 'dry-run',
            },
            null,
            2,
        ),
    );

    if (!execute) {
        console.log('Dry run complete; no checkout data was changed.');
    } else if (cart.status === 'paid') {
        console.log('Cart is already paid; no checkout data was changed.');
    } else {
        const result = await withDirectSunflowerCheckoutBatch({
            accountId,
            allCheckoutItems: cartInfo.items,
            cartId,
            operation: async ({
                pendingItems,
                resolvedAmountsByCartItemId,
            }) => {
                const fulfilledItemIds: number[] = [];
                for (const item of pendingItems) {
                    const amountTotal = resolvedAmountsByCartItemId.get(
                        item.id,
                    );
                    if (amountTotal === undefined) {
                        throw new Error(
                            `Resolved debit is missing for cart item ${item.id.toString()}.`,
                        );
                    }
                    const fulfillment = await processItem({
                        accountId,
                        cartItemId: item.id,
                        ...item,
                        additionalData: buildCheckoutAdditionalData({
                            additionalData: item.additionalData,
                        }),
                        amount_total: amountTotal,
                    });
                    assertCheckoutItemFulfilled(fulfillment);
                    await setCartItemPaid(item.id);
                    fulfilledItemIds.push(item.id);
                }

                const confirmation =
                    await markCartPaidAndEnqueueOrderConfirmation({
                        cartId,
                        payload: {
                            cartId,
                            currency: null,
                            items: buildOrderConfirmationItems(
                                cartInfo.items,
                                (item) => {
                                    const amount =
                                        resolvedAmountsByCartItemId.get(
                                            item.id,
                                        );
                                    if (amount === undefined) {
                                        throw new Error(
                                            `Confirmation debit is missing for cart item ${item.id.toString()}.`,
                                        );
                                    }
                                    return amount;
                                },
                            ),
                            manageUrl: ORDER_CONFIRMATION_MANAGE_URL,
                            to: recipient,
                            totalAmountCents: null,
                        },
                    });
                if (
                    confirmation.status !== 'enqueued' &&
                    !(
                        confirmation.status === 'already_paid' &&
                        confirmation.emailMessageId !== null
                    )
                ) {
                    throw new Error(
                        `Cart confirmation was not recorded (${confirmation.status}).`,
                    );
                }
                return { confirmation, fulfilledItemIds };
            },
        });
        if (result.state !== 'processed') {
            throw new Error('Cart became paid before recovery was processed.');
        }
        console.log(JSON.stringify(result.value, null, 2));
    }
} finally {
    await closeStorage();
}
