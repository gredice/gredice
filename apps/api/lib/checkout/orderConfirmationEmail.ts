import type { OrderConfirmationEmailItem } from '@gredice/transactional/emails/Commerce/order-confirmation';
import { sendOrderConfirmation } from '../email/transactional';
import type { ShoppingCartItemWithShopData } from './cartInfo';

const CUSTOMER_APP_URL =
    process.env.GREDICE_GARDEN_APP_URL ?? 'https://vrt.gredice.com';

export interface OrderConfirmationEmailParams {
    to?: string | null;
    cartId?: number | null;
    checkoutSessionId?: string | null;
    items: OrderConfirmationEmailItem[];
    totalAmountCents?: number | null;
    currency?: string | null;
}

export function buildOrderConfirmationItems(
    items: ShoppingCartItemWithShopData[],
    calculateSunflowerAmount: (item: ShoppingCartItemWithShopData) => number,
): OrderConfirmationEmailItem[] {
    return items.map((item) => {
        const quantity = item.amount;
        if (item.currency === 'sunflower') {
            return {
                name: item.shopData.name,
                quantity,
                amountSubtotal: calculateSunflowerAmount(item),
                currency: item.currency,
            };
        }

        if (item.currency === 'inventory' || item.usesInventory) {
            return {
                name: item.shopData.name,
                quantity,
                amountSubtotal: 0,
                currency: 'inventory',
            };
        }

        const unitPrice =
            typeof item.shopData.discountPrice === 'number'
                ? item.shopData.discountPrice
                : item.shopData.price;

        return {
            name: item.shopData.name,
            quantity,
            amountSubtotal:
                typeof unitPrice === 'number'
                    ? Math.round(unitPrice * 100) * quantity
                    : null,
            currency: item.currency,
        };
    });
}

export async function notifyOrderConfirmationEmail({
    to,
    cartId,
    checkoutSessionId,
    items,
    totalAmountCents,
    currency = 'eur',
}: OrderConfirmationEmailParams) {
    const email = to?.trim();
    if (!email) {
        console.warn('Skipping order confirmation email: missing recipient', {
            cartId,
            checkoutSessionId,
        });
        return false;
    }

    try {
        await sendOrderConfirmation(email, {
            email,
            items,
            orderReference: cartId ? `Narudžba #${cartId}` : null,
            totalAmountCents,
            currency,
            manageUrl: CUSTOMER_APP_URL,
        });
        return true;
    } catch (error) {
        console.error('Failed to send order confirmation email', {
            cartId,
            checkoutSessionId,
            hasRecipient: true,
            error,
        });
        return false;
    }
}
