import "server-only";
import Stripe from 'stripe';
import { getReturnUrl, getStripe } from '../config';

export type UserAccount = {
    id: string;
    email: string;
    name: string;
    stripeCustomerId?: string;
}

export type CheckoutItem = {
    price: {
        valueInCents: number;
        currency: 'EUR';
    };
    product: {
        name: string;
        description?: string;
        imageUrls?: string[];
        metadata?: Record<string, string | number | null>;
    };
    quantity: number;
};

async function ensureStripeCustomer(account: UserAccount): Promise<string> {
    // Check if the user already has a Stripe customer ID
    // Ensure customer still exists in Stripe and is not deleted
    if (account.stripeCustomerId && account.stripeCustomerId.length > 0) {
        const existingCustomerId = await getStripe().customers.retrieve(account.stripeCustomerId);
        if (existingCustomerId && !existingCustomerId.deleted)
            return existingCustomerId.id;
    }

    // Try to find customer by email
    const customers = await stripeListAll<Stripe.Customer>(params => getStripe().customers.list({
        email: account.email,
        ...params
    }));

    if (customers.length > 0) {
        const customer = customers[0];
        if (customer && !customer.deleted) {
            return customer.id;
        }
    }

    // Create a new customer in Stripe
    const newCustomer = await getStripe().customers.create({
        email: account.email,
        name: account.name
    });
    return newCustomer.id;
}

export async function getStripeCheckoutSessions(lastDateTime: Date) {
    try {
        const sessions = await getStripe().checkout.sessions.list({
            created: {
                gte: Math.floor(lastDateTime.getTime() / 1000),
            },
            limit: 100
        });
        return sessions.data;
    } catch (error) {
        console.error('Error fetching checkout sessions:', error);
        throw error;
    }
}

export async function getStripeCheckoutSession(sessionId: string) {
    try {
        const session = await getStripe().checkout.sessions.retrieve(sessionId);
        const line_items = await getStripe().checkout.sessions.listLineItems(sessionId, {
            expand: ['data.price.product'],
        });
        return {
            id: session.id,
            customerId: session.customer,
            status: session.status,
            paymentId: typeof session.payment_link === 'string'
                ? session.payment_link
                : session.payment_link?.id,
            paymentStatus: session.payment_status,
            lineItems: line_items,
            amountTotal: session.amount_total,
        };
    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message + ' Please try again later or contact a system administrator.', 'error');
        } else {
            console.error('An unknown error occurred. Please try again later or contact a system administrator.', 'error');
        }
        throw error;
    }
}

export async function stripeSessionCancel(sessionId: string) {
    try {
        const session = await getStripe().checkout.sessions.expire(sessionId);
        return {
            id: session.id,
            customerId: session.customer,
            status: session.status
        };
    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message + ' Please try again later or contact a system administrator.', 'error');
        } else {
            console.error('An unknown error occurred. Please try again later or contact a system administrator.', 'error');
        }
        throw error;
    }
}

export async function stripeCheckout(
    account: UserAccount,
    data: {
        items: CheckoutItem[],
    }
) {
    try {
        const customerId = await ensureStripeCustomer(account);
        const params: Stripe.Checkout.SessionCreateParams = {
            customer: customerId,
            customer_update: {
                address: 'auto',
            },
            line_items: data.items.map(item => ({
                price_data: {
                    currency: item.price.currency,
                    product_data: {
                        name: item.product.name,
                        description: item.product.description,
                        images: item.product.imageUrls,
                        metadata: item.product.metadata
                    },
                    unit_amount: item.price.valueInCents,
                },
                quantity: item.quantity,
            })),
            allow_promotion_codes: true,
            mode: 'payment',
            locale: 'hr',
            cancel_url: getReturnUrl({ status: 'cancel' }),
            success_url: getReturnUrl({ status: 'success' }),
        };

        // Create a checkout session in Stripe
        let session;
        try {
            session = await getStripe().checkout.sessions.create(params);
        } catch (err) {
            console.error(err);
            throw new Error('Unable to create checkout session.');
        }

        if (session) {
            return { sessionId: session.id, customerId: customerId };
        }

        throw new Error('Unable to create checkout session.');
    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message + ' Please try again later or contact a system administrator.', 'error');
        } else {
            console.error('An unknown error occurred. Please try again later or contact a system administrator.', 'error');
        }
        throw error;
    }
}

export async function stripeCustomerBillingInfo(account: UserAccount) {
    try {
        const customerId = await ensureStripeCustomer(account);
        const stripeCustomer = await getStripe().customers.retrieve(customerId);
        if (stripeCustomer.deleted)
            throw new Error('Customer not found');

        return {
            customerId,
            country: stripeCustomer.address?.country,
            city: stripeCustomer.address?.city,
            postalCode: stripeCustomer.address?.postal_code,
            state: stripeCustomer.address?.state,
            line1: stripeCustomer.address?.line1,
            line2: stripeCustomer.address?.line2,
        };
    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message + ' Please try again later or contact a system administrator.', 'error');
        } else {
            console.error('An unknown error occurred. Please try again later or contact a system administrator.', 'error');
        }
        throw error;
    }
}

async function stripeListAll<T extends { id: string }>(fetchMethod: (params: Stripe.PaginationParams) => Promise<Stripe.ApiList<T>>) {
    const data: T[] = [];
    let hasMore = true;
    while (hasMore) {
        const page = await fetchMethod({
            starting_after: data[data.length - 1]?.id
        });
        data.push(...page.data);
        hasMore = page.has_more;
    }
    return data;
}

export async function stripeCustomerPaymentMethods(account: UserAccount) {
    try {
        const customerId = await ensureStripeCustomer(account);
        const stripeCustomer = await getStripe().customers.retrieve(customerId);
        if (stripeCustomer.deleted)
            throw new Error('Customer not found');

        const paymentMethods = await stripeListAll<Stripe.PaymentMethod>(params => getStripe().paymentMethods.list({
            customer: customerId,
            ...params
        }));

        return paymentMethods.map((pm) => {
            return {
                id: pm.id,
                customerId,
                brand: pm.card?.brand,
                displayBrand: pm.card?.display_brand,
                last4: pm.card?.last4,
                expMonth: pm.card?.exp_month,
                expYear: pm.card?.exp_year,
                isDefault: pm.id === stripeCustomer.invoice_settings.default_payment_method
            };
        });
    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message + ' Please try again later or contact a system administrator.', 'error');
        } else {
            console.error('An unknown error occurred. Please try again later or contact a system administrator.', 'error');
        }

        throw error;
    }
}

export async function stripeCreatePortal(account: UserAccount) {
    try {
        const customerId = await ensureStripeCustomer(account);
        try {
            const { url, id } = await getStripe().billingPortal.sessions.create({
                customer: customerId,
                return_url: getReturnUrl()
            });
            if (!url) {
                throw new Error('Could not create billing portal');
            }
            return {
                sessionId: id,
                url,
                customerId
            };
        } catch (err) {
            console.error(err);
            throw new Error('Could not create billing portal');
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message + ' Please try again later or contact a system administrator.', 'error');
        } else {
            console.error('An unknown error occurred. Please try again later or contact a system administrator.', 'error');
        }

        console.error(error);
    }
}

export async function stripeWebhookConstructEvent(body: string, sig: string, webhookSecret: string | undefined) {
    if (!webhookSecret) {
        throw new Error('Stripe webhook secret is not provided.');
    }

    try {
        const event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
        console.info(`🔔  Webhook received: ${event.type}`);
        return event;
    } catch (err: unknown) {
        if (err instanceof Error) {
            console.error(`❌ Error message: ${err.message}`);
            throw new Error(`Webhook Error: ${err.message}`);
        } else {
            console.error('Stripe webhook event - unknown error', err);
            throw new Error('Stripe webhook event - unknown error');
        }
    }
}