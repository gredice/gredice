import { createHash } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { events, shoppingCartItems, shoppingCarts } from '../schema';
import { storage } from '../storage';
import { lockAccountAndAssertNotDeleting } from './accountDeletionFenceRepo';
import {
    type CheckoutCartItemLockTransaction,
    withCheckoutCartItemLocks,
} from './checkoutCartItemLock';
import {
    getCheckoutOutletReservationConflict,
    releaseOutletReservationsForCheckoutAttempt,
} from './outletCheckoutReservationRepo';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = CheckoutCartItemLockTransaction;
type DatabaseClient = StorageClient | TransactionClient;

const eventTypes = {
    bound: 'checkout.stripeAttempt.bound',
    created: 'checkout.stripeAttempt.created',
    released: 'checkout.stripeAttempt.released',
} as const;

const relevantEventTypes = Object.values(eventTypes);

export type StripeCheckoutAttemptReleaseReason =
    | 'cancelled'
    | 'completed'
    | 'expired'
    | 'session_binding_failed'
    | 'session_creation_failed';

export type StripeCheckoutAttemptSnapshotItem = {
    additionalDataFingerprint: string;
    amount: number;
    cartId: number;
    checkoutAdditionalDataFingerprint: string;
    currency: string;
    entityId: string;
    entityTypeName: string;
    gardenId: number | null;
    id: number;
    outlet?: {
        comparePriceCents: number | null;
        initialPlantStatus: string;
        offerId: number;
        priceCents: number;
        reservationId: number;
        sowingDate: string;
    };
    paymentAmount: number;
    paymentKind: 'inventory' | 'paid' | 'stripe' | 'sunflower';
    positionIndex: number | null;
    raisedBedId: number | null;
    status: 'new' | 'paid';
};

export type StripeCheckoutAttemptSessionItem = {
    cartItemId: number;
    price: {
        currency: 'eur';
        valueInCents: number;
    };
    product: {
        description?: string;
        imageUrls?: string[];
        name: string;
    };
    quantity: number;
};

export type StripeCheckoutAttemptSession = {
    allowPromotionCodes: boolean;
    customerFingerprint: string;
    expiresAt: string | null;
    items: StripeCheckoutAttemptSessionItem[];
    returnUrls: {
        cancel: string;
        success: string;
    };
};

export type StripeCheckoutAttemptSnapshot = {
    attemptId: string;
    cartId: number;
    expectedNonStripeCartItemIds: number[];
    harvestDates: Array<{
        cartItemId: number;
        scheduledDate: string;
    }>;
    items: StripeCheckoutAttemptSnapshotItem[];
    stripeSession: StripeCheckoutAttemptSession;
    userFingerprint: string;
    version: 1;
};

export type StripeCheckoutAttempt = {
    releaseReason?: StripeCheckoutAttemptReleaseReason;
    sessionId?: string;
    snapshot: StripeCheckoutAttemptSnapshot;
};

type AttemptBoundData = {
    attemptId: string;
    sessionId: string;
};

type AttemptReleasedData = {
    attemptId: string;
    reason: StripeCheckoutAttemptReleaseReason;
    sessionId: string | null;
};

type AttemptEvent = {
    data: unknown;
    type: string;
};

export class StripeCheckoutAttemptInProgressError extends Error {
    override readonly name = 'StripeCheckoutAttemptInProgressError';

    constructor(readonly cartId: number) {
        super('The shopping cart has an active Stripe checkout attempt.');
    }
}

export class StripeCheckoutAttemptConflictError extends Error {
    override readonly name = 'StripeCheckoutAttemptConflictError';

    constructor(readonly category: string) {
        super(`Stripe checkout attempt conflict (${category}).`);
    }
}

const positiveSafeIntegerSchema = z
    .number()
    .int()
    .positive()
    .refine(Number.isSafeInteger);

const nullableSafeIntegerSchema = z
    .number()
    .int()
    .refine(Number.isSafeInteger)
    .nullable();

const canonicalUtcDaySchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/u)
    .refine((value) => {
        const date = new Date(value);
        return !Number.isNaN(date.getTime()) && date.toISOString() === value;
    });

const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/u);

export function serializeStripeCheckoutValue(value: unknown): string {
    if (value === undefined) {
        return 'undefined';
    }
    if (Array.isArray(value)) {
        return `[${value.map(serializeStripeCheckoutValue).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        return `{${Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(
                ([key, entry]) =>
                    `${JSON.stringify(key)}:${serializeStripeCheckoutValue(entry)}`,
            )
            .join(',')}}`;
    }
    return JSON.stringify(value);
}

export function fingerprintStripeCheckoutValue(value: unknown) {
    return createHash('sha256')
        .update(serializeStripeCheckoutValue(value))
        .digest('hex');
}

const snapshotItemSchema = z
    .object({
        additionalDataFingerprint: fingerprintSchema,
        amount: positiveSafeIntegerSchema,
        cartId: positiveSafeIntegerSchema,
        checkoutAdditionalDataFingerprint: fingerprintSchema,
        currency: z.string().min(1),
        entityId: z.string().min(1),
        entityTypeName: z.string().min(1),
        gardenId: nullableSafeIntegerSchema,
        id: positiveSafeIntegerSchema,
        outlet: z
            .object({
                comparePriceCents: nullableSafeIntegerSchema,
                initialPlantStatus: z.string().min(1),
                offerId: positiveSafeIntegerSchema,
                priceCents: positiveSafeIntegerSchema,
                reservationId: positiveSafeIntegerSchema,
                sowingDate: z.iso.datetime(),
            })
            .strict()
            .optional(),
        paymentAmount: z
            .number()
            .int()
            .nonnegative()
            .refine(Number.isSafeInteger),
        paymentKind: z.enum(['inventory', 'paid', 'stripe', 'sunflower']),
        positionIndex: nullableSafeIntegerSchema,
        raisedBedId: nullableSafeIntegerSchema,
        status: z.enum(['new', 'paid']),
    })
    .strict();

const stripeSessionItemSchema = z
    .object({
        cartItemId: positiveSafeIntegerSchema,
        price: z
            .object({
                currency: z.literal('eur'),
                valueInCents: positiveSafeIntegerSchema,
            })
            .strict(),
        product: z
            .object({
                description: z.string().optional(),
                imageUrls: z.array(z.url()).optional(),
                name: z.string().min(1),
            })
            .strict(),
        quantity: positiveSafeIntegerSchema,
    })
    .strict();

const stripeSessionSchema = z
    .object({
        allowPromotionCodes: z.boolean(),
        customerFingerprint: fingerprintSchema,
        expiresAt: z.iso.datetime().nullable(),
        items: z.array(stripeSessionItemSchema).min(1).max(100),
        returnUrls: z.object({ cancel: z.url(), success: z.url() }).strict(),
    })
    .strict();

const snapshotSchema = z
    .object({
        attemptId: z.uuid(),
        cartId: positiveSafeIntegerSchema,
        expectedNonStripeCartItemIds: z.array(positiveSafeIntegerSchema),
        harvestDates: z.array(
            z
                .object({
                    cartItemId: positiveSafeIntegerSchema,
                    scheduledDate: canonicalUtcDaySchema,
                })
                .strict(),
        ),
        items: z.array(snapshotItemSchema).min(1).max(100),
        stripeSession: stripeSessionSchema,
        userFingerprint: fingerprintSchema,
        version: z.literal(1),
    })
    .strict()
    .superRefine((snapshot, context) => {
        const itemIds = new Set<number>();
        const harvestDateItemIds = new Set<number>();
        const stripeSessionItemIds = new Set<number>();
        const expectedNonStripeIds = new Set(
            snapshot.expectedNonStripeCartItemIds,
        );
        for (const item of snapshot.items) {
            if (itemIds.has(item.id)) {
                context.addIssue({
                    code: 'custom',
                    message: 'Duplicate snapshot cart item ID',
                });
            }
            itemIds.add(item.id);
            const isExpectedNonStripe =
                item.paymentKind === 'inventory' ||
                item.paymentKind === 'sunflower';
            if (expectedNonStripeIds.has(item.id) !== isExpectedNonStripe) {
                context.addIssue({
                    code: 'custom',
                    message: 'Expected non-Stripe membership mismatch',
                });
            }
            if (
                item.cartId !== snapshot.cartId ||
                (item.paymentKind === 'stripe' && item.currency !== 'eur') ||
                (item.paymentKind === 'sunflower' &&
                    item.currency !== 'sunflower') ||
                (item.paymentKind === 'inventory' &&
                    item.currency !== 'inventory') ||
                ((item.paymentKind === 'stripe' ||
                    item.paymentKind === 'sunflower') &&
                    item.paymentAmount <= 0) ||
                ((item.paymentKind === 'inventory' ||
                    item.paymentKind === 'paid') &&
                    item.paymentAmount !== 0) ||
                (item.paymentKind === 'paid') !== (item.status === 'paid')
            ) {
                context.addIssue({
                    code: 'custom',
                    message: 'Snapshot cart item invariant mismatch',
                });
            }
        }
        if (
            expectedNonStripeIds.size !==
                snapshot.expectedNonStripeCartItemIds.length ||
            [...expectedNonStripeIds].some((id) => !itemIds.has(id))
        ) {
            context.addIssue({
                code: 'custom',
                message: 'Invalid expected non-Stripe item IDs',
            });
        }
        for (const harvestDate of snapshot.harvestDates) {
            if (
                harvestDateItemIds.has(harvestDate.cartItemId) ||
                !itemIds.has(harvestDate.cartItemId)
            ) {
                context.addIssue({
                    code: 'custom',
                    message: 'Invalid snapshot harvest date membership',
                });
            }
            harvestDateItemIds.add(harvestDate.cartItemId);
        }
        const expectedStripeItems = snapshot.items.filter(
            (item) => item.paymentKind === 'stripe',
        );
        for (const sessionItem of snapshot.stripeSession.items) {
            const cartItemId = sessionItem.cartItemId;
            const expectedItem = expectedStripeItems.find(
                (item) => item.id === cartItemId,
            );
            if (
                !expectedItem ||
                stripeSessionItemIds.has(cartItemId) ||
                sessionItem.quantity !== expectedItem.amount ||
                sessionItem.price.valueInCents !== expectedItem.paymentAmount
            ) {
                context.addIssue({
                    code: 'custom',
                    message: 'Stripe session item snapshot mismatch',
                });
            }
            stripeSessionItemIds.add(cartItemId);
        }
        if (stripeSessionItemIds.size !== expectedStripeItems.length) {
            context.addIssue({
                code: 'custom',
                message: 'Stripe session snapshot mismatch',
            });
        }
    });

function parseSnapshot(value: unknown): StripeCheckoutAttemptSnapshot {
    const parsed = snapshotSchema.safeParse(value);
    if (!parsed.success) {
        throw new StripeCheckoutAttemptConflictError('snapshot_malformed');
    }
    return parsed.data;
}

function parseBoundData(value: unknown): AttemptBoundData {
    const parsed = z
        .object({ attemptId: z.uuid(), sessionId: z.string().min(1) })
        .strict()
        .safeParse(value);
    if (!parsed.success) {
        throw new StripeCheckoutAttemptConflictError('binding_malformed');
    }
    return parsed.data;
}

function isReleaseReason(
    value: unknown,
): value is StripeCheckoutAttemptReleaseReason {
    return (
        value === 'cancelled' ||
        value === 'completed' ||
        value === 'expired' ||
        value === 'session_binding_failed' ||
        value === 'session_creation_failed'
    );
}

function parseReleasedData(value: unknown): AttemptReleasedData {
    const parsed = z
        .object({
            attemptId: z.uuid(),
            reason: z.string().refine(isReleaseReason),
            sessionId: z.string().min(1).nullable(),
        })
        .strict()
        .safeParse(value);
    if (!parsed.success) {
        throw new StripeCheckoutAttemptConflictError('release_malformed');
    }
    return parsed.data;
}

function cartAggregateId(cartId: number) {
    return `shoppingCart:${cartId.toString()}`;
}

async function getAttemptEvents(cartId: number, db: DatabaseClient) {
    return db
        .select({ data: events.data, type: events.type })
        .from(events)
        .where(
            and(
                eq(events.aggregateId, cartAggregateId(cartId)),
                inArray(events.type, relevantEventTypes),
            ),
        )
        .orderBy(asc(events.id));
}

export function foldStripeCheckoutAttemptEvents(
    attemptId: string,
    attemptEvents: readonly AttemptEvent[],
): StripeCheckoutAttempt | undefined {
    let attempt: StripeCheckoutAttempt | undefined;
    for (const event of attemptEvents) {
        if (event.type === eventTypes.created) {
            const snapshot = parseSnapshot(event.data);
            if (snapshot.attemptId !== attemptId) {
                continue;
            }
            if (attempt) {
                throw new StripeCheckoutAttemptConflictError(
                    'duplicate_snapshot',
                );
            }
            attempt = { snapshot };
            continue;
        }
        if (event.type === eventTypes.bound) {
            const binding = parseBoundData(event.data);
            if (binding.attemptId !== attemptId) {
                continue;
            }
            if (!attempt) {
                throw new StripeCheckoutAttemptConflictError(
                    'binding_without_snapshot',
                );
            }
            if (attempt.sessionId && attempt.sessionId !== binding.sessionId) {
                throw new StripeCheckoutAttemptConflictError(
                    'session_binding_changed',
                );
            }
            attempt.sessionId = binding.sessionId;
            continue;
        }
        if (event.type === eventTypes.released) {
            const release = parseReleasedData(event.data);
            if (release.attemptId !== attemptId) {
                continue;
            }
            if (!attempt) {
                throw new StripeCheckoutAttemptConflictError(
                    'release_without_snapshot',
                );
            }
            if (attempt.sessionId && attempt.sessionId !== release.sessionId) {
                throw new StripeCheckoutAttemptConflictError(
                    'release_session_mismatch',
                );
            }
            attempt.sessionId = release.sessionId ?? attempt.sessionId;
            attempt.releaseReason = release.reason;
        }
    }
    return attempt;
}

function getCreatedAttemptIds(attemptEvents: readonly AttemptEvent[]) {
    return attemptEvents.flatMap((event) => {
        if (event.type !== eventTypes.created) {
            return [];
        }
        return [parseSnapshot(event.data).attemptId];
    });
}

export async function getStripeCheckoutAttempt(
    cartId: number,
    attemptId: string,
    db: DatabaseClient = storage(),
) {
    return foldStripeCheckoutAttemptEvents(
        attemptId,
        await getAttemptEvents(cartId, db),
    );
}

export async function getActiveStripeCheckoutAttempt(
    cartId: number,
    db: DatabaseClient = storage(),
) {
    const attemptEvents = await getAttemptEvents(cartId, db);
    const activeAttempts = getCreatedAttemptIds(attemptEvents)
        .map((attemptId) =>
            foldStripeCheckoutAttemptEvents(attemptId, attemptEvents),
        )
        .filter(
            (attempt): attempt is StripeCheckoutAttempt =>
                attempt !== undefined && attempt.releaseReason === undefined,
        );
    if (activeAttempts.length > 1) {
        throw new StripeCheckoutAttemptConflictError(
            'multiple_active_attempts',
        );
    }
    return activeAttempts[0];
}

export async function hasActiveStripeCheckoutAttemptForAccount(
    accountId: string,
    db: DatabaseClient = storage(),
) {
    const carts = await db
        .select({ id: shoppingCarts.id })
        .from(shoppingCarts)
        .where(
            and(
                eq(shoppingCarts.accountId, accountId),
                eq(shoppingCarts.isDeleted, false),
            ),
        )
        .orderBy(asc(shoppingCarts.id));
    for (const cart of carts) {
        if (await getActiveStripeCheckoutAttempt(cart.id, db)) {
            return true;
        }
    }
    return false;
}

export async function assertNoActiveStripeCheckoutAttempt(
    cartId: number,
    db: DatabaseClient,
) {
    if (await getActiveStripeCheckoutAttempt(cartId, db)) {
        throw new StripeCheckoutAttemptInProgressError(cartId);
    }
}

export async function lockAndAssertShoppingCartsMutable(
    cartIds: readonly number[],
    db: TransactionClient,
) {
    const normalizedCartIds = [...new Set(cartIds)].sort(
        (left, right) => left - right,
    );
    if (normalizedCartIds.length === 0) {
        return;
    }
    const lockedCarts = await db
        .select({ id: shoppingCarts.id })
        .from(shoppingCarts)
        .where(inArray(shoppingCarts.id, normalizedCartIds))
        .orderBy(asc(shoppingCarts.id))
        .for('update');
    for (const cart of lockedCarts) {
        await assertNoActiveStripeCheckoutAttempt(cart.id, db);
    }
}

export async function lockAndAssertCartItemsMutable(
    cartItemIds: readonly number[],
    db: TransactionClient,
) {
    if (cartItemIds.length === 0) {
        return;
    }
    const cartRows = await db
        .select({ cartId: shoppingCartItems.cartId })
        .from(shoppingCartItems)
        .where(inArray(shoppingCartItems.id, [...new Set(cartItemIds)]));
    await lockAndAssertShoppingCartsMutable(
        cartRows.map((row) => row.cartId),
        db,
    );
}

export function assertStripeCheckoutAttemptSnapshotMatchesLiveCart(
    snapshot: StripeCheckoutAttemptSnapshot,
    liveItems: readonly (typeof shoppingCartItems.$inferSelect)[],
) {
    if (snapshot.items.length !== liveItems.length) {
        throw new StripeCheckoutAttemptConflictError('cart_membership_changed');
    }
    const liveItemsById = new Map(liveItems.map((item) => [item.id, item]));
    for (const expected of snapshot.items) {
        const live = liveItemsById.get(expected.id);
        if (
            !live ||
            live.cartId !== expected.cartId ||
            live.entityId !== expected.entityId ||
            live.entityTypeName !== expected.entityTypeName ||
            live.gardenId !== expected.gardenId ||
            live.raisedBedId !== expected.raisedBedId ||
            live.positionIndex !== expected.positionIndex ||
            fingerprintStripeCheckoutValue(live.additionalData) !==
                expected.additionalDataFingerprint ||
            live.amount !== expected.amount ||
            live.currency !== expected.currency ||
            live.isDeleted ||
            (expected.status === 'paid'
                ? live.status !== 'paid'
                : live.status !== 'new' && live.status !== 'paid')
        ) {
            throw new StripeCheckoutAttemptConflictError('cart_item_changed');
        }
    }
}

async function lockCartRow(cartId: number, db: TransactionClient) {
    const [cart] = await db
        .select({
            accountId: shoppingCarts.accountId,
            id: shoppingCarts.id,
            isDeleted: shoppingCarts.isDeleted,
            status: shoppingCarts.status,
        })
        .from(shoppingCarts)
        .where(eq(shoppingCarts.id, cartId))
        .for('update')
        .limit(1);
    return cart;
}

export async function createStripeCheckoutAttempt(
    snapshot: StripeCheckoutAttemptSnapshot,
    { accountId, now = new Date() }: { accountId: string; now?: Date },
) {
    parseSnapshot(snapshot);
    const itemIds = snapshot.items.map((item) => item.id);
    if (new Set(itemIds).size !== itemIds.length) {
        throw new StripeCheckoutAttemptConflictError('duplicate_cart_item');
    }
    return withCheckoutCartItemLocks(itemIds, async (db) => {
        const account = await lockAccountAndAssertNotDeleting(accountId, db);
        if (!account) {
            throw new StripeCheckoutAttemptConflictError('account_inactive');
        }
        if (
            !account.stripeCustomerId ||
            fingerprintStripeCheckoutValue(account.stripeCustomerId) !==
                snapshot.stripeSession.customerFingerprint
        ) {
            throw new StripeCheckoutAttemptConflictError(
                'checkout_identity_changed',
            );
        }
        const cart = await lockCartRow(snapshot.cartId, db);
        if (
            !cart ||
            cart.isDeleted ||
            cart.status !== 'new' ||
            cart.accountId !== accountId
        ) {
            throw new StripeCheckoutAttemptConflictError('cart_inactive');
        }
        await assertNoActiveStripeCheckoutAttempt(snapshot.cartId, db);
        const liveItems = await db
            .select()
            .from(shoppingCartItems)
            .where(
                and(
                    eq(shoppingCartItems.cartId, snapshot.cartId),
                    eq(shoppingCartItems.isDeleted, false),
                ),
            )
            .orderBy(asc(shoppingCartItems.id));
        assertStripeCheckoutAttemptSnapshotMatchesLiveCart(snapshot, liveItems);
        const outletReservationConflict =
            await getCheckoutOutletReservationConflict(
                {
                    accountId,
                    cartId: snapshot.cartId,
                    cartItemIds: snapshot.items.map((item) => item.id),
                    expectations: snapshot.items.flatMap((item) =>
                        item.outlet
                            ? [
                                  {
                                      cartItemId: item.id,
                                      comparePriceCents:
                                          item.outlet.comparePriceCents,
                                      ...(item.paymentKind === 'stripe' &&
                                      snapshot.stripeSession.expiresAt
                                          ? {
                                                expiresAt:
                                                    snapshot.stripeSession
                                                        .expiresAt,
                                            }
                                          : {}),
                                      id: item.outlet.reservationId,
                                      initialPlantStatus:
                                          item.outlet.initialPlantStatus,
                                      offerId: item.outlet.offerId,
                                      plantSortId: item.entityId,
                                      priceCents: item.outlet.priceCents,
                                      quantity: item.amount,
                                      sowingDate: item.outlet.sowingDate,
                                      statuses:
                                          item.status === 'paid'
                                              ? (['converted'] as const)
                                              : (['held'] as const),
                                  },
                              ]
                            : [],
                    ),
                    now,
                },
                db,
            );
        if (outletReservationConflict) {
            throw new StripeCheckoutAttemptConflictError(
                outletReservationConflict,
            );
        }
        await db.insert(events).values({
            aggregateId: cartAggregateId(snapshot.cartId),
            data: snapshot,
            type: eventTypes.created,
            version: 1,
        });
        return snapshot;
    });
}

export async function bindStripeCheckoutAttempt({
    attemptId,
    cartId,
    sessionId,
}: AttemptBoundData & { cartId: number }) {
    return storage().transaction(async (db) => {
        await lockCartRow(cartId, db);
        const attempt = await getStripeCheckoutAttempt(cartId, attemptId, db);
        if (!attempt) {
            throw new StripeCheckoutAttemptConflictError('attempt_missing');
        }
        if (attempt.releaseReason) {
            throw new StripeCheckoutAttemptConflictError('attempt_released');
        }
        if (attempt.sessionId) {
            if (attempt.sessionId !== sessionId) {
                throw new StripeCheckoutAttemptConflictError(
                    'session_binding_changed',
                );
            }
            return attempt;
        }
        await db.insert(events).values({
            aggregateId: cartAggregateId(cartId),
            data: { attemptId, sessionId },
            type: eventTypes.bound,
            version: 1,
        });
        return { ...attempt, sessionId };
    });
}

export async function releaseStripeCheckoutAttempt({
    attemptId,
    cartId,
    reason,
    sessionId,
}: AttemptReleasedData & { cartId: number }) {
    return storage().transaction(async (db) => {
        await lockCartRow(cartId, db);
        const attempt = await getStripeCheckoutAttempt(cartId, attemptId, db);
        if (!attempt) {
            throw new StripeCheckoutAttemptConflictError('attempt_missing');
        }
        if (attempt.sessionId && attempt.sessionId !== sessionId) {
            throw new StripeCheckoutAttemptConflictError(
                'session_binding_changed',
            );
        }
        if (attempt.releaseReason) {
            const equivalentAbandonment =
                (attempt.releaseReason === 'cancelled' ||
                    attempt.releaseReason === 'expired') &&
                (reason === 'cancelled' || reason === 'expired');
            if (
                (!equivalentAbandonment && attempt.releaseReason !== reason) ||
                attempt.sessionId !== (sessionId ?? attempt.sessionId)
            ) {
                throw new StripeCheckoutAttemptConflictError('release_changed');
            }
            return attempt;
        }
        if (!attempt.sessionId && sessionId) {
            await db.insert(events).values({
                aggregateId: cartAggregateId(cartId),
                data: { attemptId, sessionId },
                type: eventTypes.bound,
                version: 1,
            });
        }
        // Cleanup commits before the release event removes the cart fence.
        // Replays of an already released attempt intentionally skip cleanup so
        // they cannot release reservations created by a subsequent attempt.
        await releaseOutletReservationsForCheckoutAttempt(
            cartId,
            attempt.snapshot.items.flatMap((item) =>
                item.outlet ? [item.outlet.reservationId] : [],
            ),
            new Date(),
            db,
        );
        await db.insert(events).values({
            aggregateId: cartAggregateId(cartId),
            data: { attemptId, reason, sessionId },
            type: eventTypes.released,
            version: 1,
        });
        return {
            ...attempt,
            releaseReason: reason,
            sessionId: sessionId ?? attempt.sessionId,
        };
    });
}

export async function verifyStripeCheckoutAttemptLiveCart(
    attempt: StripeCheckoutAttempt,
) {
    return withCheckoutCartItemLocks(
        attempt.snapshot.items.map((item) => item.id),
        async (db) => {
            const cart = await db.query.shoppingCarts.findFirst({
                columns: {
                    accountId: true,
                    id: true,
                    isDeleted: true,
                    status: true,
                },
                where: eq(shoppingCarts.id, attempt.snapshot.cartId),
            });
            if (
                !cart ||
                cart.isDeleted ||
                (cart.status !== 'new' && cart.status !== 'paid') ||
                !cart.accountId
            ) {
                throw new StripeCheckoutAttemptConflictError('cart_inactive');
            }
            const liveItems = await db
                .select()
                .from(shoppingCartItems)
                .where(
                    and(
                        eq(shoppingCartItems.cartId, attempt.snapshot.cartId),
                        eq(shoppingCartItems.isDeleted, false),
                    ),
                )
                .orderBy(asc(shoppingCartItems.id));
            assertStripeCheckoutAttemptSnapshotMatchesLiveCart(
                attempt.snapshot,
                liveItems,
            );
            const liveItemStatusById = new Map(
                liveItems.map((item) => [item.id, item.status]),
            );
            const outletReservationConflict =
                await getCheckoutOutletReservationConflict(
                    {
                        accountId: cart.accountId,
                        cartId: attempt.snapshot.cartId,
                        cartItemIds: attempt.snapshot.items.map(
                            (item) => item.id,
                        ),
                        expectations: attempt.snapshot.items.flatMap((item) =>
                            item.outlet
                                ? [
                                      {
                                          cartItemId: item.id,
                                          comparePriceCents:
                                              item.outlet.comparePriceCents,
                                          ...(item.paymentKind === 'stripe' &&
                                          attempt.snapshot.stripeSession
                                              .expiresAt
                                              ? {
                                                    expiresAt:
                                                        attempt.snapshot
                                                            .stripeSession
                                                            .expiresAt,
                                                }
                                              : {}),
                                          id: item.outlet.reservationId,
                                          initialPlantStatus:
                                              item.outlet.initialPlantStatus,
                                          offerId: item.outlet.offerId,
                                          plantSortId: item.entityId,
                                          priceCents: item.outlet.priceCents,
                                          quantity: item.amount,
                                          sowingDate: item.outlet.sowingDate,
                                          statuses:
                                              liveItemStatusById.get(
                                                  item.id,
                                              ) === 'paid'
                                                  ? (['converted'] as const)
                                                  : ([
                                                        'held',
                                                        'converted',
                                                    ] as const),
                                      },
                                  ]
                                : [],
                        ),
                        now: new Date(),
                        requireActiveHolds: false,
                    },
                    db,
                );
            if (outletReservationConflict) {
                throw new StripeCheckoutAttemptConflictError(
                    outletReservationConflict,
                );
            }
            return { accountId: cart.accountId, items: liveItems };
        },
    );
}

export const stripeCheckoutAttemptEventTypes = eventTypes;
