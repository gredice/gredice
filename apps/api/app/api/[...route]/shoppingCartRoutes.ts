import {
    type AdvancedSowingCartAuthorizationV1,
    advancedSowingSelectionRequestKind,
} from '@gredice/js/plants';
import {
    isRaisedBedAbandoned,
    RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE,
    RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE,
} from '@gredice/js/raisedBeds';
import {
    AdvancedSowingCartAuthorizationPersistenceError,
    AdvancedSowingCartItemExplicitIdentityRequiredError,
    CheckoutCartItemFulfillmentStartedError,
    cartContainsDeliverableItems,
    deleteShoppingCart,
    type EntityStandardized,
    getBlockingPlantOperationsForRaisedBedFootprint,
    getEntityFormatted,
    getEntityRaw,
    getGarden,
    getGardenBlocks,
    getHarvestScheduleForCart,
    getOrCreateShoppingCart,
    getOutletOffer,
    getOutletOfferReservationForCartItem,
    getRaisedBed,
    getRaisedBedPlantingsForRaisedBed,
    getShoppingCart,
    getShoppingCartItemAdvancedSowingAuthorizations,
    getSunflowers,
    HarvestScheduleConflictError,
    normalizeShoppingCartInventoryUsage,
    normalizeShoppingCartScheduledDates,
    OutletCartTargetUnavailableError,
    OutletOfferUnavailableError,
    OutletReservationUnavailableError,
    releaseOutletReservationForCartItem,
    StripeCheckoutAttemptInProgressError,
    upsertOrRemoveCartItem,
    upsertOrRemoveCartItemWithAdvancedSowingAuthorization,
    upsertOrRemoveCartItemWithOutletReservation,
} from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import {
    assertAdvancedSowingPlanAvailable,
    assertLegacySowingTargetAvailable,
    getLegacySowingCartMutationTarget,
    LegacySowingSelectedPlantingConflictError,
} from '../../../lib/checkout/advancedSowingAvailability';
import {
    AdvancedSowingPlanBoundaryError,
    assertNoReservedAdvancedSowingAdditionalData,
    authorizeAdvancedSowingCartSelection,
    buildAdvancedSowingSupportedCartTarget,
    readAdvancedSowingCatalogueDistanceRange,
} from '../../../lib/checkout/advancedSowingPlan';
import { isAdvancedSowingServerEnabled } from '../../../lib/checkout/advancedSowingServerFlag';
import { getCartInfo } from '../../../lib/checkout/cartInfo';
import {
    assertOutletCartTargetAvailable,
    OutletCartMutationConflictError,
    outletCartMutationConflictCodes,
    requireOutletCartTarget,
    resolveOutletCartCurrency,
} from '../../../lib/checkout/outletCartTarget';
import { serializeShoppingCartItemForClient } from '../../../lib/checkout/shoppingCartClientSerialization';
import { getDefaultCartItemCurrency } from '../../../lib/checkout/sunflowerCalculations';
import { calculateRaisedBedsValidity } from '../../../lib/garden/raisedBedsService';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';
import { getPostHogClient } from '../../../lib/posthog-server';

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/harvest-schedule',
        describeRoute({
            description:
                'Preview allowed harvest dates for the current cart and delivery slot',
        }),
        authValidator(['user', 'admin']),
        zValidator(
            'query',
            z.object({
                slotId: z.coerce.number().int().positive(),
            }),
        ),
        async (context) => {
            const { accountId } = context.get('authContext');
            const { slotId } = context.req.valid('query');
            const cart = await getOrCreateShoppingCart(accountId, 'new');
            if (!cart) {
                return context.json({ error: 'Cart not found' }, 404);
            }

            try {
                const schedule = await getHarvestScheduleForCart({
                    accountId,
                    cartId: cart.id,
                    deliverySlotId: slotId,
                });
                return context.json(schedule);
            } catch (error) {
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
            }
        },
    )
    .get(
        '/',
        describeRoute({
            description: 'Get the current shopping cart',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const status = context.req.query('status') as
                | 'new'
                | 'paid'
                | undefined;
            const cart = await getOrCreateShoppingCart(
                accountId,
                status || 'new',
            );
            if (!cart) {
                return context.json({ error: 'Cart not found' }, 404);
            }

            const inventoryNormalizedCart =
                (await normalizeShoppingCartInventoryUsage(cart.id)) ?? cart;
            const normalizedCart =
                (await normalizeShoppingCartScheduledDates(
                    inventoryNormalizedCart.id,
                )) ?? inventoryNormalizedCart;

            // Calculate total amount of items in the cart (exclude paid items)
            const cartInfo = await getCartInfo(normalizedCart.items, accountId);
            const advancedSowingAuthorizationsByCartItemId =
                await getShoppingCartItemAdvancedSowingAuthorizations(
                    normalizedCart.items.map((item) => item.id),
                );
            const total = cartInfo.items
                .filter(
                    (item) => item.status !== 'paid' && item.currency === 'eur',
                )
                .reduce(
                    (sum, item) =>
                        sum +
                        (typeof item.shopData.discountPrice === 'number'
                            ? item.shopData.discountPrice
                            : (item.shopData.price ?? 0)),
                    0,
                );
            const totalSunflowers = Math.round(
                cartInfo.items
                    .filter(
                        (item) =>
                            item.status !== 'paid' &&
                            item.currency === 'sunflower',
                    )
                    .reduce(
                        (sum, item) =>
                            sum +
                            (typeof item.shopData.discountPrice === 'number'
                                ? item.shopData.discountPrice
                                : (item.shopData.price ?? 0)),
                        0,
                    ) * 1000,
            );

            // Check if there are enough sunflowers in the account
            let enoughSunflowers = true;
            let enoughSunflowersNote: string | null = null;
            if (totalSunflowers > (await getSunflowers(accountId))) {
                enoughSunflowers = false;
                enoughSunflowersNote = `Nedovoljno suncokreta. Potrebno je ${totalSunflowers} 🌻, a imaš samo ${await getSunflowers(accountId)} 🌻.`;
            }

            // Check if cart contains deliverable items
            const hasDeliverableItems = await cartContainsDeliverableItems(
                cart.id,
            );

            return context.json({
                ...normalizedCart,
                items: cartInfo.items.map((item) =>
                    serializeShoppingCartItemForClient(
                        item,
                        advancedSowingAuthorizationsByCartItemId.get(item.id),
                    ),
                ),
                total,
                totalSunflowers,
                hasDeliverableItems,
                notes: enoughSunflowersNote
                    ? [...cartInfo.notes, enoughSunflowersNote]
                    : cartInfo.notes,
                allowPurchase: cartInfo.allowPurchase && enoughSunflowers,
            });
        },
    )
    .post(
        '/',
        describeRoute({
            description:
                'Add or update an item in the shopping cart. New items without an explicit currency use sunflowers when the current balance covers all sunflower commitments in the cart. Outlet additions require an owned, available garden field and return stable conflict codes when the offer or target is unavailable.',
        }),
        authValidator(['user', 'admin']),
        zValidator(
            'json',
            z.object({
                id: z.number().optional(),
                advancedSowingSelection: z
                    .object({
                        kind: z.literal(advancedSowingSelectionRequestKind),
                        selectedDistanceCm: z.number().positive(),
                        version: z.literal(1),
                    })
                    .strict()
                    .optional(),
                cartId: z.number(),
                entityId: z.string(),
                entityTypeName: z.string(),
                amount: z.number().int().min(0).max(100),
                gardenId: z.number().optional(),
                raisedBedId: z.number().optional(),
                positionIndex: z.number().int().optional(),
                additionalData: z.string().optional().nullable(),
                currency: z.string().optional().nullable(),
                outletOfferId: z.number().int().positive().optional(),
                forceCreate: z.boolean().optional().default(false),
            }),
        ),
        async (context) => {
            const {
                advancedSowingSelection,
                id,
                cartId,
                entityId,
                entityTypeName,
                amount,
                gardenId,
                raisedBedId,
                positionIndex,
                additionalData,
                currency,
                outletOfferId,
                forceCreate,
            } = context.req.valid('json');
            const { accountId } = context.get('authContext');
            try {
                assertNoReservedAdvancedSowingAdditionalData(additionalData);
            } catch (error) {
                if (error instanceof AdvancedSowingPlanBoundaryError) {
                    return context.json(
                        {
                            code: 'ADVANCED_SOWING_RESERVED_DATA',
                            error: error.message,
                        },
                        400,
                    );
                }
                throw error;
            }
            const cart = await getShoppingCart(cartId);
            if (!cart || cart.accountId !== accountId) {
                return context.json({ error: 'Cart not found' }, 404);
            }
            // If updating an existing item, it must belong to this cart.
            if (
                typeof id === 'number' &&
                !cart.items.some((item) => item.id === id)
            ) {
                return context.json({ error: 'Cart item not found' }, 404);
            }
            const existingItem =
                typeof id === 'number'
                    ? cart.items.find((item) => item.id === id)
                    : undefined;
            let outletMutationCurrency = currency;
            if (outletOfferId && entityTypeName !== 'plantSort') {
                return context.json(
                    { error: 'Outlet offers can only be used for plant sorts' },
                    400,
                );
            }
            if (advancedSowingSelection && outletOfferId) {
                return context.json(
                    {
                        error: 'Advanced Sowing cannot use an outlet offer',
                        code: 'ADVANCED_SOWING_OUTLET_UNSUPPORTED',
                    },
                    400,
                );
            }
            if (
                outletOfferId &&
                currency &&
                currency !== 'eur' &&
                currency !== 'sunflower'
            ) {
                return context.json(
                    {
                        error: 'Outlet offers can only be paid in euros or sunflowers',
                    },
                    400,
                );
            }
            if (outletOfferId && amount > 0) {
                if (amount !== 1) {
                    return context.json(
                        {
                            error: 'Outlet offer is not available',
                            code: outletCartMutationConflictCodes.offerUnavailable,
                        },
                        409,
                    );
                }
                const offer = await getOutletOffer(outletOfferId);
                if (!offer) {
                    return context.json(
                        {
                            error: 'Outlet offer is not available',
                            code: outletCartMutationConflictCodes.offerUnavailable,
                        },
                        409,
                    );
                }

                const now = Date.now();
                if (
                    offer.status !== 'published' ||
                    offer.startAt.getTime() > now ||
                    offer.endAt.getTime() <= now ||
                    offer.plantSortId.toString() !== entityId
                ) {
                    return context.json(
                        {
                            error: 'Outlet offer is not available',
                            code: outletCartMutationConflictCodes.offerUnavailable,
                        },
                        409,
                    );
                }

                try {
                    const target = requireOutletCartTarget({
                        gardenId,
                        positionIndex,
                        raisedBedId,
                    });
                    const [garden, blocks] = await Promise.all([
                        getGarden(target.gardenId),
                        getGardenBlocks(target.gardenId),
                    ]);
                    const validityMap = garden
                        ? calculateRaisedBedsValidity(
                              garden.raisedBeds,
                              garden.stacks,
                              new Map(
                                  blocks.map((block) => [block.id, block.name]),
                              ),
                          )
                        : new Map<number, boolean>();
                    assertOutletCartTargetAvailable({
                        accountId,
                        garden,
                        isRaisedBedValid:
                            validityMap.get(target.raisedBedId) ?? false,
                        positionIndex: target.positionIndex,
                        raisedBedId: target.raisedBedId,
                    });
                } catch (error) {
                    if (error instanceof OutletCartMutationConflictError) {
                        return context.json(
                            { error: error.message, code: error.code },
                            409,
                        );
                    }
                    throw error;
                }
                const existingOutletTargetItem =
                    existingItem ??
                    cart.items.find(
                        (item) =>
                            item.status === 'new' &&
                            item.amount > 0 &&
                            item.entityTypeName === 'plantSort' &&
                            item.gardenId === gardenId &&
                            item.raisedBedId === raisedBedId &&
                            item.positionIndex === positionIndex,
                    );
                outletMutationCurrency = resolveOutletCartCurrency(
                    currency,
                    existingOutletTargetItem?.currency,
                );
            }
            if (amount > 0 && raisedBedId && !outletOfferId) {
                const raisedBed = await getRaisedBed(raisedBedId);
                if (!raisedBed || raisedBed.accountId !== accountId) {
                    return context.json({ error: 'Raised bed not found' }, 404);
                }

                if (isRaisedBedAbandoned(raisedBed.status)) {
                    return context.json(
                        {
                            error: `${RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE} ${RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE}`,
                        },
                        409,
                    );
                }
            }
            const existingAdvancedSowingAuthorization = existingItem
                ? (
                      await getShoppingCartItemAdvancedSowingAuthorizations([
                          existingItem.id,
                      ])
                  ).get(existingItem.id)
                : undefined;
            const legacySowingTarget = getLegacySowingCartMutationTarget({
                existingItem,
                mutation: {
                    amount,
                    entityId,
                    entityTypeName,
                    gardenId,
                    hasAdvancedSowingSelection: Boolean(
                        advancedSowingSelection,
                    ),
                    hasExistingAdvancedSowingAuthorization: Boolean(
                        existingAdvancedSowingAuthorization,
                    ),
                    outletOfferId,
                    positionIndex,
                    raisedBedId,
                },
            });
            if (legacySowingTarget) {
                try {
                    assertLegacySowingTargetAvailable({
                        plantings: await getRaisedBedPlantingsForRaisedBed(
                            legacySowingTarget.raisedBedId,
                        ),
                        positionIndex: legacySowingTarget.positionIndex,
                        raisedBedId: legacySowingTarget.raisedBedId,
                    });
                } catch (error) {
                    if (
                        error instanceof
                        LegacySowingSelectedPlantingConflictError
                    ) {
                        return context.json(
                            {
                                code: 'LEGACY_SOWING_SELECTED_PLANTING_CONFLICT',
                                error: error.message,
                            },
                            409,
                        );
                    }
                    throw error;
                }
            }
            let advancedSowingAuthorization: AdvancedSowingCartAuthorizationV1 | null =
                null;
            if (advancedSowingSelection) {
                if (
                    entityTypeName !== 'plantSort' ||
                    amount !== 1 ||
                    gardenId === undefined ||
                    raisedBedId === undefined ||
                    positionIndex === undefined ||
                    (!existingItem && !forceCreate) ||
                    (existingItem !== undefined &&
                        (existingItem.entityId !== entityId ||
                            existingItem.entityTypeName !== entityTypeName ||
                            existingItem.gardenId !== gardenId ||
                            existingItem.raisedBedId !== raisedBedId ||
                            existingItem.positionIndex !== positionIndex))
                ) {
                    return context.json(
                        {
                            error: 'Advanced Sowing requires one explicitly identified plant-sort target',
                            code: 'ADVANCED_SOWING_TARGET_INVALID',
                        },
                        400,
                    );
                }
                if (
                    existingItem &&
                    (await getOutletOfferReservationForCartItem(
                        existingItem.id,
                    ))
                ) {
                    return context.json(
                        {
                            error: 'Advanced Sowing cannot replace an outlet-reserved cart item',
                            code: 'ADVANCED_SOWING_OUTLET_RESERVATION_CONFLICT',
                        },
                        409,
                    );
                }

                const [raisedBed, garden, rawPlantSort, plantSort] =
                    await Promise.all([
                        getRaisedBed(raisedBedId),
                        getGarden(gardenId),
                        Number.isSafeInteger(Number(entityId)) &&
                        Number(entityId) > 0
                            ? getEntityRaw(Number(entityId))
                            : null,
                        Number.isSafeInteger(Number(entityId)) &&
                        Number(entityId) > 0
                            ? getEntityFormatted<EntityStandardized>(
                                  Number(entityId),
                              )
                            : null,
                    ]);
                if (
                    !raisedBed ||
                    raisedBed.accountId !== accountId ||
                    raisedBed.gardenId !== gardenId ||
                    isRaisedBedAbandoned(raisedBed.status) ||
                    !garden ||
                    garden.accountId !== accountId ||
                    garden.isSandbox ||
                    rawPlantSort?.state !== 'published' ||
                    rawPlantSort.entityType?.name !== 'plantSort' ||
                    !plantSort
                ) {
                    return context.json(
                        {
                            error: 'Advanced Sowing target is not available',
                            code: 'ADVANCED_SOWING_TARGET_UNAVAILABLE',
                        },
                        409,
                    );
                }

                try {
                    const authorizedSelection =
                        authorizeAdvancedSowingCartSelection({
                            catalogueDistanceRange:
                                readAdvancedSowingCatalogueDistanceRange(
                                    plantSort.information?.plant?.attributes,
                                ),
                            clientAdditionalData: additionalData,
                            enableAdvancedSowing:
                                isAdvancedSowingServerEnabled(),
                            selectionRequest: advancedSowingSelection,
                            target: buildAdvancedSowingSupportedCartTarget(
                                positionIndex,
                            ),
                        }).authorization;
                    if (!authorizedSelection) {
                        throw new AdvancedSowingPlanBoundaryError(
                            'invalid_request',
                        );
                    }
                    advancedSowingAuthorization = authorizedSelection;
                    const [
                        blockingPlantOperations,
                        plantings,
                        pendingAuthorizations,
                    ] = await Promise.all([
                        getBlockingPlantOperationsForRaisedBedFootprint({
                            positionIndices:
                                authorizedSelection.plan
                                    .occupiedPositionIndices,
                            raisedBedId,
                        }),
                        getRaisedBedPlantingsForRaisedBed(raisedBedId),
                        getShoppingCartItemAdvancedSowingAuthorizations(
                            cart.items.map((item) => item.id),
                        ),
                    ]);
                    assertAdvancedSowingPlanAvailable({
                        authorizationsByCartItemId: pendingAuthorizations,
                        blockingPlantOperations,
                        cartItems: cart.items,
                        excludedCartItemId: id,
                        gardenId,
                        plan: authorizedSelection.plan,
                        plantings,
                        raisedBedId,
                    });
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
            let appliedCurrency = outletMutationCurrency ?? undefined;
            try {
                let cartItemId: number | null = null;
                if (outletOfferId && amount > 0) {
                    cartItemId =
                        await upsertOrRemoveCartItemWithOutletReservation({
                            id,
                            cartId,
                            entityId,
                            entityTypeName,
                            amount,
                            gardenId,
                            raisedBedId,
                            positionIndex,
                            additionalData,
                            currency: outletMutationCurrency,
                            forceCreate,
                            outletOfferId,
                            accountId,
                        });
                } else if (advancedSowingAuthorization) {
                    cartItemId =
                        await upsertOrRemoveCartItemWithAdvancedSowingAuthorization(
                            {
                                additionalData,
                                amount,
                                authorization: advancedSowingAuthorization,
                                cartId,
                                currency,
                                entityId,
                                entityTypeName,
                                forceCreate,
                                gardenId,
                                id,
                                positionIndex,
                                raisedBedId,
                            },
                        );
                } else {
                    cartItemId = await upsertOrRemoveCartItem(
                        id,
                        cartId,
                        entityId,
                        entityTypeName,
                        amount,
                        gardenId,
                        raisedBedId,
                        positionIndex,
                        additionalData,
                        currency,
                        forceCreate,
                    );
                    if (amount > 0 && cartItemId) {
                        await releaseOutletReservationForCartItem(cartItemId);
                    }
                }

                const isNewCartItem =
                    cartItemId !== null &&
                    !cart.items.some((item) => item.id === cartItemId);
                if (
                    amount > 0 &&
                    cartItemId !== null &&
                    currency == null &&
                    isNewCartItem
                ) {
                    const updatedCart = await getShoppingCart(cartId);
                    if (updatedCart) {
                        const cartInfo = await getCartInfo(
                            updatedCart.items,
                            accountId,
                        );
                        appliedCurrency = getDefaultCartItemCurrency({
                            availableSunflowers: await getSunflowers(accountId),
                            items: cartInfo.items,
                            newCartItemId: cartItemId,
                        });

                        if (appliedCurrency === 'sunflower') {
                            await upsertOrRemoveCartItem(
                                cartItemId,
                                cartId,
                                entityId,
                                entityTypeName,
                                amount,
                                gardenId,
                                raisedBedId,
                                positionIndex,
                                additionalData,
                                appliedCurrency,
                            );
                        }
                    }
                }
            } catch (error) {
                if (
                    error instanceof
                    AdvancedSowingCartAuthorizationPersistenceError
                ) {
                    return context.json(
                        {
                            error: error.message,
                            code: 'ADVANCED_SOWING_AUTHORIZATION_CONFLICT',
                        },
                        409,
                    );
                }
                if (
                    error instanceof
                    AdvancedSowingCartItemExplicitIdentityRequiredError
                ) {
                    return context.json(
                        {
                            error: error.message,
                            code: 'ADVANCED_SOWING_EXPLICIT_ITEM_REQUIRED',
                        },
                        409,
                    );
                }
                if (
                    error instanceof OutletOfferUnavailableError ||
                    error instanceof OutletReservationUnavailableError
                ) {
                    return context.json(
                        {
                            error: 'Outlet offer is not available',
                            code: outletCartMutationConflictCodes.offerUnavailable,
                        },
                        409,
                    );
                }
                if (error instanceof OutletCartTargetUnavailableError) {
                    return context.json(
                        {
                            error: 'Outlet target is not available',
                            code: outletCartMutationConflictCodes.targetUnavailable,
                        },
                        409,
                    );
                }
                if (
                    error instanceof Error &&
                    error.message ===
                        'Cannot update paid shopping cart item via API'
                ) {
                    return context.json(
                        { error: 'Cannot update paid shopping cart item' },
                        400,
                    );
                }
                if (error instanceof CheckoutCartItemFulfillmentStartedError) {
                    return context.json(
                        {
                            error: 'Checkout fulfillment is already processing for this item',
                            code: 'CHECKOUT_FULFILLMENT_STARTED',
                        },
                        409,
                    );
                }
                if (error instanceof StripeCheckoutAttemptInProgressError) {
                    return context.json(
                        {
                            error: 'Plaćanje za ovu košaricu je u tijeku. Dovrši ili otkaži plaćanje prije izmjene košarice.',
                            code: 'CHECKOUT_IN_PROGRESS',
                        },
                        409,
                    );
                }

                throw error;
            }
            (await getPostHogClient()).capture({
                distinctId: accountId,
                event: 'cart_item_updated',
                properties: {
                    cart_id: cartId,
                    entity_id: entityId,
                    entity_type: entityTypeName,
                    amount,
                    currency: appliedCurrency,
                    outlet_offer_id: outletOfferId,
                },
            });
            return context.json({ success: true });
        },
    )
    .delete(
        '/',
        describeRoute({
            description: 'Delete the current shopping cart',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            try {
                await deleteShoppingCart(accountId);
            } catch (error) {
                if (error instanceof CheckoutCartItemFulfillmentStartedError) {
                    return context.json(
                        {
                            error: 'Checkout fulfillment is already processing for this cart',
                            code: 'CHECKOUT_FULFILLMENT_STARTED',
                        },
                        409,
                    );
                }
                if (error instanceof StripeCheckoutAttemptInProgressError) {
                    return context.json(
                        {
                            error: 'Plaćanje za ovu košaricu je u tijeku. Dovrši ili otkaži plaćanje prije brisanja košarice.',
                            code: 'CHECKOUT_IN_PROGRESS',
                        },
                        409,
                    );
                }
                throw error;
            }
            return context.json({ success: true });
        },
    );

export default app;
