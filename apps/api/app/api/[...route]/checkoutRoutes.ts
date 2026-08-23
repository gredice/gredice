import { isRaisedBedAbandoned } from '@gredice/js/raisedBeds';
import {
    assignStripeCustomerIdIfUnchanged,
    bindStripeCheckoutAttempt,
    bustRaisedBedPlantingReadCaches,
    cartContainsDeliverableItems,
    consumeInventoryItem,
    createStripeCheckoutAttempt,
    type EntityStandardized,
    fingerprintStripeCheckoutValue,
    getAccount,
    getActiveStripeCheckoutAttempt,
    getBlockingPlantOperationsForRaisedBedFootprint,
    getCheckoutFulfillmentStartedCartItemIds,
    getCheckoutOperationMapping,
    getCheckoutOperationMappings,
    getDeliveryAddress,
    getEntityFormatted,
    getEntityRaw,
    getGarden,
    getHarvestScheduleForCart,
    getPickupLocation,
    getRaisedBed,
    getRaisedBedPlantingsForRaisedBed,
    getShoppingCart,
    getShoppingCartItemAdvancedSowingAuthorizations,
    getStripeCheckoutAttempt,
    getSunflowerPackageEligibilityForAccount,
    getTimeSlot,
    getTimeSlotEffectiveClosesAt,
    getUser,
    HarvestScheduleConflictError,
    markCartPaidAndEnqueueOrderConfirmation,
    normalizeShoppingCartInventoryUsage,
    normalizeShoppingCartScheduledDates,
    OUTLET_RESERVATION_HOLD_MINUTES,
    OutletOfferUnavailableError,
    OutletReservationUnavailableError,
    releaseOutletReservationsForCart,
    releaseStripeCheckoutAttempt,
    reserveOutletOffer,
    StripeCheckoutAttemptConflictError,
    StripeCheckoutAttemptInProgressError,
    setCartItemPaid,
    sunflowerPackageEntityTypeName,
    validateHarvestDateSelections,
    withCheckoutCartItemLock,
    withInventoryAccountTransaction,
} from '@gredice/storage';
import {
    getStripeCheckoutReturnUrls,
    getStripeCheckoutSession,
    resolveStripeCustomerId,
    stripeCheckout,
    stripeSessionCancel,
} from '@gredice/stripe/server';
import { Hono } from 'hono';
import { describeRoute, resolver, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import {
    assertAdvancedSowingPlanAvailable,
    assertLegacySowingCartTargetsAvailable,
    assertNoBlockingLegacyPlantOperations,
    DuplicateDirectSowingCartTargetError,
    LegacySowingSelectedPlantingConflictError,
} from '../../../lib/checkout/advancedSowingAvailability';
import {
    buildAdvancedSowingLegacyDensitySnapshots,
    haveMatchingAdvancedSowingLegacyDensitySnapshots,
} from '../../../lib/checkout/advancedSowingLegacyDensity';
import {
    AdvancedSowingPlanBoundaryError,
    assertNoReservedAdvancedSowingAdditionalData,
    buildAdvancedSowingSupportedCartTarget,
    readAdvancedSowingCatalogueDistanceRange,
    validateAdvancedSowingCartAuthorizationBeforeCheckout,
} from '../../../lib/checkout/advancedSowingPlan';
import { getCartInfo } from '../../../lib/checkout/cartInfo';
import {
    assertCheckoutCartItemSnapshot,
    getCheckoutOperationRecoveryState,
} from '../../../lib/checkout/checkoutRecovery';
import {
    type CheckoutPaymentKind,
    type CheckoutTimingVariables,
    checkoutTimingMiddleware,
} from '../../../lib/checkout/checkoutTiming';
import {
    CheckoutDeliverySelectionError,
    resolveCheckoutRequiresDelivery,
    validateCheckoutDeliverySelection,
} from '../../../lib/checkout/deliverySelection';
import { getDirectCheckoutPaymentErrorResponse } from '../../../lib/checkout/directCheckoutErrors';
import { getPaidCartCheckoutRetryResponse } from '../../../lib/checkout/directCheckoutRetry';
import { withDirectSunflowerCheckoutBatch } from '../../../lib/checkout/directSunflowerCheckout';
import { buildCheckoutAdditionalData } from '../../../lib/checkout/harvestCheckout';
import {
    buildOrderConfirmationItems,
    ORDER_CONFIRMATION_MANAGE_URL,
} from '../../../lib/checkout/orderConfirmationEmail';
import { recoverStripeCheckoutAttemptAfterCreateRace } from '../../../lib/checkout/stripeCheckoutCreateRace';
import { recoverStripeCheckoutAttemptSession } from '../../../lib/checkout/stripeCheckoutRecovery';
import {
    buildStripeCheckoutAttemptSnapshot,
    decodeStripeCheckoutAttemptMetadata,
    rebuildStripeCheckoutAttemptAdditionalData,
} from '../../../lib/checkout/stripeCheckoutSnapshot';
import { authSecurity } from '../../../lib/docs/security';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';
import { getPostHogClient } from '../../../lib/posthog-server';
import {
    assertCheckoutItemFulfilled,
    processItem,
} from '../../../lib/stripe/processCheckoutSession';
import {
    buildSunflowerPackageCatalogResponse,
    sunflowerPackageCatalogResponseSchema,
} from '../../../lib/sunflowers/packageCatalog';

const STRIPE_MIN_CHECKOUT_SESSION_LIFETIME_MINUTES = 30;
const OUTLET_CHECKOUT_HOLD_MINUTES = Math.max(
    OUTLET_RESERVATION_HOLD_MINUTES,
    // Stripe requires checkout sessions to expire at least 30 minutes out.
    STRIPE_MIN_CHECKOUT_SESSION_LIFETIME_MINUTES + 1,
);

async function loadLegacyDensitySnapshots(
    plantings: Awaited<ReturnType<typeof getRaisedBedPlantingsForRaisedBed>>,
) {
    const legacyPlantSortIds = Array.from(
        new Set(
            plantings.flatMap((planting) =>
                planting.configurationSource === 'legacy' &&
                planting.isActive &&
                !planting.isDeleted
                    ? [planting.plantSortId]
                    : [],
            ),
        ),
    );
    const seedingDistanceByPlantSortId = new Map<
        number,
        number | null | undefined
    >();
    await Promise.all(
        legacyPlantSortIds.map(async (plantSortId) => {
            const plantSort =
                await getEntityFormatted<EntityStandardized>(plantSortId);
            if (plantSort) {
                seedingDistanceByPlantSortId.set(
                    plantSortId,
                    plantSort.information?.plant?.attributes?.seedingDistance,
                );
            }
        }),
    );
    return buildAdvancedSowingLegacyDensitySnapshots({
        plantings,
        seedingDistanceByPlantSortId,
    });
}

const packageCheckoutBodySchema = z.object({
    returnContext: z
        .object({
            source: z.enum(['garden', 'www']).optional(),
            path: z.string().max(200).optional(),
        })
        .optional(),
});

function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

type CheckoutVariables = AuthVariables & CheckoutTimingVariables;

const app = new Hono<{ Variables: CheckoutVariables }>()
    .get(
        '/sunflower-packages',
        describeRoute({
            description:
                'Get active sunflower packages with eligibility for package checkout',
            security: authSecurity,
            responses: {
                200: {
                    description: 'Active sunflower package catalog',
                    content: {
                        'application/json': {
                            schema: resolver(
                                sunflowerPackageCatalogResponseSchema,
                            ),
                        },
                    },
                },
            },
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const packages =
                await getSunflowerPackageEligibilityForAccount(accountId);
            return context.json(buildSunflowerPackageCatalogResponse(packages));
        },
    )
    .post(
        '/checkout',
        describeRoute({
            description: 'Create a Stripe checkout session for the given cart',
        }),
        checkoutTimingMiddleware<{ Variables: CheckoutVariables }>(),
        authValidator(['user', 'admin']),
        zValidator(
            'json',
            z.object({
                cartId: z.number(),
                deliveryInfo: z
                    .object({
                        slotId: z.number(),
                        mode: z.enum(['delivery', 'pickup']),
                        addressId: z.number().optional(),
                        locationId: z.number().optional(),
                        notes: z.string().max(500).optional(),
                    })
                    .optional(),
                harvestDates: z
                    .array(
                        z.object({
                            cartItemId: z.number().int().positive(),
                            scheduledDate: z
                                .string()
                                .regex(/^\d{4}-\d{2}-\d{2}$/),
                        }),
                    )
                    .max(100)
                    .optional(),
            }),
        ),
        async (context) => {
            const checkoutTiming = context.get('checkoutTiming');
            const {
                accountId,
                user: authUser,
                userId,
            } = context.get('authContext');
            const { cartId, deliveryInfo, harvestDates } =
                context.req.valid('json');
            if (authUser.isTemporary) {
                return context.json(
                    {
                        error: 'Upgrade required before checkout',
                        errorCode: 'upgrade_required',
                    },
                    403,
                );
            }

            // Retrieve data
            const [account, user, initialCart] = await checkoutTiming.measure(
                'account_cart_load',
                () =>
                    Promise.all([
                        getAccount(accountId),
                        getUser(userId),
                        getShoppingCart(cartId),
                    ]),
            );
            if (!account) {
                return context.json({ error: 'Account not found' }, 404);
            }
            if (!user) {
                return context.json({ error: 'User not found' }, 404);
            }
            if (!initialCart) {
                return context.json({ error: 'Cart not found' }, 404);
            }
            if (initialCart.accountId !== accountId) {
                console.warn('Account ID mismatch', {
                    accountId,
                    cartAccountId: initialCart.accountId,
                });
                return context.json({ error: 'Cart not found' }, 404);
            }
            if (initialCart.status === 'paid') {
                if (initialCart.items.some((item) => item.currency === 'eur')) {
                    return context.json({ error: 'Cart already paid' }, 400);
                }
                const retryResponse = await getPaidCartCheckoutRetryResponse({
                    accountId,
                    cart: initialCart,
                });
                if (!retryResponse) {
                    return context.json({ error: 'Cart not found' }, 404);
                }
                return context.json(retryResponse.body, retryResponse.status);
            }

            const assertSowingCartAvailableBeforePayment = async (
                items: typeof initialCart.items,
            ) => {
                const authorizationsByCartItemId =
                    await getShoppingCartItemAdvancedSowingAuthorizations(
                        items.map((item) => item.id),
                    );
                await assertLegacySowingCartTargetsAvailable({
                    authorizationsByCartItemId,
                    cartItems: items,
                    loadPlantingsForRaisedBed:
                        getRaisedBedPlantingsForRaisedBed,
                });
                const itemsById = new Map(items.map((item) => [item.id, item]));
                await Promise.all(
                    Array.from(authorizationsByCartItemId).map(
                        async ([cartItemId, authorization]) => {
                            const item = itemsById.get(cartItemId);
                            if (item?.status === 'paid') {
                                return;
                            }
                            if (
                                item?.entityTypeName !== 'plantSort' ||
                                item.amount !== 1 ||
                                item.raisedBedId === null ||
                                item.positionIndex === null ||
                                item.positionIndex !==
                                    authorization.plan.anchorPositionIndex
                            ) {
                                throw new AdvancedSowingPlanBoundaryError(
                                    'target_mismatch',
                                );
                            }
                            assertNoBlockingLegacyPlantOperations(
                                await getBlockingPlantOperationsForRaisedBedFootprint(
                                    {
                                        positionIndices:
                                            authorization.plan
                                                .occupiedPositionIndices,
                                        raisedBedId: item.raisedBedId,
                                    },
                                ),
                            );
                        },
                    ),
                );
                return authorizationsByCartItemId;
            };

            const sowingAvailabilityConflictResponse = (error: unknown) => {
                if (
                    error instanceof LegacySowingSelectedPlantingConflictError
                ) {
                    return context.json(
                        {
                            code: 'LEGACY_SOWING_SELECTED_PLANTING_CONFLICT',
                            error: error.message,
                        },
                        409,
                    );
                }
                if (error instanceof DuplicateDirectSowingCartTargetError) {
                    return context.json(
                        {
                            code: 'DUPLICATE_SOWING_CART_TARGET',
                            error: error.message,
                        },
                        409,
                    );
                }
                if (error instanceof AdvancedSowingPlanBoundaryError) {
                    return context.json(
                        {
                            code: `ADVANCED_SOWING_${error.reasonCode.toUpperCase()}`,
                            error: error.message,
                        },
                        409,
                    );
                }
                return null;
            };

            const recoverAttempt = async (
                attempt: NonNullable<
                    Awaited<ReturnType<typeof getActiveStripeCheckoutAttempt>>
                >,
                liveItems: typeof initialCart.items = initialCart.items,
                resolvedCustomerId = account.stripeCustomerId ?? undefined,
            ) => {
                const attemptUser = account.accountUsers.find(
                    (accountUser) =>
                        fingerprintStripeCheckoutValue(accountUser.userId) ===
                        attempt.snapshot.userFingerprint,
                );
                if (
                    !attemptUser ||
                    !resolvedCustomerId ||
                    fingerprintStripeCheckoutValue(resolvedCustomerId) !==
                        attempt.snapshot.stripeSession.customerFingerprint
                ) {
                    throw new StripeCheckoutAttemptConflictError(
                        'checkout_identity_changed',
                    );
                }
                const checkoutAdditionalDataByCartItemId = attempt.sessionId
                    ? undefined
                    : rebuildStripeCheckoutAttemptAdditionalData({
                          attempt,
                          deliveryInfo,
                          liveItems,
                      });
                return recoverStripeCheckoutAttemptSession({
                    account: {
                        email: user.userName,
                        id: account.id,
                        name: user.userName,
                        stripeCustomerId: resolvedCustomerId,
                    },
                    accountId,
                    attempt,
                    checkoutAdditionalDataByCartItemId,
                    customerId: resolvedCustomerId,
                    dependencies: {
                        bindAttempt: bindStripeCheckoutAttempt,
                        checkout: stripeCheckout,
                        getAttempt: getStripeCheckoutAttempt,
                        getSession: getStripeCheckoutSession,
                        releaseAttempt: releaseStripeCheckoutAttempt,
                    },
                    userId: attemptUser.userId,
                });
            };

            const activeAttempt = await getActiveStripeCheckoutAttempt(cartId);
            if (activeAttempt) {
                try {
                    await assertSowingCartAvailableBeforePayment(
                        initialCart.items,
                    );
                    const recovery = await recoverAttempt(activeAttempt);
                    if (recovery.status === 'open' && recovery.url) {
                        return context.json({
                            sessionId: recovery.sessionId,
                            url: recovery.url,
                        });
                    }
                    if (recovery.status === 'processing') {
                        return context.json(
                            {
                                code: 'CHECKOUT_PAYMENT_PROCESSING',
                                error: 'Plaćanje se još obrađuje. Pričekaj trenutak i pokušaj ponovno.',
                            },
                            409,
                        );
                    }
                } catch (error) {
                    const conflictResponse =
                        sowingAvailabilityConflictResponse(error);
                    if (conflictResponse) {
                        return conflictResponse;
                    }
                    if (error instanceof StripeCheckoutAttemptConflictError) {
                        return context.json(
                            {
                                code: 'CHECKOUT_CART_CHANGED',
                                error: 'Košarica se promijenila. Osvježi je i pokušaj ponovno.',
                            },
                            409,
                        );
                    }
                    throw error;
                }
            }

            const { cart, checkoutOperationMappings } =
                await checkoutTiming.measure('cart_normalization', async () => {
                    const mappings = await getCheckoutOperationMappings(
                        initialCart.items
                            .filter(
                                (item) =>
                                    item.status !== 'paid' &&
                                    item.entityTypeName === 'operation',
                            )
                            .map((item) => item.id),
                    );
                    const inventoryNormalizedCart =
                        (await normalizeShoppingCartInventoryUsage(cartId)) ??
                        initialCart;
                    const normalizedCart =
                        (await normalizeShoppingCartScheduledDates(
                            inventoryNormalizedCart.id,
                            {
                                checkoutOperationMappings: mappings,
                                defaultMissingScheduledDates: true,
                            },
                        )) ?? inventoryNormalizedCart;
                    return {
                        cart: normalizedCart,
                        checkoutOperationMappings: mappings,
                    };
                });
            const mappedOperationCartItemIds = new Set(
                checkoutOperationMappings.keys(),
            );
            const pendingEuroItems = cart.items.filter(
                (item) => item.status !== 'paid' && item.currency === 'eur',
            );
            const fulfillmentStartedCartItemIds =
                pendingEuroItems.length > 0
                    ? await getCheckoutFulfillmentStartedCartItemIds(
                          accountId,
                          pendingEuroItems,
                      )
                    : new Set<number>();
            const checkoutOperationRecoveryState =
                getCheckoutOperationRecoveryState(
                    cart.items,
                    checkoutOperationMappings,
                    fulfillmentStartedCartItemIds,
                );
            if (checkoutOperationRecoveryState) {
                checkoutTiming.setContext({ paymentKind: 'stripe' });
                return context.json(
                    {
                        code:
                            checkoutOperationRecoveryState ===
                            'stripe_payment_processing'
                                ? 'CHECKOUT_PAYMENT_PROCESSING'
                                : 'CHECKOUT_PAYMENT_CONFLICT',
                        error:
                            checkoutOperationRecoveryState ===
                            'stripe_payment_processing'
                                ? 'Plaćanje se još obrađuje. Pričekaj trenutak i pokušaj ponovno.'
                                : 'Način plaćanja promijenjen je tijekom obrade. Osvježi košaricu i pokušaj ponovno.',
                    },
                    409,
                );
            }
            const endDeliveryValidation = checkoutTiming.startPhase(
                'delivery_validation',
            );
            let canonicalHarvestDates: Array<{
                cartItemId: number;
                scheduledDate: string;
            }> = [];

            try {
                const requiresDelivery = await resolveCheckoutRequiresDelivery(
                    cart.items,
                    mappedOperationCartItemIds,
                    () =>
                        cartContainsDeliverableItems(cart.id, {
                            excludeCartItemIds: [...mappedOperationCartItemIds],
                        }),
                );
                const requiresMutableDeliveryPreflight =
                    mappedOperationCartItemIds.size === 0 || requiresDelivery;
                const [slot, address, location] =
                    requiresMutableDeliveryPreflight
                        ? await Promise.all([
                              deliveryInfo
                                  ? getTimeSlot(deliveryInfo.slotId)
                                  : Promise.resolve(undefined),
                              deliveryInfo?.mode === 'delivery' &&
                              deliveryInfo.addressId
                                  ? getDeliveryAddress(
                                        deliveryInfo.addressId,
                                        accountId,
                                    )
                                  : Promise.resolve(undefined),
                              deliveryInfo?.mode === 'pickup' &&
                              deliveryInfo.locationId
                                  ? getPickupLocation(deliveryInfo.locationId)
                                  : Promise.resolve(undefined),
                          ])
                        : [undefined, undefined, undefined];
                if (requiresMutableDeliveryPreflight) {
                    validateCheckoutDeliverySelection({
                        address,
                        location,
                        requiresDelivery,
                        selection: deliveryInfo,
                        slot: slot
                            ? {
                                  ...slot,
                                  effectiveClosesAt:
                                      getTimeSlotEffectiveClosesAt(slot),
                              }
                            : undefined,
                    });
                }

                if (deliveryInfo && requiresMutableDeliveryPreflight) {
                    const schedule = await getHarvestScheduleForCart({
                        accountId,
                        cartId: cart.id,
                        deliverySlotId: deliveryInfo.slotId,
                        excludeCartItemIds: [...mappedOperationCartItemIds],
                    });
                    canonicalHarvestDates = validateHarvestDateSelections(
                        schedule,
                        (harvestDates ?? []).filter(
                            (selection) =>
                                !mappedOperationCartItemIds.has(
                                    selection.cartItemId,
                                ),
                        ),
                    );
                } else if (
                    harvestDates?.some(
                        (selection) =>
                            !mappedOperationCartItemIds.has(
                                selection.cartItemId,
                            ),
                    )
                ) {
                    return context.json(
                        {
                            error: 'Delivery selection is required for harvest dates',
                        },
                        400,
                    );
                }
            } catch (error) {
                if (error instanceof CheckoutDeliverySelectionError) {
                    return context.json(
                        {
                            error: error.message,
                            code: error.code,
                        },
                        error.status,
                    );
                }
                if (error instanceof HarvestScheduleConflictError) {
                    return context.json(
                        {
                            error: error.message,
                            code: error.code,
                            details: error.details,
                        },
                        error.statusCode,
                    );
                }

                throw error;
            } finally {
                endDeliveryValidation();
            }

            const harvestDateByCartItemId = new Map(
                canonicalHarvestDates.map((selection) => [
                    selection.cartItemId,
                    selection.scheduledDate,
                ]),
            );
            // Retrieve entities data
            let cartInfo = await checkoutTiming.measure('cart_enrichment', () =>
                getCartInfo(cart.items, accountId, {
                    checkoutOperationMappings,
                }),
            );
            if (!cartInfo.allowPurchase) {
                const pendingDirectItems = cart.items.filter(
                    (item) => item.status !== 'paid' && item.currency !== 'eur',
                );
                const resumableDirectCartItemIds =
                    pendingDirectItems.length > 0
                        ? await getCheckoutFulfillmentStartedCartItemIds(
                              accountId,
                              pendingDirectItems,
                          )
                        : new Set<number>();
                if (resumableDirectCartItemIds.size > 0) {
                    cartInfo = await getCartInfo(cart.items, accountId, {
                        checkoutOperationMappings,
                        resumableCartItemIds: resumableDirectCartItemIds,
                    });
                }
            }
            if (!cartInfo.allowPurchase) {
                return context.json({ error: 'Cart in invalid state' }, 400);
            }
            let persistedAdvancedSowingAuthorizationsByCartItemId: Awaited<
                ReturnType<
                    typeof getShoppingCartItemAdvancedSowingAuthorizations
                >
            >;
            try {
                persistedAdvancedSowingAuthorizationsByCartItemId =
                    await assertSowingCartAvailableBeforePayment(cart.items);
            } catch (error) {
                const conflictResponse =
                    sowingAvailabilityConflictResponse(error);
                if (conflictResponse) {
                    return conflictResponse;
                }
                throw error;
            }
            let advancedSowingAuthorizationsByCartItemId =
                persistedAdvancedSowingAuthorizationsByCartItemId;
            if (persistedAdvancedSowingAuthorizationsByCartItemId.size > 0) {
                const cartInfoItemsById = new Map(
                    cartInfo.items.map((item) => [item.id, item]),
                );
                const plantingPromisesByRaisedBedId = new Map<
                    number,
                    ReturnType<typeof getRaisedBedPlantingsForRaisedBed>
                >();
                const loadPlantingsForRaisedBed = (raisedBedId: number) => {
                    const existing =
                        plantingPromisesByRaisedBedId.get(raisedBedId);
                    if (existing) {
                        return existing;
                    }
                    const pending =
                        getRaisedBedPlantingsForRaisedBed(raisedBedId);
                    plantingPromisesByRaisedBedId.set(raisedBedId, pending);
                    return pending;
                };
                try {
                    advancedSowingAuthorizationsByCartItemId = new Map(
                        await Promise.all(
                            Array.from(
                                persistedAdvancedSowingAuthorizationsByCartItemId,
                            ).map(async ([cartItemId, authorization]) => {
                                const item = cartInfoItemsById.get(cartItemId);
                                const entityId = Number(item?.entityId);
                                if (
                                    !item ||
                                    item.status === 'paid' ||
                                    item.entityTypeName !== 'plantSort' ||
                                    item.amount !== 1 ||
                                    item.gardenId === null ||
                                    item.raisedBedId === null ||
                                    item.positionIndex === null ||
                                    !Number.isSafeInteger(entityId) ||
                                    entityId <= 0
                                ) {
                                    throw new AdvancedSowingPlanBoundaryError(
                                        'target_mismatch',
                                    );
                                }

                                const [raisedBed, garden, rawPlantSort] =
                                    await Promise.all([
                                        getRaisedBed(item.raisedBedId),
                                        getGarden(item.gardenId),
                                        getEntityRaw(entityId),
                                    ]);
                                if (
                                    !raisedBed ||
                                    raisedBed.accountId !== accountId ||
                                    raisedBed.gardenId !== item.gardenId ||
                                    isRaisedBedAbandoned(raisedBed.status) ||
                                    !garden ||
                                    garden.accountId !== accountId ||
                                    garden.isSandbox
                                ) {
                                    throw new AdvancedSowingPlanBoundaryError(
                                        'target_mismatch',
                                    );
                                }
                                if (
                                    rawPlantSort?.state !== 'published' ||
                                    rawPlantSort.entityType?.name !==
                                        'plantSort'
                                ) {
                                    throw new AdvancedSowingPlanBoundaryError(
                                        'catalogue_mismatch',
                                    );
                                }

                                const validatedAuthorization =
                                    validateAdvancedSowingCartAuthorizationBeforeCheckout(
                                        {
                                            catalogueDistanceRange:
                                                readAdvancedSowingCatalogueDistanceRange(
                                                    item.entityData.information
                                                        ?.plant?.attributes,
                                                ),
                                            persistedAuthorization:
                                                authorization,
                                            target: buildAdvancedSowingSupportedCartTarget(
                                                item.positionIndex,
                                            ),
                                        },
                                    );
                                if (!validatedAuthorization) {
                                    throw new AdvancedSowingPlanBoundaryError(
                                        'invalid_authorization',
                                    );
                                }
                                const plantings =
                                    await loadPlantingsForRaisedBed(
                                        item.raisedBedId,
                                    );
                                const currentLegacyDensitySnapshots =
                                    await loadLegacyDensitySnapshots(plantings);
                                if (
                                    !haveMatchingAdvancedSowingLegacyDensitySnapshots(
                                        validatedAuthorization.legacyDensitySnapshots ??
                                            [],
                                        currentLegacyDensitySnapshots,
                                    )
                                ) {
                                    throw new AdvancedSowingPlanBoundaryError(
                                        'legacy_layout_unknown',
                                    );
                                }
                                assertAdvancedSowingPlanAvailable({
                                    authorizationsByCartItemId:
                                        persistedAdvancedSowingAuthorizationsByCartItemId,
                                    cartItems: cart.items,
                                    excludedCartItemId: cartItemId,
                                    gardenId: item.gardenId,
                                    legacyDensitySnapshots:
                                        currentLegacyDensitySnapshots,
                                    plan: validatedAuthorization.plan,
                                    plantings,
                                    raisedBedId: item.raisedBedId,
                                });
                                return [
                                    cartItemId,
                                    validatedAuthorization,
                                ] as const;
                            }),
                        ),
                    );
                } catch (error) {
                    if (error instanceof AdvancedSowingPlanBoundaryError) {
                        return context.json(
                            {
                                code: `ADVANCED_SOWING_${error.reasonCode.toUpperCase()}`,
                                error: error.message,
                            },
                            409,
                        );
                    }
                    throw error;
                }
            }
            let checkoutAdditionalDataByCartItemId: ReadonlyMap<
                number,
                ReturnType<typeof buildCheckoutAdditionalData>
            >;
            try {
                checkoutAdditionalDataByCartItemId = new Map(
                    cartInfo.items
                        .filter((item) => item.status !== 'paid')
                        .map((item) => [
                            item.id,
                            (() => {
                                assertNoReservedAdvancedSowingAdditionalData(
                                    item.additionalData,
                                );
                                return buildCheckoutAdditionalData({
                                    additionalData: item.additionalData,
                                    deliveryInfo,
                                    scheduledHarvestDate:
                                        harvestDateByCartItemId.get(item.id),
                                });
                            })(),
                        ]),
                );
            } catch (error) {
                checkoutTiming.setErrorCategory('cart_validation_failed');
                console.warn('Invalid checkout cart item additional data', {
                    accountId,
                    cartId,
                    error,
                });
                return context.json(
                    {
                        error: 'Cart item additional data is invalid',
                        code: 'CHECKOUT_ADDITIONAL_DATA_INVALID',
                    },
                    400,
                );
            }
            const outletCheckoutStartedAt = new Date();
            const outletCheckoutExpiresAt = addMinutes(
                outletCheckoutStartedAt,
                OUTLET_CHECKOUT_HOLD_MINUTES,
            );
            let hasOutletStripeItems = false;
            for (const item of cartInfo.items) {
                if (
                    item.status === 'paid' ||
                    item.currency !== 'eur' ||
                    !item.outlet
                ) {
                    continue;
                }
                hasOutletStripeItems = true;

                try {
                    await reserveOutletOffer({
                        offerId: item.outlet.offerId,
                        accountId,
                        cartId: item.cartId,
                        cartItemId: item.id,
                        quantity: item.amount,
                        now: outletCheckoutStartedAt,
                        holdMinutes: OUTLET_CHECKOUT_HOLD_MINUTES,
                    });
                } catch (error) {
                    if (
                        error instanceof OutletOfferUnavailableError ||
                        error instanceof OutletReservationUnavailableError
                    ) {
                        return context.json(
                            { error: 'Outlet offer is not available' },
                            409,
                        );
                    }

                    throw error;
                }
            }
            if (hasOutletStripeItems) {
                cartInfo = await checkoutTiming.measure('cart_enrichment', () =>
                    getCartInfo(cart.items, accountId, {
                        checkoutOperationMappings,
                    }),
                );
                if (!cartInfo.allowPurchase) {
                    return context.json(
                        {
                            code: 'CHECKOUT_CART_CHANGED',
                            error: 'Košarica se promijenila. Osvježi je i pokušaj ponovno.',
                        },
                        409,
                    );
                }
            }

            const requiresStripePayment = cartInfo.items.some(
                (item) => item.status !== 'paid' && item.currency === 'eur',
            );
            const hasSunflowerItems = cartInfo.items.some(
                (item) =>
                    item.status !== 'paid' && item.currency === 'sunflower',
            );
            const hasInventoryItems = cartInfo.items.some(
                (item) =>
                    item.status !== 'paid' &&
                    (item.currency === 'inventory' || item.usesInventory),
            );
            let paymentKind: CheckoutPaymentKind = 'unknown';
            if (requiresStripePayment) {
                paymentKind = 'stripe';
            } else if (hasSunflowerItems && hasInventoryItems) {
                paymentKind = 'mixed_non_stripe';
            } else if (hasSunflowerItems) {
                paymentKind = 'sunflower';
            } else if (hasInventoryItems) {
                paymentKind = 'inventory';
            }
            checkoutTiming.setContext({
                itemCount: cartInfo.items.filter(
                    (item) => item.status !== 'paid',
                ).length,
                paymentKind,
            });

            // Batch direct checkout while one process lock covers the complete
            // cart snapshot. Selected Advanced Sowing placement commits with
            // its direct debit/consumption; other fulfillment remains outside
            // the short database transaction.
            if (!requiresStripePayment) {
                const endNonStripeFulfillment = checkoutTiming.startPhase(
                    'non_stripe_fulfillment',
                );
                let fulfillmentPhaseEnded = false;
                const finishFulfillmentPhase = () => {
                    if (fulfillmentPhaseEnded) {
                        return;
                    }
                    fulfillmentPhaseEnded = true;
                    endNonStripeFulfillment();
                };
                let processingStage:
                    | 'payment'
                    | 'fulfillment'
                    | 'confirmation' = 'payment';

                try {
                    const directCheckoutResult =
                        await withDirectSunflowerCheckoutBatch({
                            accountId,
                            allCheckoutItems: cartInfo.items,
                            cartId: cart.id,
                            atomicOperation: async ({
                                pendingCheckoutItems,
                                resolvedAmountsByCartItemId,
                                transaction,
                            }) => {
                                const fulfilledItemIds = new Set<number>();
                                for (const item of pendingCheckoutItems) {
                                    const advancedSowingAuthorization =
                                        advancedSowingAuthorizationsByCartItemId.get(
                                            item.id,
                                        );
                                    if (!advancedSowingAuthorization) {
                                        continue;
                                    }
                                    const usesInventory =
                                        item.currency === 'inventory' ||
                                        item.usesInventory;
                                    if (
                                        usesInventory &&
                                        (item.inventoryAvailable ?? 0) <
                                            item.amount
                                    ) {
                                        continue;
                                    }
                                    if (usesInventory) {
                                        await withInventoryAccountTransaction(
                                            accountId,
                                            (inventoryDb) =>
                                                consumeInventoryItem(
                                                    accountId,
                                                    {
                                                        entityTypeName:
                                                            item.entityTypeName,
                                                        entityId: item.entityId,
                                                        amount: item.amount,
                                                        source: `shoppingCartItem:${item.id.toString()}`,
                                                    },
                                                    inventoryDb,
                                                ),
                                            transaction,
                                        );
                                    }
                                    const resolvedAmount = usesInventory
                                        ? 0
                                        : resolvedAmountsByCartItemId.get(
                                              item.id,
                                          );
                                    if (resolvedAmount === undefined) {
                                        throw new Error(
                                            `Sunflower checkout amount is missing for cart item ${item.id.toString()}.`,
                                        );
                                    }
                                    const fulfillment = await processItem({
                                        accountId,
                                        cartItemId: item.id,
                                        ...item,
                                        amount_total: resolvedAmount,
                                        additionalData:
                                            checkoutAdditionalDataByCartItemId.get(
                                                item.id,
                                            ) ?? {},
                                        advancedSowingAuthorization,
                                        fulfillmentTransaction: transaction,
                                    });
                                    assertCheckoutItemFulfilled(fulfillment);
                                    await setCartItemPaid(item.id, transaction);
                                    fulfilledItemIds.add(item.id);
                                }
                                return fulfilledItemIds;
                            },
                            operation: async ({
                                atomicallyFulfilledItemIds,
                                pendingItems,
                                resolvedAmountsByCartItemId,
                            }) => {
                                processingStage = 'fulfillment';
                                try {
                                    if (atomicallyFulfilledItemIds.size > 0) {
                                        await bustRaisedBedPlantingReadCaches();
                                    }
                                    for (const item of pendingItems) {
                                        if (
                                            atomicallyFulfilledItemIds.has(
                                                item.id,
                                            )
                                        ) {
                                            continue;
                                        }
                                        const resolvedAmount =
                                            resolvedAmountsByCartItemId.get(
                                                item.id,
                                            );
                                        if (resolvedAmount === undefined) {
                                            throw new Error(
                                                `Sunflower checkout amount is missing for cart item ${item.id.toString()}.`,
                                            );
                                        }
                                        const checkoutOperationMapping =
                                            item.entityTypeName === 'operation'
                                                ? await getCheckoutOperationMapping(
                                                      item.id,
                                                  )
                                                : undefined;
                                        const fulfillment = await processItem({
                                            accountId,
                                            cartItemId: item.id,
                                            ...item,
                                            amount_total: resolvedAmount,
                                            additionalData:
                                                checkoutAdditionalDataByCartItemId.get(
                                                    item.id,
                                                ) ?? {},
                                            advancedSowingAuthorization:
                                                advancedSowingAuthorizationsByCartItemId.get(
                                                    item.id,
                                                ),
                                            checkoutOperationMapping,
                                        });
                                        assertCheckoutItemFulfilled(
                                            fulfillment,
                                        );
                                        await setCartItemPaid(item.id);
                                    }

                                    const inventoryCartItems =
                                        cartInfo.items.filter(
                                            (item) =>
                                                item.status !== 'paid' &&
                                                (item.currency ===
                                                    'inventory' ||
                                                    item.usesInventory),
                                        );
                                    for (const item of inventoryCartItems) {
                                        if (
                                            atomicallyFulfilledItemIds.has(
                                                item.id,
                                            )
                                        ) {
                                            continue;
                                        }
                                        if (
                                            (item.inventoryAvailable ?? 0) <
                                            item.amount
                                        ) {
                                            return {
                                                status: 'inventory_insufficient' as const,
                                            };
                                        }

                                        const state =
                                            await withCheckoutCartItemLock(
                                                item.id,
                                                async (db) => {
                                                    const lockedCart =
                                                        await getShoppingCart(
                                                            cart.id,
                                                            db,
                                                        );
                                                    if (!lockedCart) {
                                                        throw new Error(
                                                            `Cart ${cart.id.toString()} disappeared before inventory fulfillment.`,
                                                        );
                                                    }
                                                    const lockedState =
                                                        assertCheckoutCartItemSnapshot(
                                                            lockedCart.items.find(
                                                                (lockedItem) =>
                                                                    lockedItem.id ===
                                                                    item.id,
                                                            ),
                                                            item,
                                                        );
                                                    if (
                                                        lockedState ===
                                                        'pending'
                                                    ) {
                                                        await withInventoryAccountTransaction(
                                                            accountId,
                                                            (inventoryDb) =>
                                                                consumeInventoryItem(
                                                                    accountId,
                                                                    {
                                                                        entityTypeName:
                                                                            item.entityTypeName,
                                                                        entityId:
                                                                            item.entityId,
                                                                        amount: item.amount,
                                                                        source: `shoppingCartItem:${item.id.toString()}`,
                                                                    },
                                                                    inventoryDb,
                                                                ),
                                                            db,
                                                        );
                                                    }
                                                    return lockedState;
                                                },
                                            );
                                        if (state === 'paid') {
                                            continue;
                                        }

                                        const checkoutOperationMapping =
                                            item.entityTypeName === 'operation'
                                                ? await getCheckoutOperationMapping(
                                                      item.id,
                                                  )
                                                : undefined;
                                        const fulfillment = await processItem({
                                            accountId,
                                            cartItemId: item.id,
                                            ...item,
                                            amount_total: 0,
                                            additionalData:
                                                checkoutAdditionalDataByCartItemId.get(
                                                    item.id,
                                                ) ?? {},
                                            advancedSowingAuthorization:
                                                advancedSowingAuthorizationsByCartItemId.get(
                                                    item.id,
                                                ),
                                            checkoutOperationMapping,
                                        });
                                        assertCheckoutItemFulfilled(
                                            fulfillment,
                                        );
                                        await setCartItemPaid(item.id);
                                    }
                                } finally {
                                    finishFulfillmentPhase();
                                }

                                processingStage = 'confirmation';
                                const confirmationIntent =
                                    await checkoutTiming.measure(
                                        'confirmation_side_effects',
                                        () =>
                                            markCartPaidAndEnqueueOrderConfirmation(
                                                {
                                                    cartId: cart.id,
                                                    payload: {
                                                        cartId: cart.id,
                                                        currency: null,
                                                        items: buildOrderConfirmationItems(
                                                            cartInfo.items,
                                                            (item) => {
                                                                const resolvedAmount =
                                                                    resolvedAmountsByCartItemId.get(
                                                                        item.id,
                                                                    );
                                                                if (
                                                                    resolvedAmount ===
                                                                    undefined
                                                                ) {
                                                                    throw new Error(
                                                                        `Sunflower confirmation amount is missing for cart item ${item.id.toString()}.`,
                                                                    );
                                                                }
                                                                return resolvedAmount;
                                                            },
                                                        ),
                                                        manageUrl:
                                                            ORDER_CONFIRMATION_MANAGE_URL,
                                                        to: user.userName,
                                                        totalAmountCents: null,
                                                    },
                                                },
                                            ),
                                    );
                                const confirmationRecorded =
                                    confirmationIntent.status === 'enqueued' ||
                                    (confirmationIntent.status ===
                                        'already_paid' &&
                                        confirmationIntent.emailMessageId !==
                                            null);
                                return {
                                    status: confirmationRecorded
                                        ? ('completed' as const)
                                        : ('confirmation_incomplete' as const),
                                };
                            },
                        });

                    if (directCheckoutResult.state === 'cart_paid') {
                        const retryResponse =
                            await getPaidCartCheckoutRetryResponse({
                                accountId,
                                cart: directCheckoutResult.cart,
                            });
                        if (!retryResponse) {
                            return context.json(
                                { error: 'Cart not found' },
                                404,
                            );
                        }
                        return context.json(
                            retryResponse.body,
                            retryResponse.status,
                        );
                    }
                    if (
                        directCheckoutResult.value.status ===
                        'inventory_insufficient'
                    ) {
                        return context.json(
                            {
                                error: 'Nema dovoljno predmeta u ruksaku',
                            },
                            400,
                        );
                    }
                    if (
                        directCheckoutResult.value.status ===
                        'confirmation_incomplete'
                    ) {
                        return context.json(
                            {
                                code: 'CHECKOUT_CONFIRMATION_MISSING',
                                error: 'Narudžbu nije moguće dovršiti. Pokušaj ponovno.',
                            },
                            409,
                        );
                    }
                } catch (error) {
                    const paymentErrorResponse =
                        getDirectCheckoutPaymentErrorResponse(error);
                    if (paymentErrorResponse) {
                        checkoutTiming.setErrorCategory(
                            paymentErrorResponse.errorCategory,
                        );
                        return context.json(
                            paymentErrorResponse.body,
                            paymentErrorResponse.status,
                        );
                    }

                    checkoutTiming.setErrorCategory(
                        processingStage === 'payment'
                            ? 'sunflower_spend_failed'
                            : processingStage === 'fulfillment'
                              ? 'direct_checkout_fulfillment_failed'
                              : 'unexpected',
                    );
                    console.error('Direct checkout failed', {
                        accountId,
                        cartId: cart.id,
                        error,
                        processingStage,
                    });
                    throw error;
                } finally {
                    finishFulfillmentPhase();
                }
            }

            // Generate a stripe checkout items from cart items
            const stripeCartItemsWithShopData = cartInfo.items.filter(
                (item) => item.status !== 'paid' && item.currency === 'eur',
            ); // Exclude paid items and sunflowers
            for (const item of stripeCartItemsWithShopData) {
                // TODO: Apply discounted price if available

                const name = item.shopData?.name;
                const finalPrice =
                    typeof item.shopData.discountPrice === 'number'
                        ? item.shopData.discountPrice
                        : (item.shopData.price ?? 0);
                const valueInCents = Math.round((finalPrice ?? 0) * 100);
                const quantity = item.amount;

                // TODO: Validate item data
                if (!name || !valueInCents || !quantity) {
                    console.warn('Invalid item data', {
                        name,
                        valueInCents,
                        quantity,
                    });
                    return context.json(
                        {
                            code: 'CHECKOUT_CART_CHANGED',
                            error: 'Košarica se promijenila. Osvježi je i pokušaj ponovno.',
                        },
                        409,
                    );
                }
                if (quantity <= 0) {
                    console.warn('Invalid item quantity', { quantity });
                    return context.json(
                        {
                            code: 'CHECKOUT_CART_CHANGED',
                            error: 'Košarica se promijenila. Osvježi je i pokušaj ponovno.',
                        },
                        409,
                    );
                }
                // Invalid price check
                // - valueInCents should be a positive integer
                // - valueInCents should not exceed a certain limit (e.g., 10000 cents = 100 EUR)
                if (valueInCents < 0 || valueInCents > 10000) {
                    console.warn('Invalid item price', { valueInCents });
                    return context.json(
                        {
                            code: 'CHECKOUT_CART_CHANGED',
                            error: 'Košarica se promijenila. Osvježi je i pokušaj ponovno.',
                        },
                        409,
                    );
                }
            }

            if (stripeCartItemsWithShopData.length) {
                const resolvedCustomerId = await resolveStripeCustomerId({
                    email: user.userName,
                    id: account.id,
                    name: user.userName,
                    stripeCustomerId: account.stripeCustomerId ?? undefined,
                });
                const canonicalCustomerId =
                    await assignStripeCustomerIdIfUnchanged(
                        account.id,
                        account.stripeCustomerId,
                        resolvedCustomerId,
                    );
                if (!canonicalCustomerId) {
                    throw new StripeCheckoutAttemptConflictError(
                        'checkout_identity_changed',
                    );
                }
                const checkoutExpiresAt = hasOutletStripeItems
                    ? outletCheckoutExpiresAt
                    : addMinutes(outletCheckoutStartedAt, 24 * 60 - 1);
                const checkoutAttempt = buildStripeCheckoutAttemptSnapshot({
                    advancedSowingAuthorizationsByCartItemId,
                    cartId: cart.id,
                    checkoutAdditionalDataByCartItemId,
                    customerId: canonicalCustomerId,
                    expiresAt: checkoutExpiresAt,
                    harvestDates: canonicalHarvestDates,
                    items: cartInfo.items,
                    returnUrls: getStripeCheckoutReturnUrls(),
                    userId,
                });
                try {
                    await createStripeCheckoutAttempt(checkoutAttempt, {
                        accountId,
                    });
                } catch (error) {
                    if (error instanceof StripeCheckoutAttemptInProgressError) {
                        const concurrentRecovery =
                            await recoverStripeCheckoutAttemptAfterCreateRace({
                                getActiveAttempt: () =>
                                    getActiveStripeCheckoutAttempt(cart.id),
                                recoverAttempt: (activeAttempt) =>
                                    recoverAttempt(
                                        activeAttempt,
                                        cart.items,
                                        canonicalCustomerId,
                                    ),
                            });
                        if (concurrentRecovery.status === 'cart_changed') {
                            checkoutTiming.setErrorCategory(
                                'cart_validation_failed',
                            );
                            return context.json(
                                {
                                    code: 'CHECKOUT_CART_CHANGED',
                                    error: 'Košarica se promijenila. Osvježi je i pokušaj ponovno.',
                                },
                                409,
                            );
                        }
                        if (
                            concurrentRecovery.status === 'recovered' &&
                            concurrentRecovery.recovery.status === 'open' &&
                            concurrentRecovery.recovery.url
                        ) {
                            return context.json({
                                sessionId:
                                    concurrentRecovery.recovery.sessionId,
                                url: concurrentRecovery.recovery.url,
                            });
                        }
                        return context.json(
                            {
                                code: 'CHECKOUT_IN_PROGRESS',
                                error: 'Plaćanje za ovu košaricu je već otvoreno. Dovrši ili otkaži postojeće plaćanje.',
                            },
                            409,
                        );
                    }
                    if (error instanceof StripeCheckoutAttemptConflictError) {
                        checkoutTiming.setErrorCategory(
                            'cart_validation_failed',
                        );
                        return context.json(
                            {
                                code: 'CHECKOUT_CART_CHANGED',
                                error: 'Košarica se promijenila. Osvježi je i pokušaj ponovno.',
                            },
                            409,
                        );
                    }
                    throw error;
                }

                const recovery = await checkoutTiming.measure(
                    'stripe_session',
                    () =>
                        recoverAttempt(
                            { snapshot: checkoutAttempt },
                            cart.items,
                            canonicalCustomerId,
                        ),
                );
                if (recovery.status !== 'open' || !recovery.url) {
                    return context.json(
                        {
                            code: 'CHECKOUT_PAYMENT_PROCESSING',
                            error: 'Plaćanje se još obrađuje. Pričekaj trenutak i pokušaj ponovno.',
                        },
                        409,
                    );
                }
                const { sessionId, url } = recovery;

                try {
                    await checkoutTiming.measure('analytics', async () => {
                        (await getPostHogClient()).capture({
                            distinctId: accountId,
                            event: 'checkout_initiated',
                            properties: {
                                cart_id: cartId,
                                payment_method: 'stripe',
                                item_count: stripeCartItemsWithShopData.length,
                            },
                        });
                    });
                } catch (error) {
                    console.warn('Checkout initiation analytics failed', {
                        attemptId: checkoutAttempt.attemptId,
                        cartId,
                        error,
                        sessionId,
                    });
                }

                return context.json({ sessionId, url });
            }

            await checkoutTiming.measure('analytics', async () => {
                (await getPostHogClient()).capture({
                    distinctId: accountId,
                    event: 'checkout_initiated',
                    properties: {
                        cart_id: cartId,
                        payment_method: cartInfo.items.some(
                            (i) => i.currency === 'sunflower',
                        )
                            ? 'sunflower'
                            : 'inventory',
                        item_count: cartInfo.items.length,
                    },
                });
            });

            return context.json({ success: true });
        },
    )
    .post(
        '/sunflower-packages/:code',
        describeRoute({
            description:
                'Create a Stripe checkout session for an eligible sunflower package',
            security: authSecurity,
        }),
        authValidator(['user', 'admin']),
        zValidator(
            'param',
            z.object({
                code: z.string().trim().min(1).max(80),
            }),
        ),
        zValidator('json', packageCheckoutBodySchema),
        async (context) => {
            const {
                accountId,
                user: authUser,
                userId,
            } = context.get('authContext');
            const { code } = context.req.valid('param');
            const { returnContext } = context.req.valid('json');

            if (authUser.isTemporary) {
                return context.json(
                    {
                        error: 'Upgrade required before checkout',
                        errorCode: 'upgrade_required',
                    },
                    403,
                );
            }

            const [account, user, packages] = await Promise.all([
                getAccount(accountId),
                getUser(userId),
                getSunflowerPackageEligibilityForAccount(accountId),
            ]);
            if (!account) {
                return context.json({ error: 'Account not found' }, 404);
            }
            if (!user) {
                return context.json({ error: 'User not found' }, 404);
            }

            const packageData =
                packages.find((pkg) => pkg.code === code) ?? null;
            if (!packageData) {
                return context.json({ error: 'Package not found' }, 404);
            }
            if (!packageData.eligible) {
                return context.json(
                    {
                        error: 'Package is not eligible',
                        reason:
                            packageData.ineligibleReason === 'already_purchased'
                                ? 'already_used'
                                : 'not_eligible',
                    },
                    409,
                );
            }
            if (
                packageData.currency !== 'eur' ||
                packageData.priceCents <= 0 ||
                packageData.sunflowers <= 0
            ) {
                console.warn('Invalid sunflower package checkout data', {
                    code,
                    currency: packageData.currency,
                    priceCents: packageData.priceCents,
                    sunflowers: packageData.sunflowers,
                });
                return context.json({ error: 'Package is not available' }, 400);
            }

            const resolvedCustomerId = await resolveStripeCustomerId({
                id: account.id,
                email: user.userName,
                name: user.userName,
                stripeCustomerId: account.stripeCustomerId ?? undefined,
            });
            const canonicalCustomerId = await assignStripeCustomerIdIfUnchanged(
                account.id,
                account.stripeCustomerId,
                resolvedCustomerId,
            );
            if (!canonicalCustomerId) {
                return context.json(
                    { error: 'Package checkout is temporarily unavailable' },
                    409,
                );
            }

            const { sessionId, url } = await stripeCheckout(
                {
                    id: account.id,
                    email: user.userName,
                    name: user.userName,
                    stripeCustomerId: account.stripeCustomerId ?? undefined,
                },
                {
                    items: [
                        {
                            product: {
                                name: packageData.name,
                                description:
                                    packageData.descriptionShort ?? undefined,
                                imageUrls: [
                                    'https://cdn.gredice.com/sunflower-large.svg',
                                ],
                                metadata: {
                                    kind: 'sunflowerPackage',
                                    entityTypeName:
                                        sunflowerPackageEntityTypeName,
                                    entityId: packageData.entityId,
                                    packageCode: packageData.code,
                                    packageRole: packageData.role,
                                    accountId: account.id,
                                    userId: user.id,
                                    sunflowers: packageData.sunflowers,
                                    baseSunflowers: packageData.baseSunflowers,
                                    bonusSunflowers:
                                        packageData.bonusSunflowers,
                                    priceCents: packageData.priceCents,
                                    currency: packageData.currency,
                                    returnContextSource:
                                        returnContext?.source ?? null,
                                    returnContextPath:
                                        returnContext?.path ?? null,
                                },
                            },
                            price: {
                                valueInCents: packageData.priceCents,
                                currency: 'eur',
                            },
                            quantity: 1,
                        },
                    ],
                    allowPromotionCodes: false,
                },
                { customerId: canonicalCustomerId },
            );

            (await getPostHogClient()).capture({
                distinctId: accountId,
                event: 'checkout_initiated',
                properties: {
                    checkout_kind: 'sunflower_package',
                    package_code: packageData.code,
                    package_role: packageData.role,
                    price_cents: packageData.priceCents,
                    sunflowers: packageData.sunflowers,
                    bonus_sunflowers: packageData.bonusSunflowers,
                    payment_method: 'stripe',
                },
            });

            return context.json({ sessionId, url });
        },
    )
    .delete(
        '/checkout/:sessionId',
        describeRoute({
            description: 'Cancel the current Stripe checkout session',
        }),
        authValidator(['user', 'admin']),
        zValidator('param', z.object({ sessionId: z.string() })),
        async (context) => {
            const { sessionId } = context.req.valid('param');
            const { accountId } = context.get('authContext');
            const account = await getAccount(accountId);
            if (!account) {
                return context.json({ error: 'Account not found' }, 404);
            }
            if (!account.stripeCustomerId) {
                console.warn('Stripe customer ID not found', { accountId });
                return context.json({ error: 'Account not found' }, 404);
            }

            try {
                const session = await getStripeCheckoutSession(sessionId);
                if (session.customerId !== account.stripeCustomerId) {
                    return context.json(
                        { error: 'Session does not belong to this account' },
                        403,
                    );
                }
                if (session.status === 'complete') {
                    return context.json(
                        { error: 'Session already completed' },
                        400,
                    );
                }
                const attemptMetadata = decodeStripeCheckoutAttemptMetadata(
                    session.metadata,
                );
                if (session.status === 'expired') {
                    if (attemptMetadata) {
                        const attempt = await getStripeCheckoutAttempt(
                            attemptMetadata.cartId,
                            attemptMetadata.attemptId,
                        );
                        const attemptCart = await getShoppingCart(
                            attemptMetadata.cartId,
                        );
                        if (!attempt || attemptCart?.accountId !== accountId) {
                            return context.json(
                                {
                                    error: 'Session does not belong to this account',
                                },
                                403,
                            );
                        }
                        await releaseStripeCheckoutAttempt({
                            ...attemptMetadata,
                            reason: 'expired',
                            sessionId,
                        });
                    }
                    return context.json({ success: true });
                }
                await stripeSessionCancel(sessionId);
                if (attemptMetadata) {
                    const attempt = await getStripeCheckoutAttempt(
                        attemptMetadata.cartId,
                        attemptMetadata.attemptId,
                    );
                    const attemptCart = await getShoppingCart(
                        attemptMetadata.cartId,
                    );
                    if (!attempt || attemptCart?.accountId !== accountId) {
                        return context.json(
                            {
                                error: 'Session does not belong to this account',
                            },
                            403,
                        );
                    }
                    await releaseStripeCheckoutAttempt({
                        ...attemptMetadata,
                        reason: 'cancelled',
                        sessionId,
                    });
                }
                const outletCartIds = new Set<number>();
                for (const item of attemptMetadata
                    ? []
                    : (session.lineItems?.data ?? [])) {
                    const product = item.price?.product;
                    if (typeof product === 'string' || product?.deleted) {
                        continue;
                    }

                    const cartId = product?.metadata.cartId
                        ? parseInt(product.metadata.cartId, 10)
                        : undefined;
                    if (cartId && product?.metadata.outletOfferId) {
                        outletCartIds.add(cartId);
                    }
                }

                await Promise.all(
                    Array.from(outletCartIds).map((cartId) =>
                        releaseOutletReservationsForCart(cartId),
                    ),
                );
            } catch (error) {
                console.error(
                    'Error retrieving or cancelling Stripe checkout session',
                    { error },
                );
                return context.json(
                    {
                        error: 'Error retrieving or cancelling Stripe checkout session',
                    },
                    500,
                );
            }

            (await getPostHogClient()).capture({
                distinctId: accountId,
                event: 'checkout_cancelled',
                properties: { session_id: sessionId },
            });

            return context.json({ success: true });
        },
    );

export default app;
