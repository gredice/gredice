'use server';

import {
    createInvoice,
    getAccount,
    getAccountUsers,
    getAllShoppingCarts,
    getAllTransactions,
    getEntitiesFormatted,
    getOrCreateShoppingCart,
    type SelectShoppingCartItem,
} from '@gredice/storage';
import type { EntityStandardized } from '../../../../lib/@types/EntityStandardized';
import { auth } from '../../../../lib/auth/auth';

interface InvoiceCreationData {
    accountId: string;
    transactionId: string;
    currency: string;
    status: string;
    billToName: string;
    billToEmail: string;
    billToAddress: string;
    billToCity: string;
    billToState: string;
    billToZip: string;
    billToCountry: string;
    notes: string;
    terms: string;
    subtotal: string;
    taxAmount: string;
    totalAmount: string;
    issueDate: Date;
    dueDate: Date;
    items: Array<{
        description: string;
        quantity: string;
        unitPrice: string;
        totalPrice: string;
    }>;
}

export async function createInvoiceAction(data: InvoiceCreationData) {
    await auth(['admin']);

    try {
        // Generate invoice number based on current year
        const year = new Date().getFullYear();
        const invoiceNumber = `PON-${year}-${Date.now().toString()}`;

        // Prepare invoice data
        const invoiceData = {
            invoiceNumber,
            accountId: data.accountId,
            transactionId: data.transactionId
                ? parseInt(data.transactionId, 10)
                : null,
            subtotal: data.subtotal,
            taxAmount: data.taxAmount,
            totalAmount: data.totalAmount,
            currency: data.currency,
            status: data.status,
            issueDate: data.issueDate,
            dueDate: data.dueDate,
            billToName: data.billToName || null,
            billToEmail: data.billToEmail,
            billToAddress: data.billToAddress || null,
            billToCity: data.billToCity || null,
            billToState: data.billToState || null,
            billToZip: data.billToZip || null,
            billToCountry: data.billToCountry || null,
            notes: data.notes || null,
            terms: data.terms || null,
        };

        // Prepare invoice items
        const itemsData = data.items.map((item) => ({
            description: item.description,
            quantity: item.quantity, // Keep as string for decimal field
            unitPrice: item.unitPrice, // Keep as string for decimal field
            totalPrice: item.totalPrice, // Keep as string for decimal field
        }));

        // Create invoice with items
        const invoiceId = await createInvoice(invoiceData, itemsData);

        return { success: true, invoiceId };
    } catch (error) {
        console.error('Error creating invoice:', error);
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : 'Unknown error occurred',
        };
    }
}

export async function getTransactionsAction() {
    await auth(['admin']);

    try {
        const transactions = await getAllTransactions();

        // Sort transactions by newest first (createdAt descending)
        const sortedTransactions = (transactions || []).sort(
            (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
        );

        return { success: true, transactions: sortedTransactions };
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return { success: false, error: 'Failed to fetch transactions' };
    }
}

export async function getShoppingCartsAction(accountId?: string) {
    await auth(['admin']);

    try {
        const allShoppingCarts = await getAllShoppingCarts({ status: null });

        // Filter by account if accountId is provided, and sort by newest first
        let shoppingCarts = allShoppingCarts || [];

        if (accountId) {
            shoppingCarts = shoppingCarts.filter(
                (cart) => cart.accountId === accountId,
            );
        }

        // Filter carts to only include those with items paid in EUR currency
        shoppingCarts = shoppingCarts
            .map((cart) => ({
                ...cart,
                items: cart.items.filter(
                    (item) =>
                        item.status === 'paid' &&
                        (item.currency === 'eur' || !item.currency), // Default to EUR if no currency specified
                ),
            }))
            .filter((cart) => cart.items.length > 0); // Only include carts that have EUR paid items

        // Sort by newest first (createdAt descending)
        shoppingCarts = shoppingCarts.sort(
            (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
        );

        return { success: true, shoppingCarts };
    } catch (error) {
        console.error('Error fetching shopping carts:', error);
        return { success: false, error: 'Failed to fetch shopping carts' };
    }
}

export async function getShoppingCartAction(accountId: string) {
    await auth(['admin']);

    try {
        const cart = await getOrCreateShoppingCart(accountId, 'new');
        return { success: true, shoppingCart: cart };
    } catch (error) {
        console.error('Error fetching shopping cart:', error);
        return { success: false, error: 'Failed to fetch shopping cart' };
    }
}

export async function getAccountDetailsAction(accountId: string) {
    await auth(['admin']);

    try {
        const [account, accountUsers] = await Promise.all([
            getAccount(accountId),
            getAccountUsers(accountId),
        ]);

        if (!account) {
            return { success: false, error: 'Account not found' };
        }

        // Get first linked user for email
        const firstUser = accountUsers[0]?.user;

        return {
            success: true,
            account: {
                id: account.id,
                email: firstUser?.userName || '',
                displayName: firstUser?.displayName || '',
                // Add more fields as needed for invoice billing
            },
        };
    } catch (error) {
        console.error('Error fetching account details:', error);
        return { success: false, error: 'Failed to fetch account details' };
    }
}

export async function getShoppingCartItemsWithEntityNamesAction(
    shoppingCartItems: SelectShoppingCartItem[],
) {
    await auth(['admin']);

    // Get unique entity types
    const entityTypes = [
        ...new Set(shoppingCartItems.map((item) => item.entityTypeName)),
    ];

    // Fetch entities for each type
    const entitiesPromises = entityTypes.map(async (entityTypeName) => {
        const entities = await getEntitiesFormatted(entityTypeName);
        return { entityTypeName, entities };
    });

    const entitiesResults = await Promise.all(entitiesPromises);

    // Create a lookup map
    const entitiesLookup: Record<string, EntityStandardized[]> = {};
    entitiesResults.forEach(({ entityTypeName, entities }) => {
        entitiesLookup[entityTypeName] = entities as EntityStandardized[];
    });

    // Enhance shopping cart items with entity names
    const enhancedItems = shoppingCartItems.map((item) => {
        const entities = entitiesLookup[item.entityTypeName] || [];
        const entity = entities.find((e) => e.id?.toString() === item.entityId);

        return {
            ...item,
            entityName:
                entity?.information?.label ||
                entity?.information?.name ||
                `${item.entityTypeName} ${item.entityId}`,
            price:
                entity?.prices?.perPlant ||
                entity?.information?.plant?.prices?.perPlant ||
                entity?.prices?.perOperation ||
                entity?.information?.plant?.prices?.perOperation ||
                0,
        };
    });

    return enhancedItems;
}
