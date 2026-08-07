import 'server-only';

import { createHash } from 'node:crypto';
import { and, eq, gt, ne, or, sql } from 'drizzle-orm';
import { emailMessages, stripePaymentProcessingClaims } from '../schema';
import { storage } from '../storage';

const outputVersion = 1 as const;
const orderConfirmationOutboxKind = 'order_confirmation';
const checkoutNotificationOutboxKind = 'checkout_notification';
const orderConfirmationTemplateName = 'commerce-order-confirmation';
const checkoutNotificationTemplateName = 'checkout-notification';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
export type StripePaymentCompletionOutputDatabaseClient =
    | StorageClient
    | TransactionClient;

export type StripePaymentCompletionOutputKind =
    | 'order_confirmation'
    | 'purchase_slack';

export type StripePaymentOrderConfirmationOutput = {
    cartId: number | null;
    currency: string | null;
    items: {
        amountSubtotal?: number | null;
        currency?: string | null;
        name?: string | null;
        quantity?: number | null;
    }[];
    manageUrl: string;
    to: string;
    totalAmountCents: number | null;
};

export type StripePaymentPurchaseNotificationOutput = {
    accountId: string | null;
    amountTotal: number | null;
    checkoutSessionId: string;
    currency: string | null;
    customerEmail: string | null;
    items: {
        amountSubtotal?: number | null;
        name?: string | null;
        quantity?: number | null;
    }[];
};

export type StripePaymentCompletionOutputs = {
    orderConfirmationEmailMessageId: number;
    outputVersion: typeof outputVersion;
    purchaseNotificationEmailMessageId: number;
};

export type StripePaymentCompletionRollbackPreflight = {
    blockingCount: number;
    oldestBlockingQueuedAt: string | null;
    purchaseSlack: {
        blockingCount: number;
        oldestQueuedAt: string | null;
    };
    safeToRollback: boolean;
    statusCounts: {
        bounced: number;
        failed: number;
        queued: number;
        sending: number;
    };
    stripeOrderConfirmation: {
        blockingCount: number;
        oldestQueuedAt: string | null;
    };
};

export class StripePaymentCompletionOutputConflictError extends Error {
    override readonly name = 'StripePaymentCompletionOutputConflictError';

    constructor(
        readonly stripePaymentId: string,
        readonly outputKind: StripePaymentCompletionOutputKind,
    ) {
        super(
            'Stripe payment completion output conflicts with its durable intent',
        );
    }
}

function normalizeStripePaymentId(value: string) {
    const normalized = value.trim();
    if (!normalized || normalized.length > 255) {
        throw new TypeError(
            'Stripe payment ID must contain 1 to 255 characters',
        );
    }
    return normalized;
}

function normalizeNullableText(
    value: string | null,
    label: string,
    maximumLength: number,
) {
    if (value === null) return null;
    const normalized = value.trim();
    if (!normalized || normalized.length > maximumLength) {
        throw new TypeError(
            `${label} must contain 1 to ${maximumLength.toString()} characters or be null`,
        );
    }
    return normalized;
}

function normalizeNullableAmount(value: number | null, label: string) {
    if (value !== null && (!Number.isSafeInteger(value) || value < 0)) {
        throw new TypeError(`${label} must be a non-negative integer or null`);
    }
    return value;
}

function normalizeItems<
    T extends {
        amountSubtotal?: number | null;
        currency?: string | null;
        name?: string | null;
        quantity?: number | null;
    },
>(items: T[]): T[] {
    if (!Array.isArray(items)) {
        throw new TypeError('Stripe payment completion items must be an array');
    }
    if (items.length > 100) {
        throw new TypeError(
            'Stripe payment completion cannot contain more than 100 items',
        );
    }
    return items.map((item) => {
        if (
            item.amountSubtotal !== undefined &&
            item.amountSubtotal !== null &&
            (!Number.isSafeInteger(item.amountSubtotal) ||
                item.amountSubtotal < 0)
        ) {
            throw new TypeError(
                'Stripe payment completion item amount must be non-negative',
            );
        }
        if (
            item.quantity !== undefined &&
            item.quantity !== null &&
            (!Number.isSafeInteger(item.quantity) || item.quantity <= 0)
        ) {
            throw new TypeError(
                'Stripe payment completion item quantity must be positive',
            );
        }
        const name = item.name?.trim() || null;
        if (name && name.length > 500) {
            throw new TypeError(
                'Stripe payment completion item name is too long',
            );
        }
        const currency = item.currency?.trim().toLowerCase() || null;
        if (currency && currency.length > 20) {
            throw new TypeError(
                'Stripe payment completion item currency is too long',
            );
        }
        return {
            ...item,
            ...(item.currency === undefined ? {} : { currency }),
            ...(item.name === undefined ? {} : { name }),
        };
    });
}

function normalizeOrderConfirmation(
    value: StripePaymentOrderConfirmationOutput,
): StripePaymentOrderConfirmationOutput {
    if (
        value.cartId !== null &&
        (!Number.isSafeInteger(value.cartId) || value.cartId <= 0)
    ) {
        throw new TypeError(
            'Order confirmation cart ID must be a positive integer or null',
        );
    }
    const to = normalizeNullableText(
        value.to,
        'Order confirmation recipient',
        320,
    );
    if (!to?.includes('@')) {
        throw new TypeError('Order confirmation recipient is invalid');
    }
    const manageUrl = new URL(value.manageUrl.trim());
    if (!['http:', 'https:'].includes(manageUrl.protocol)) {
        throw new TypeError('Order confirmation manage URL must use HTTP(S)');
    }
    return {
        cartId: value.cartId,
        currency:
            normalizeNullableText(
                value.currency,
                'Order confirmation currency',
                20,
            )?.toLowerCase() ?? null,
        items: normalizeItems(value.items),
        manageUrl: manageUrl.toString(),
        to,
        totalAmountCents: normalizeNullableAmount(
            value.totalAmountCents,
            'Order confirmation total amount',
        ),
    };
}

function normalizePurchaseNotification(
    stripePaymentId: string,
    value: StripePaymentPurchaseNotificationOutput,
): StripePaymentPurchaseNotificationOutput {
    const checkoutSessionId = normalizeStripePaymentId(value.checkoutSessionId);
    if (checkoutSessionId !== stripePaymentId) {
        throw new TypeError(
            'Purchase notification checkout session does not match the Stripe payment',
        );
    }
    const customerEmail = normalizeNullableText(
        value.customerEmail,
        'Purchase notification customer email',
        320,
    );
    if (customerEmail !== null && !customerEmail.includes('@')) {
        throw new TypeError('Purchase notification customer email is invalid');
    }
    return {
        accountId: normalizeNullableText(
            value.accountId,
            'Purchase notification account ID',
            255,
        ),
        amountTotal: normalizeNullableAmount(
            value.amountTotal,
            'Purchase notification total amount',
        ),
        checkoutSessionId,
        currency:
            normalizeNullableText(
                value.currency,
                'Purchase notification currency',
                20,
            )?.toLowerCase() ?? null,
        customerEmail,
        items: normalizeItems(value.items),
    };
}

function canonicalJson(value: unknown): string {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(canonicalJson).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
        .sort()
        .filter((key) => record[key] !== undefined)
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
        .join(',')}}`;
}

function fingerprint(value: unknown) {
    return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function intentKey(
    stripePaymentId: string,
    outputKind: StripePaymentCompletionOutputKind,
) {
    return `stripe-payment-completion:${stripePaymentId}:${outputKind}`;
}

function operationId(value: string) {
    const digest = createHash('sha256').update(value).digest('hex');
    return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function isMetadataMatch({
    fingerprintValue,
    metadata,
    outputKind,
    stripePaymentId,
}: {
    fingerprintValue: string;
    metadata: Record<string, unknown>;
    outputKind: StripePaymentCompletionOutputKind;
    stripePaymentId: string;
}) {
    return (
        metadata.completionOutputKind === outputKind &&
        metadata.completionOutputVersion === outputVersion &&
        metadata.completionFingerprint === fingerprintValue &&
        metadata.stripePaymentId === stripePaymentId
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function decodeStoredItems(value: unknown, includeCurrency: boolean) {
    if (!Array.isArray(value) || value.length > 100) return null;
    const decoded = value.flatMap((candidate) => {
        if (!isRecord(candidate)) return [];
        const amountSubtotal = candidate.amountSubtotal;
        const currency = candidate.currency;
        const name = candidate.name;
        const quantity = candidate.quantity;
        if (
            !(
                amountSubtotal === undefined ||
                amountSubtotal === null ||
                typeof amountSubtotal === 'number'
            ) ||
            !(
                name === undefined ||
                name === null ||
                typeof name === 'string'
            ) ||
            !(
                quantity === undefined ||
                quantity === null ||
                typeof quantity === 'number'
            ) ||
            !(
                currency === undefined ||
                currency === null ||
                typeof currency === 'string'
            )
        ) {
            return [];
        }
        return [
            {
                amountSubtotal,
                ...(includeCurrency ? { currency } : {}),
                name,
                quantity,
            },
        ];
    });
    return decoded.length === value.length ? decoded : null;
}

type StoredOutputRow = Pick<
    typeof emailMessages.$inferSelect,
    | 'metadata'
    | 'provider'
    | 'providerMessageId'
    | 'recipients'
    | 'templateName'
>;

function decodeStoredOrderConfirmation(
    row: StoredOutputRow,
): StripePaymentOrderConfirmationOutput | null {
    const { metadata } = row;
    const cartId = metadata.cartId;
    const currency = metadata.currency;
    const manageUrl = metadata.manageUrl;
    const totalAmountCents = metadata.totalAmountCents;
    const items = decodeStoredItems(metadata.items, true);
    if (
        !(cartId === null || typeof cartId === 'number') ||
        !(currency === null || typeof currency === 'string') ||
        typeof manageUrl !== 'string' ||
        !(totalAmountCents === null || typeof totalAmountCents === 'number') ||
        !items
    ) {
        return null;
    }
    const to = row.recipients.to[0]?.address;
    if (!to) return null;
    try {
        return normalizeOrderConfirmation({
            cartId,
            currency,
            items,
            manageUrl,
            to,
            totalAmountCents,
        });
    } catch {
        return null;
    }
}

function decodeStoredPurchaseNotification(
    row: StoredOutputRow,
    stripePaymentId: string,
): StripePaymentPurchaseNotificationOutput | null {
    const { metadata } = row;
    const accountId = metadata.accountId;
    const amountTotal = metadata.amountTotal;
    const checkoutSessionId = metadata.checkoutSessionId;
    const currency = metadata.currency;
    const customerEmail = metadata.customerEmail;
    const items = decodeStoredItems(metadata.items, false);
    if (
        !(accountId === null || typeof accountId === 'string') ||
        !(amountTotal === null || typeof amountTotal === 'number') ||
        typeof checkoutSessionId !== 'string' ||
        !(currency === null || typeof currency === 'string') ||
        !(customerEmail === null || typeof customerEmail === 'string') ||
        !items
    ) {
        return null;
    }
    try {
        return normalizePurchaseNotification(stripePaymentId, {
            accountId,
            amountTotal,
            checkoutSessionId,
            currency,
            customerEmail,
            items,
        });
    } catch {
        return null;
    }
}

function validateStoredOutput(
    row: StoredOutputRow,
    stripePaymentId: string,
    outputKind: StripePaymentCompletionOutputKind,
) {
    const storedPayload =
        outputKind === 'order_confirmation'
            ? decodeStoredOrderConfirmation(row)
            : decodeStoredPurchaseNotification(row, stripePaymentId);
    if (!storedPayload) return false;
    const storedFingerprint = fingerprint(storedPayload);
    const hasNoAdditionalRecipients =
        (row.recipients.cc?.length ?? 0) === 0 &&
        (row.recipients.bcc?.length ?? 0) === 0 &&
        (row.recipients.replyTo?.length ?? 0) === 0;
    const hasExpectedRecipients =
        hasNoAdditionalRecipients &&
        (outputKind === 'order_confirmation'
            ? row.recipients.to.length === 1
            : row.recipients.to.length === 0);
    return (
        row.providerMessageId ===
            operationId(intentKey(stripePaymentId, outputKind)) &&
        row.provider ===
            (outputKind === 'order_confirmation' ? 'acs' : 'slack') &&
        row.templateName ===
            (outputKind === 'order_confirmation'
                ? orderConfirmationTemplateName
                : checkoutNotificationTemplateName) &&
        row.metadata.outboxKind ===
            (outputKind === 'order_confirmation'
                ? orderConfirmationOutboxKind
                : checkoutNotificationOutboxKind) &&
        row.metadata.outboxVersion === 1 &&
        (outputKind !== 'purchase_slack' ||
            row.metadata.notificationKind === 'purchase_slack') &&
        hasExpectedRecipients &&
        isMetadataMatch({
            fingerprintValue: storedFingerprint,
            metadata: row.metadata,
            outputKind,
            stripePaymentId,
        })
    );
}

async function ensureOutput({
    database,
    fingerprintValue,
    metadata,
    now,
    outputKind,
    recipients,
    stripePaymentId,
}: {
    database: StripePaymentCompletionOutputDatabaseClient;
    fingerprintValue: string;
    metadata: Record<string, unknown>;
    now: Date;
    outputKind: StripePaymentCompletionOutputKind;
    recipients: { to: { address: string }[] };
    stripePaymentId: string;
}) {
    const providerMessageId = operationId(
        intentKey(stripePaymentId, outputKind),
    );
    const existing = await database.query.emailMessages.findFirst({
        where: and(
            eq(emailMessages.providerMessageId, providerMessageId),
            eq(
                emailMessages.templateName,
                outputKind === 'order_confirmation'
                    ? orderConfirmationTemplateName
                    : checkoutNotificationTemplateName,
            ),
        ),
    });
    if (existing) {
        if (
            !validateStoredOutput(existing, stripePaymentId, outputKind) ||
            existing.metadata.completionFingerprint !== fingerprintValue
        ) {
            throw new StripePaymentCompletionOutputConflictError(
                stripePaymentId,
                outputKind,
            );
        }
        return { created: false, id: existing.id };
    }

    const [created] = await database
        .insert(emailMessages)
        .values({
            attachments: [],
            createdAt: now,
            fromAddress: 'suncokret@obavijesti.gredice.com',
            messageType:
                outputKind === 'order_confirmation' ? 'commerce' : 'checkout',
            metadata: {
                ...metadata,
                completionFingerprint: fingerprintValue,
                completionOutputKind: outputKind,
                completionOutputVersion: outputVersion,
                stripePaymentId,
            },
            provider: outputKind === 'order_confirmation' ? 'acs' : 'slack',
            providerMessageId,
            providerStatus: 'outbox_ready',
            queuedAt: now,
            recipients,
            status: 'queued',
            subject:
                outputKind === 'order_confirmation'
                    ? 'Gredice - potvrda narudžbe'
                    : 'Checkout notification: purchase_slack',
            templateName:
                outputKind === 'order_confirmation'
                    ? orderConfirmationTemplateName
                    : checkoutNotificationTemplateName,
            updatedAt: now,
        })
        .returning({ id: emailMessages.id });
    if (!created) {
        throw new Error('Failed to create Stripe payment completion output');
    }
    return { created: true, id: created.id };
}

export async function ensureStripePaymentCompletionOutputs({
    claimToken,
    database = storage(),
    now = new Date(),
    orderConfirmation,
    purchaseNotification,
    stripePaymentId,
}: {
    claimToken: string;
    database?: StripePaymentCompletionOutputDatabaseClient;
    now?: Date;
    orderConfirmation: StripePaymentOrderConfirmationOutput;
    purchaseNotification: StripePaymentPurchaseNotificationOutput;
    stripePaymentId: string;
}): Promise<
    | ({ created: boolean; status: 'ready' } & StripePaymentCompletionOutputs)
    | { status: 'claim_lost' }
> {
    const normalizedPaymentId = normalizeStripePaymentId(stripePaymentId);
    const normalizedOrderConfirmation =
        normalizeOrderConfirmation(orderConfirmation);
    const normalizedPurchaseNotification = normalizePurchaseNotification(
        normalizedPaymentId,
        purchaseNotification,
    );
    const normalizedClaimToken = claimToken.trim();
    if (!normalizedClaimToken) {
        throw new TypeError('Stripe payment claim token is required');
    }

    return database.transaction(async (tx) => {
        const [claim] = await tx
            .select({
                claimToken: stripePaymentProcessingClaims.claimToken,
                leaseExpiresAt: stripePaymentProcessingClaims.leaseExpiresAt,
                status: stripePaymentProcessingClaims.status,
            })
            .from(stripePaymentProcessingClaims)
            .where(
                eq(
                    stripePaymentProcessingClaims.stripePaymentId,
                    normalizedPaymentId,
                ),
            )
            .for('update')
            .limit(1);
        if (
            claim?.status !== 'processing' ||
            claim.claimToken !== normalizedClaimToken ||
            !claim.leaseExpiresAt ||
            claim.leaseExpiresAt.getTime() <= now.getTime()
        ) {
            return { status: 'claim_lost' as const };
        }

        const orderFingerprint = fingerprint(normalizedOrderConfirmation);
        const purchaseFingerprint = fingerprint(normalizedPurchaseNotification);
        const order = await ensureOutput({
            database: tx,
            fingerprintValue: orderFingerprint,
            metadata: {
                attemptCount: 0,
                cartId: normalizedOrderConfirmation.cartId,
                currency: normalizedOrderConfirmation.currency,
                items: normalizedOrderConfirmation.items,
                manageUrl: normalizedOrderConfirmation.manageUrl,
                maxAttempts: 3,
                nextAttemptAt: null,
                outboxKind: orderConfirmationOutboxKind,
                outboxVersion: 1,
                totalAmountCents: normalizedOrderConfirmation.totalAmountCents,
            },
            now,
            outputKind: 'order_confirmation',
            recipients: {
                to: [{ address: normalizedOrderConfirmation.to }],
            },
            stripePaymentId: normalizedPaymentId,
        });
        const purchase = await ensureOutput({
            database: tx,
            fingerprintValue: purchaseFingerprint,
            metadata: {
                ...normalizedPurchaseNotification,
                attemptCount: 0,
                maxAttempts: 3,
                nextAttemptAt: null,
                notificationKind: 'purchase_slack',
                outboxKind: checkoutNotificationOutboxKind,
                outboxVersion: 1,
            },
            now,
            outputKind: 'purchase_slack',
            recipients: { to: [] },
            stripePaymentId: normalizedPaymentId,
        });

        const [linked] = await tx
            .update(stripePaymentProcessingClaims)
            .set({
                completionOutputVersion: outputVersion,
                orderConfirmationEmailMessageId: order.id,
                purchaseNotificationEmailMessageId: purchase.id,
                updatedAt: now,
            })
            .where(
                and(
                    eq(
                        stripePaymentProcessingClaims.stripePaymentId,
                        normalizedPaymentId,
                    ),
                    eq(stripePaymentProcessingClaims.status, 'processing'),
                    eq(
                        stripePaymentProcessingClaims.claimToken,
                        normalizedClaimToken,
                    ),
                    gt(stripePaymentProcessingClaims.leaseExpiresAt, now),
                ),
            )
            .returning({
                orderConfirmationEmailMessageId:
                    stripePaymentProcessingClaims.orderConfirmationEmailMessageId,
                purchaseNotificationEmailMessageId:
                    stripePaymentProcessingClaims.purchaseNotificationEmailMessageId,
            });
        if (
            !linked?.orderConfirmationEmailMessageId ||
            !linked.purchaseNotificationEmailMessageId
        ) {
            return { status: 'claim_lost' as const };
        }
        return {
            created: order.created || purchase.created,
            orderConfirmationEmailMessageId:
                linked.orderConfirmationEmailMessageId,
            outputVersion,
            purchaseNotificationEmailMessageId:
                linked.purchaseNotificationEmailMessageId,
            status: 'ready' as const,
        };
    });
}

export async function getStripePaymentCompletionOutputs(
    stripePaymentId: string,
    database: StripePaymentCompletionOutputDatabaseClient = storage(),
): Promise<StripePaymentCompletionOutputs | null> {
    const normalizedPaymentId = normalizeStripePaymentId(stripePaymentId);
    const claim = await database.query.stripePaymentProcessingClaims.findFirst({
        columns: {
            completionOutputVersion: true,
            orderConfirmationEmailMessageId: true,
            purchaseNotificationEmailMessageId: true,
        },
        where: eq(
            stripePaymentProcessingClaims.stripePaymentId,
            normalizedPaymentId,
        ),
    });
    if (
        claim?.completionOutputVersion !== outputVersion ||
        !claim.orderConfirmationEmailMessageId ||
        !claim.purchaseNotificationEmailMessageId
    ) {
        return null;
    }

    const order = await database.query.emailMessages.findFirst({
        columns: {
            id: true,
            metadata: true,
            provider: true,
            providerMessageId: true,
            recipients: true,
            templateName: true,
        },
        where: eq(emailMessages.id, claim.orderConfirmationEmailMessageId),
    });
    const purchase = await database.query.emailMessages.findFirst({
        columns: {
            id: true,
            metadata: true,
            provider: true,
            providerMessageId: true,
            recipients: true,
            templateName: true,
        },
        where: eq(emailMessages.id, claim.purchaseNotificationEmailMessageId),
    });
    if (
        !order ||
        !purchase ||
        !validateStoredOutput(
            order,
            normalizedPaymentId,
            'order_confirmation',
        ) ||
        !validateStoredOutput(purchase, normalizedPaymentId, 'purchase_slack')
    ) {
        return null;
    }
    return {
        orderConfirmationEmailMessageId: order.id,
        outputVersion,
        purchaseNotificationEmailMessageId: purchase.id,
    };
}

function aggregateTimestampToIso(value: Date | string | null) {
    if (value === null) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(
            'Stripe payment rollback preflight returned an invalid timestamp',
        );
    }
    return parsed.toISOString();
}

/**
 * Returns aggregate-only blockers for rolling back completion-output support.
 * No row identifiers, recipients, payload fields, or customer data are read.
 */
export async function getStripePaymentCompletionRollbackPreflight(
    database: StripePaymentCompletionOutputDatabaseClient = storage(),
): Promise<StripePaymentCompletionRollbackPreflight> {
    const outboxVersionOne = sql<boolean>`${emailMessages.metadata}->>'outboxVersion' = '1'`;
    const purchaseSlack = and(
        eq(emailMessages.templateName, checkoutNotificationTemplateName),
        sql<boolean>`${emailMessages.metadata}->>'outboxKind' = ${checkoutNotificationOutboxKind}`,
        outboxVersionOne,
        sql<boolean>`${emailMessages.metadata}->>'notificationKind' = 'purchase_slack'`,
    );
    const stripeOrderConfirmation = and(
        eq(emailMessages.templateName, orderConfirmationTemplateName),
        sql<boolean>`${emailMessages.metadata}->>'outboxKind' = ${orderConfirmationOutboxKind}`,
        outboxVersionOne,
        sql<boolean>`jsonb_typeof(${emailMessages.metadata}->'cartId') = 'null'`,
        sql<boolean>`${emailMessages.metadata}->>'completionOutputKind' = 'order_confirmation'`,
        sql<boolean>`${emailMessages.metadata}->>'completionOutputVersion' = '1'`,
    );
    const rollbackOnlyOutput = or(purchaseSlack, stripeOrderConfirmation);
    const rollbackBlocker = and(
        rollbackOnlyOutput,
        ne(emailMessages.status, 'sent'),
    );
    const [aggregate] = await database
        .select({
            blockingCount: sql<number>`count(*)::integer`,
            bouncedCount: sql<number>`count(*) filter (where ${eq(emailMessages.status, 'bounced')})::integer`,
            failedCount: sql<number>`count(*) filter (where ${eq(emailMessages.status, 'failed')})::integer`,
            oldestBlockingQueuedAt:
                sql<Date | null>`min(${emailMessages.queuedAt})`.mapWith(
                    emailMessages.queuedAt,
                ),
            oldestPurchaseSlackQueuedAt:
                sql<Date | null>`min(${emailMessages.queuedAt}) filter (where ${purchaseSlack})`.mapWith(
                    emailMessages.queuedAt,
                ),
            oldestStripeOrderConfirmationQueuedAt:
                sql<Date | null>`min(${emailMessages.queuedAt}) filter (where ${stripeOrderConfirmation})`.mapWith(
                    emailMessages.queuedAt,
                ),
            purchaseSlackCount: sql<number>`count(*) filter (where ${purchaseSlack})::integer`,
            queuedCount: sql<number>`count(*) filter (where ${eq(emailMessages.status, 'queued')})::integer`,
            sendingCount: sql<number>`count(*) filter (where ${eq(emailMessages.status, 'sending')})::integer`,
            stripeOrderConfirmationCount: sql<number>`count(*) filter (where ${stripeOrderConfirmation})::integer`,
        })
        .from(emailMessages)
        .where(rollbackBlocker);
    if (!aggregate) {
        throw new Error('Failed to read Stripe payment rollback preflight');
    }

    return {
        blockingCount: aggregate.blockingCount,
        oldestBlockingQueuedAt: aggregateTimestampToIso(
            aggregate.oldestBlockingQueuedAt,
        ),
        purchaseSlack: {
            blockingCount: aggregate.purchaseSlackCount,
            oldestQueuedAt: aggregateTimestampToIso(
                aggregate.oldestPurchaseSlackQueuedAt,
            ),
        },
        safeToRollback: aggregate.blockingCount === 0,
        statusCounts: {
            bounced: aggregate.bouncedCount,
            failed: aggregate.failedCount,
            queued: aggregate.queuedCount,
            sending: aggregate.sendingCount,
        },
        stripeOrderConfirmation: {
            blockingCount: aggregate.stripeOrderConfirmationCount,
            oldestQueuedAt: aggregateTimestampToIso(
                aggregate.oldestStripeOrderConfirmationQueuedAt,
            ),
        },
    };
}
