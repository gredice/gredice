import 'server-only';
import type Stripe from 'stripe';
import { getReturnUrl, getStripe, STRIPE_REQUEST_TIMEOUT_MS } from '../config';

const STRIPE_CHECKOUT_SESSION_PAGE_SIZE = 100;
const STRIPE_CHECKOUT_SESSION_MAX_PAGES = 100;
const STRIPE_CHECKOUT_SESSION_CLOCK_SKEW_MS = 5 * 60 * 1000;
const STRIPE_RECONCILIATION_MAX_NETWORK_RETRIES = 0;
const STRIPE_RECONCILIATION_REQUEST_TIMEOUT_MS = 5_000;
const STRIPE_RECONCILIATION_SCAN_BUDGET_MS = 10_000;

const stripeReconciliationRequestOptions = {
    maxNetworkRetries: STRIPE_RECONCILIATION_MAX_NETWORK_RETRIES,
    timeout: STRIPE_RECONCILIATION_REQUEST_TIMEOUT_MS,
} satisfies Stripe.RequestOptions;

export type UserAccount = {
    id: string;
    email: string;
    name: string;
    stripeCustomerId?: string;
};

export type CheckoutItem = {
    price: {
        valueInCents: number;
        currency: 'eur';
    };
    product: {
        name: string;
        description?: string;
        imageUrls?: string[];
        metadata?: Record<string, string | number | null>;
    };
    quantity: number;
};

export type StripeCheckoutData = {
    items: CheckoutItem[];
    expiresAt?: Date;
    allowPromotionCodes?: boolean;
    metadata?: Record<string, string | number | null>;
};

type StripeCheckoutSessionCreateParams = NonNullable<
    Parameters<
        ReturnType<typeof getStripe>['checkout']['sessions']['create']
    >[0]
>;

function getValidStripeImageUrls(imageUrls?: string[]): string[] | undefined {
    if (!imageUrls || imageUrls.length === 0) return undefined;

    const validUrls = imageUrls.filter((imageUrl) => {
        try {
            const parsedUrl = new URL(imageUrl);
            return (
                parsedUrl.protocol === 'https:' ||
                parsedUrl.protocol === 'http:'
            );
        } catch {
            return false;
        }
    });

    if (validUrls.length === 0) return undefined;
    return validUrls;
}

export async function resolveStripeCustomerId(
    account: UserAccount,
): Promise<string> {
    // Check if the user already has a Stripe customer ID
    // Ensure customer still exists in Stripe and is not deleted
    if (account.stripeCustomerId && account.stripeCustomerId.length > 0) {
        try {
            const existingCustomerId = await getStripe().customers.retrieve(
                account.stripeCustomerId,
            );
            if (existingCustomerId && !existingCustomerId.deleted)
                return existingCustomerId.id;
        } catch (error) {
            console.error('Error retrieving existing Stripe customer:', error);
            // If the customer does not exist or is deleted, we will create a new one
        }
    }

    // Try to find customer by email
    const customers = await stripeListAll<Stripe.Customer>((params) =>
        getStripe().customers.list({
            email: account.email,
            ...params,
        }),
    );

    if (customers.length > 0) {
        const customer = customers[0];
        if (customer && !customer.deleted) {
            return customer.id;
        }
    }

    // Create a new customer in Stripe
    const newCustomer = await getStripe().customers.create({
        email: account.email,
        name: account.name,
    });
    return newCustomer.id;
}

const stripeCheckoutDiscoveryPageSize = 100;
const stripeCheckoutDiscoveryRequestOptions = {
    maxNetworkRetries: STRIPE_RECONCILIATION_MAX_NETWORK_RETRIES,
    timeout: STRIPE_RECONCILIATION_REQUEST_TIMEOUT_MS,
} satisfies Stripe.RequestOptions;

type StripeCheckoutSessionDiscoveryPage = {
    data: readonly { id: string }[];
    has_more: boolean;
};

type StripeCheckoutSessionDiscoveryPageParams = {
    created: { gte: number; lte: number };
    limit: number;
    starting_after?: string;
    status: 'complete';
};

export type StripeCheckoutSessionDiscoveryPageResult = {
    hasMore: boolean;
    nextStartingAfter: string | null;
    sessions: readonly { id: string }[];
};

export async function collectStripeCheckoutSessionDiscoveryPage(
    {
        rangeGte,
        rangeLte,
        startingAfter,
    }: {
        rangeGte: Date;
        rangeLte: Date;
        startingAfter: string | null;
    },
    listPage: (
        params: StripeCheckoutSessionDiscoveryPageParams,
        requestOptions: Stripe.RequestOptions,
    ) => Promise<StripeCheckoutSessionDiscoveryPage>,
): Promise<StripeCheckoutSessionDiscoveryPageResult> {
    const rangeGteMs = rangeGte.getTime();
    const rangeLteMs = rangeLte.getTime();
    if (
        !Number.isFinite(rangeGteMs) ||
        !Number.isFinite(rangeLteMs) ||
        rangeLteMs < rangeGteMs
    ) {
        throw new RangeError('Stripe checkout discovery range is invalid.');
    }
    const page = await listPage(
        {
            created: {
                gte: Math.floor(rangeGteMs / 1_000),
                lte: Math.floor(rangeLteMs / 1_000),
            },
            limit: stripeCheckoutDiscoveryPageSize,
            ...(startingAfter ? { starting_after: startingAfter } : {}),
            status: 'complete',
        },
        stripeCheckoutDiscoveryRequestOptions,
    );
    const nextStartingAfter = page.has_more
        ? (page.data.at(-1)?.id ?? null)
        : null;
    if (
        page.has_more &&
        (!nextStartingAfter || nextStartingAfter === startingAfter)
    ) {
        throw new Error('Stripe checkout session pagination did not advance');
    }
    return {
        hasMore: page.has_more,
        nextStartingAfter,
        sessions: page.data,
    };
}

export function getStripeCheckoutSessionDiscoveryPage(input: {
    rangeGte: Date;
    rangeLte: Date;
    startingAfter: string | null;
}) {
    return collectStripeCheckoutSessionDiscoveryPage(input, (params, options) =>
        getStripe().checkout.sessions.list(params, options),
    );
}

export type ExhaustiveStripePageResult<T> =
    | {
          status: 'exhaustive';
          items: T[];
          pageCount: number;
      }
    | {
          status: 'partial';
          pageCount: number;
          reason:
              | 'invalid_pagination'
              | 'page_limit'
              | 'request_failed'
              | 'time_limit';
      };

export async function collectStripePagesExhaustively<T extends { id: string }>({
    fetchPage,
    maxDurationMs,
    maxPages = STRIPE_CHECKOUT_SESSION_MAX_PAGES,
    now = Date.now,
}: {
    fetchPage: (startingAfter?: string) => Promise<{
        data: T[];
        hasMore: boolean;
    }>;
    maxDurationMs?: number;
    maxPages?: number;
    now?: () => number;
}): Promise<ExhaustiveStripePageResult<T>> {
    if (!Number.isSafeInteger(maxPages) || maxPages <= 0) {
        throw new RangeError('Stripe page limit must be a positive integer.');
    }
    if (
        maxDurationMs !== undefined &&
        (!Number.isSafeInteger(maxDurationMs) || maxDurationMs <= 0)
    ) {
        throw new RangeError('Stripe time limit must be a positive integer.');
    }

    const items: T[] = [];
    const cursors = new Set<string>();
    const startedAt = now();
    let startingAfter: string | undefined;
    for (let pageCount = 1; pageCount <= maxPages; pageCount += 1) {
        if (
            pageCount > 1 &&
            maxDurationMs !== undefined &&
            now() - startedAt >= maxDurationMs
        ) {
            return {
                status: 'partial',
                pageCount: pageCount - 1,
                reason: 'time_limit',
            };
        }
        let page: { data: T[]; hasMore: boolean };
        try {
            page = await fetchPage(startingAfter);
        } catch {
            return {
                status: 'partial',
                pageCount: pageCount - 1,
                reason: 'request_failed',
            };
        }
        items.push(...page.data);
        if (!page.hasMore) {
            return { status: 'exhaustive', items, pageCount };
        }

        const cursor = page.data.at(-1)?.id;
        if (!cursor || cursor === startingAfter || cursors.has(cursor)) {
            return {
                status: 'partial',
                pageCount,
                reason: 'invalid_pagination',
            };
        }
        if (pageCount === maxPages) {
            return { status: 'partial', pageCount, reason: 'page_limit' };
        }
        cursors.add(cursor);
        startingAfter = cursor;
    }

    return {
        status: 'partial',
        pageCount: maxPages,
        reason: 'page_limit',
    };
}

export function getStripeCheckoutSessionCreationRange({
    createdAt,
    expiresAt,
}: {
    createdAt: Date;
    expiresAt: Date | null;
}) {
    const createdAtMs = createdAt.getTime();
    const expiresAtMs = expiresAt?.getTime();
    if (
        !Number.isFinite(createdAtMs) ||
        (expiresAtMs !== undefined &&
            (!Number.isFinite(expiresAtMs) || expiresAtMs < createdAtMs))
    ) {
        throw new RangeError('Stripe checkout creation window is invalid.');
    }
    const createdGte = Math.floor(
        (createdAtMs - STRIPE_CHECKOUT_SESSION_CLOCK_SKEW_MS) / 1000,
    );
    const latestCreationTime =
        expiresAtMs ?? createdAtMs + STRIPE_REQUEST_TIMEOUT_MS;
    const createdLte = Math.ceil(
        (latestCreationTime + STRIPE_CHECKOUT_SESSION_CLOCK_SKEW_MS) / 1000,
    );
    return { gte: createdGte, lte: createdLte };
}

export function listStripeCheckoutSessionsForCustomerExhaustively({
    createdAt,
    customerId,
    expiresAt,
}: {
    createdAt: Date;
    customerId: string;
    expiresAt: Date | null;
}) {
    const created = getStripeCheckoutSessionCreationRange({
        createdAt,
        expiresAt,
    });
    return collectStripePagesExhaustively<Stripe.Checkout.Session>({
        fetchPage: async (startingAfter) => {
            const page = await getStripe().checkout.sessions.list(
                {
                    created,
                    customer: customerId,
                    limit: STRIPE_CHECKOUT_SESSION_PAGE_SIZE,
                    ...(startingAfter ? { starting_after: startingAfter } : {}),
                },
                stripeReconciliationRequestOptions,
            );
            return { data: page.data, hasMore: page.has_more };
        },
        maxDurationMs: STRIPE_RECONCILIATION_SCAN_BUDGET_MS,
    });
}

async function retrieveStripeCheckoutSession(
    sessionId: string,
    requestOptions?: Stripe.RequestOptions,
) {
    const session = await getStripe().checkout.sessions.retrieve(
        sessionId,
        {},
        requestOptions,
    );
    const line_items = await getStripe().checkout.sessions.listLineItems(
        sessionId,
        {
            expand: ['data.price.product'],
            limit: 100,
        },
        requestOptions,
    );
    return {
        id: session.id,
        customerId: session.customer,
        status: session.status,
        paymentId:
            typeof session.payment_link === 'string'
                ? session.payment_link
                : session.payment_link?.id,
        paymentStatus: session.payment_status,
        lineItems: line_items,
        amountTotal: session.amount_total,
        metadata: session.metadata,
        url: session.url,
    };
}

export async function getStripeCheckoutSession(sessionId: string) {
    try {
        return await retrieveStripeCheckoutSession(sessionId);
    } catch (error) {
        if (error instanceof Error) {
            console.error(
                error.message +
                    ' Please try again later or contact a system administrator.',
                'error',
            );
        } else {
            console.error(
                'An unknown error occurred. Please try again later or contact a system administrator.',
                'error',
            );
        }
        throw error;
    }
}

export function getStripeCheckoutSessionForReconciliation(sessionId: string) {
    return retrieveStripeCheckoutSession(
        sessionId,
        stripeReconciliationRequestOptions,
    );
}

export async function stripeSessionCancel(sessionId: string) {
    try {
        const session = await getStripe().checkout.sessions.expire(sessionId);
        return {
            id: session.id,
            customerId: session.customer,
            status: session.status,
        };
    } catch (error) {
        if (error instanceof Error) {
            console.error(
                error.message +
                    ' Please try again later or contact a system administrator.',
                'error',
            );
        } else {
            console.error(
                'An unknown error occurred. Please try again later or contact a system administrator.',
                'error',
            );
        }
        throw error;
    }
}

export function buildStripeCheckoutSessionCreateParams({
    customerId,
    data,
    returnUrls,
}: {
    customerId: string;
    data: StripeCheckoutData;
    returnUrls: StripeCheckoutReturnUrls;
}): StripeCheckoutSessionCreateParams {
    const params: StripeCheckoutSessionCreateParams = {
        customer: customerId,
        customer_update: {
            address: 'auto',
        },
        line_items: data.items.map((item) => ({
            price_data: {
                currency: item.price.currency,
                product_data: {
                    name: item.product.name,
                    description: item.product.description,
                    images: getValidStripeImageUrls(item.product.imageUrls),
                    metadata: item.product.metadata,
                },
                unit_amount: item.price.valueInCents,
            },
            quantity: item.quantity,
        })),
        allow_promotion_codes: data.allowPromotionCodes ?? true,
        mode: 'payment',
        payment_method_types: ['card'],
        locale: 'hr',
        cancel_url: returnUrls.cancel,
        success_url: returnUrls.success,
        metadata: data.metadata,
    };
    if (data.expiresAt) {
        params.expires_at = Math.floor(data.expiresAt.getTime() / 1000);
    }
    return params;
}

export async function stripeCheckout(
    account: UserAccount,
    data: StripeCheckoutData,
    options: {
        customerId?: string;
        idempotencyKey?: string;
        returnUrls?: StripeCheckoutReturnUrls;
    } = {},
) {
    try {
        const customerId =
            options.customerId ?? (await resolveStripeCustomerId(account));
        const returnUrls = options.returnUrls ?? getStripeCheckoutReturnUrls();
        const params = buildStripeCheckoutSessionCreateParams({
            customerId,
            data,
            returnUrls,
        });

        // Create a checkout session in Stripe
        let session: Stripe.Checkout.Session | undefined;
        try {
            session = await getStripe().checkout.sessions.create(params, {
                ...(options.idempotencyKey
                    ? { idempotencyKey: options.idempotencyKey }
                    : {}),
                maxNetworkRetries: STRIPE_RECONCILIATION_MAX_NETWORK_RETRIES,
                timeout: STRIPE_REQUEST_TIMEOUT_MS,
            });
        } catch (err) {
            console.error(err);
            throw err;
        }

        if (session) {
            return {
                sessionId: session.id,
                customerId: customerId,
                url: session.url,
            };
        }

        throw new Error('Unable to create checkout session.');
    } catch (error) {
        if (error instanceof Error) {
            console.error(
                error.message +
                    ' Please try again later or contact a system administrator.',
                'error',
            );
        } else {
            console.error(
                'An unknown error occurred. Please try again later or contact a system administrator.',
                'error',
            );
        }
        throw error;
    }
}

export type StripeCheckoutReturnUrls = {
    cancel: string;
    success: string;
};

export function getStripeCheckoutReturnUrls(): StripeCheckoutReturnUrls {
    return {
        cancel: getReturnUrl({ status: 'cancel' }),
        success: getReturnUrl({ status: 'success' }),
    };
}

export async function stripeCustomerBillingInfo(account: UserAccount) {
    try {
        const customerId = await resolveStripeCustomerId(account);
        const stripeCustomer = await getStripe().customers.retrieve(customerId);
        if (stripeCustomer.deleted) throw new Error('Customer not found');

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
            console.error(
                error.message +
                    ' Please try again later or contact a system administrator.',
                'error',
            );
        } else {
            console.error(
                'An unknown error occurred. Please try again later or contact a system administrator.',
                'error',
            );
        }
        throw error;
    }
}

async function stripeListAll<T extends { id: string }>(
    fetchMethod: (
        params: Stripe.PaginationParams,
    ) => Promise<Stripe.ApiList<T>>,
) {
    const data: T[] = [];
    let hasMore = true;
    while (hasMore) {
        const page = await fetchMethod({
            starting_after: data[data.length - 1]?.id,
        });
        data.push(...page.data);
        hasMore = page.has_more;
    }
    return data;
}

export async function stripeCustomerPaymentMethods(account: UserAccount) {
    try {
        const customerId = await resolveStripeCustomerId(account);
        const stripeCustomer = await getStripe().customers.retrieve(customerId);
        if (stripeCustomer.deleted) throw new Error('Customer not found');

        const paymentMethods = await stripeListAll<Stripe.PaymentMethod>(
            (params) =>
                getStripe().paymentMethods.list({
                    customer: customerId,
                    ...params,
                }),
        );

        return paymentMethods.map((pm) => {
            return {
                id: pm.id,
                customerId,
                brand: pm.card?.brand,
                displayBrand: pm.card?.display_brand,
                last4: pm.card?.last4,
                expMonth: pm.card?.exp_month,
                expYear: pm.card?.exp_year,
                isDefault:
                    pm.id ===
                    stripeCustomer.invoice_settings.default_payment_method,
            };
        });
    } catch (error) {
        if (error instanceof Error) {
            console.error(
                error.message +
                    ' Please try again later or contact a system administrator.',
                'error',
            );
        } else {
            console.error(
                'An unknown error occurred. Please try again later or contact a system administrator.',
                'error',
            );
        }

        throw error;
    }
}

export async function stripeCreatePortal(account: UserAccount) {
    try {
        const customerId = await resolveStripeCustomerId(account);
        try {
            const { url, id } = await getStripe().billingPortal.sessions.create(
                {
                    customer: customerId,
                    return_url: getReturnUrl(),
                },
            );
            if (!url) {
                throw new Error('Could not create billing portal');
            }
            return {
                sessionId: id,
                url,
                customerId,
            };
        } catch (err) {
            console.error(err);
            throw new Error('Could not create billing portal');
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error(
                error.message +
                    ' Please try again later or contact a system administrator.',
                'error',
            );
        } else {
            console.error(
                'An unknown error occurred. Please try again later or contact a system administrator.',
                'error',
            );
        }

        console.error(error);
    }
}

export async function stripeWebhookConstructEvent(
    body: string,
    sig: string,
    webhookSecret: string | undefined,
) {
    if (!webhookSecret) {
        throw new Error('Stripe webhook secret is not provided.');
    }

    try {
        const event = getStripe().webhooks.constructEvent(
            body,
            sig,
            webhookSecret,
        );
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
