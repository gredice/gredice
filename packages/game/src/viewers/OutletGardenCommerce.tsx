'use client';

import { Button } from '@gredice/ui/Button';
import { Check, Reset, Sprout } from '@gredice/ui/icons';
import { Spinner } from '@gredice/ui/Spinner';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import {
    hasOutletGardenCommerceAttribution,
    resolveOutletGardenCommerceAttribution,
    storeOutletGardenCommerceAttribution,
} from '../analytics/outletGardenCommerceAttribution';
import { buildOutletCartItemPayload } from '../hooks/shoppingCartItemMutation';
import {
    queryKey as currentUserQueryKey,
    useCurrentUser,
} from '../hooks/useCurrentUser';
import { useGardens, useGardensKeys } from '../hooks/useGardens';
import {
    OutletGardenAuthenticationRequiredError,
    useOutletGardenTargetGarden,
} from '../hooks/useOutletGardenTargetGarden';
import {
    type OutletOfferData,
    useOutletOffers,
    useOutletOffersQueryKey,
} from '../hooks/useOutletOffers';
import {
    ShoppingCartMutationError,
    useSetShoppingCartItem,
} from '../hooks/useSetShoppingCartItem';
import {
    type ShoppingCartData,
    useShoppingCart,
    useShoppingCartQueryKey,
} from '../hooks/useShoppingCart';
import {
    type EmptyRaisedBedFieldTarget,
    findEmptyRaisedBedFieldTargets,
} from '../hud/raisedBed/plantPickerNavigation';
import type { OutletGardenRenderer } from './outletGardenRenderer';

export type OutletGardenCommerceState =
    | 'authentication-required'
    | 'closed'
    | 'error'
    | 'expired'
    | 'loading'
    | 'no-targets'
    | 'query-error'
    | 'ready'
    | 'reserving'
    | 'success'
    | 'unavailable';

export type OutletGardenCommerceReceipt = {
    cartItemId: number;
    gardenId: number;
    gardenName: string;
    holdExpiresAt: string;
    offer: OutletOfferData;
    positionIndex: number;
    raisedBedId: number;
    raisedBedName: string;
};

type OutletGardenCommerceGarden = {
    id: number;
    name: string;
};

export type OutletGardenCommerceRaisedBed = {
    id: number;
    name: string;
};

export type OutletGardenCommerceController = {
    cartHref: `/?vrt=${number}&kosarica=true` | null;
    close: () => void;
    continueToCart: () => void;
    enabled: boolean;
    errorMessage: string | null;
    fieldTargets: readonly EmptyRaisedBedFieldTarget[];
    gardens: readonly OutletGardenCommerceGarden[];
    open: () => void;
    opened: boolean;
    raisedBeds: readonly OutletGardenCommerceRaisedBed[];
    receipt: OutletGardenCommerceReceipt | null;
    refreshAuthentication: () => Promise<void>;
    reserve: () => Promise<void>;
    retryQueries: () => Promise<void>;
    selectGarden: (gardenId: number) => void;
    selectRaisedBed: (raisedBedId: number) => void;
    selectTarget: (targetKey: string) => void;
    selectedGardenId: number | null;
    selectedOffer: OutletOfferData | null;
    selectedRaisedBedId: number | null;
    selectedTargetKey: string | null;
    state: OutletGardenCommerceState;
    targets: readonly EmptyRaisedBedFieldTarget[];
};

type OutletGardenCommerceStateInput = {
    authenticated: boolean;
    authenticatedQueriesPending: boolean;
    enabled: boolean;
    hasEligibleTarget: boolean;
    hasMutationError: boolean;
    hasQueryError: boolean;
    hasSelectedOffer: boolean;
    mutationPending: boolean;
    now: number;
    opened: boolean;
    queryRetrying: boolean;
    receiptHoldExpiresAt: string | null;
    userPending: boolean;
};

export function hasOutletGardenAuthenticationExpired({
    authenticated,
    gardensUnauthorized,
    shoppingCartUnauthorized,
    targetGardenUnauthorized,
}: {
    authenticated: boolean;
    gardensUnauthorized: boolean;
    shoppingCartUnauthorized: boolean;
    targetGardenUnauthorized: boolean;
}) {
    return (
        authenticated &&
        (gardensUnauthorized ||
            shoppingCartUnauthorized ||
            targetGardenUnauthorized)
    );
}

export function resolveOutletGardenCommerceState({
    authenticated,
    authenticatedQueriesPending,
    enabled,
    hasEligibleTarget,
    hasMutationError,
    hasQueryError,
    hasSelectedOffer,
    mutationPending,
    now,
    opened,
    queryRetrying,
    receiptHoldExpiresAt,
    userPending,
}: OutletGardenCommerceStateInput): OutletGardenCommerceState {
    if (!enabled || !opened) {
        return 'closed';
    }
    if (receiptHoldExpiresAt) {
        return new Date(receiptHoldExpiresAt).getTime() > now
            ? 'success'
            : 'expired';
    }
    if (mutationPending) {
        return 'reserving';
    }
    if (hasMutationError) {
        return 'error';
    }
    if (queryRetrying || userPending) {
        return 'loading';
    }
    if (hasQueryError) {
        return 'query-error';
    }
    if (!authenticated) {
        return 'authentication-required';
    }
    if (authenticatedQueriesPending) {
        return 'loading';
    }
    if (!hasSelectedOffer) {
        return 'unavailable';
    }
    if (!hasEligibleTarget) {
        return 'no-targets';
    }
    return 'ready';
}

function targetKey(target: EmptyRaisedBedFieldTarget) {
    return `${target.raisedBedId.toString()}:${target.positionIndex.toString()}`;
}

export function groupOutletGardenTargetsByRaisedBed(
    targets: readonly EmptyRaisedBedFieldTarget[],
) {
    const seenRaisedBedIds = new Set<number>();
    const raisedBeds: OutletGardenCommerceRaisedBed[] = [];

    for (const target of targets) {
        if (seenRaisedBedIds.has(target.raisedBedId)) {
            continue;
        }
        seenRaisedBedIds.add(target.raisedBedId);
        raisedBeds.push({
            id: target.raisedBedId,
            name: target.raisedBedName,
        });
    }

    return raisedBeds;
}

export function resolveOutletGardenTargetSelection({
    selectedRaisedBedId,
    selectedTargetKey,
    targets,
}: {
    selectedRaisedBedId: number | null;
    selectedTargetKey: string | null;
    targets: readonly EmptyRaisedBedFieldTarget[];
}) {
    const raisedBeds = groupOutletGardenTargetsByRaisedBed(targets);
    const selectedRaisedBed =
        raisedBeds.find((raisedBed) => raisedBed.id === selectedRaisedBedId) ??
        raisedBeds[0] ??
        null;
    const fieldTargets = selectedRaisedBed
        ? targets.filter(
              (target) => target.raisedBedId === selectedRaisedBed.id,
          )
        : [];
    const selectedTarget =
        fieldTargets.find(
            (target) => targetKey(target) === selectedTargetKey,
        ) ??
        fieldTargets[0] ??
        null;

    return {
        fieldTargets,
        raisedBeds,
        selectedRaisedBedId: selectedRaisedBed?.id ?? null,
        selectedTarget,
        selectedTargetKey: selectedTarget ? targetKey(selectedTarget) : null,
    };
}

function isHeldOutletCartItem(
    item: ShoppingCartData['items'][number],
    offerId: number,
    plantSortId: number,
    gardenId: number,
    target: EmptyRaisedBedFieldTarget,
) {
    return (
        item.entityTypeName === 'plantSort' &&
        item.entityId === plantSortId.toString() &&
        item.amount === 1 &&
        item.gardenId === gardenId &&
        item.raisedBedId === target.raisedBedId &&
        item.positionIndex === target.positionIndex &&
        item.status === 'new' &&
        item.outlet?.offerId === offerId &&
        item.outlet.status === 'held' &&
        !item.outlet.expired &&
        typeof item.outlet.holdExpiresAt === 'string'
    );
}

function serializedDate(value: unknown) {
    if (typeof value !== 'string' && !(value instanceof Date)) {
        return null;
    }
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

type HeldOutletCartItemOfferSource = {
    entityId: string;
    entityTypeName: string;
    outlet?: {
        comparePrice: number | null;
        endAt: unknown;
        expired: boolean;
        initialPlantStatus: string;
        offerId: number;
        outletPrice: number;
        sowingDate: unknown;
        status: string;
    };
    shopData: {
        description?: string;
        image?: string;
        name?: string;
    };
};

export function outletGardenOfferFromHeldCartItem(
    item: HeldOutletCartItemOfferSource,
) {
    const outlet = item.outlet;
    const plantSortId = Number(item.entityId);
    const sowingDate = serializedDate(outlet?.sowingDate);
    const endAt = serializedDate(outlet?.endAt);
    if (
        item.entityTypeName !== 'plantSort' ||
        !Number.isSafeInteger(plantSortId) ||
        plantSortId <= 0 ||
        !outlet ||
        outlet.status !== 'held' ||
        outlet.expired ||
        !sowingDate ||
        !endAt
    ) {
        return null;
    }

    return {
        comparePrice: outlet.comparePrice,
        endAt,
        id: outlet.offerId,
        imageUrls: item.shopData.image ? [item.shopData.image] : [],
        initialPlantStatus: outlet.initialPlantStatus,
        outletPrice: outlet.outletPrice,
        plantSort: {
            description: item.shopData.description ?? null,
            id: plantSortId,
            imageUrl: item.shopData.image ?? null,
            name: item.shopData.name ?? 'Outlet sadnica',
            plant: null,
        },
        quantity: 1,
        remainingQuantity: 0,
        reservedQuantity: 1,
        soldQuantity: 0,
        sowingDate,
        startAt: sowingDate,
        url: '',
    } satisfies OutletOfferData;
}

function commerceErrorMessage(error: unknown) {
    if (error instanceof ShoppingCartMutationError) {
        if (error.code === 'OUTLET_OFFER_UNAVAILABLE') {
            return 'Ponuda je upravo rasprodana ili više nije aktivna. Osvježili smo dostupne ponude.';
        }
        if (error.code === 'OUTLET_TARGET_UNAVAILABLE') {
            return 'Odabrano mjesto više nije slobodno. Odaberi drugo mjesto i pokušaj ponovno.';
        }
        if (error.code === 'OUTLET_TARGET_REQUIRED') {
            return 'Odaberi vrt i slobodno mjesto u gredici.';
        }
    }

    return 'Rezervacija trenutačno nije uspjela. Pokušaj ponovno.';
}

export function useOutletGardenCommerce({
    enabled,
    renderer,
    requested = false,
    selectedOfferId,
    onReservationIntentChange,
}: {
    enabled: boolean;
    onReservationIntentChange?: (requested: boolean) => void;
    renderer: OutletGardenRenderer;
    requested?: boolean;
    selectedOfferId: number | null;
}): OutletGardenCommerceController {
    const { track } = useGameAnalytics();
    const queryClient = useQueryClient();
    const { data: offers = [], refetch: refetchOffers } = useOutletOffers();
    const selectedLiveOffer =
        offers.find((offer) => offer.id === selectedOfferId) ?? null;
    const [opened, setOpened] = useState(requested && enabled);
    const [selectedGardenId, setSelectedGardenId] = useState<number | null>(
        null,
    );
    const [selectedRaisedBedId, setSelectedRaisedBedId] = useState<
        number | null
    >(null);
    const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(
        null,
    );
    const [receipt, setReceipt] = useState<OutletGardenCommerceReceipt | null>(
        null,
    );
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [queryRetrying, setQueryRetrying] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const previousOfferIdRef = useRef(selectedOfferId);
    const shouldLoadAuthenticated = enabled && opened;
    const currentUser = useCurrentUser(shouldLoadAuthenticated);
    const authenticated = Boolean(currentUser.data);
    const gardensQuery = useGardens(!shouldLoadAuthenticated || !authenticated);
    const shoppingCart = useShoppingCart(
        shouldLoadAuthenticated && authenticated,
    );
    const eligibleGardens = useMemo(
        () =>
            (gardensQuery.data ?? [])
                .filter((garden) => !garden.isSandbox)
                .map((garden) => ({ id: garden.id, name: garden.name })),
        [gardensQuery.data],
    );
    const targetGarden = useOutletGardenTargetGarden(
        shouldLoadAuthenticated && authenticated ? selectedGardenId : null,
    );
    const authenticationExpired = hasOutletGardenAuthenticationExpired({
        authenticated,
        gardensUnauthorized:
            gardensQuery.isSuccess && gardensQuery.data === null,
        shoppingCartUnauthorized:
            shoppingCart.isSuccess && shoppingCart.data === null,
        targetGardenUnauthorized:
            targetGarden.error instanceof
            OutletGardenAuthenticationRequiredError,
    });
    const targets = useMemo(
        () =>
            findEmptyRaisedBedFieldTargets(
                targetGarden.data,
                shoppingCart.data?.items,
                {
                    includeAllFields: true,
                    includeNotYetActiveRaisedBeds: true,
                },
            ),
        [shoppingCart.data?.items, targetGarden.data],
    );
    const targetSelection = useMemo(
        () =>
            resolveOutletGardenTargetSelection({
                selectedRaisedBedId,
                selectedTargetKey,
                targets,
            }),
        [selectedRaisedBedId, selectedTargetKey, targets],
    );
    const {
        fieldTargets,
        raisedBeds,
        selectedTarget,
        selectedRaisedBedId: resolvedRaisedBedId,
        selectedTargetKey: resolvedTargetKey,
    } = targetSelection;
    const mutation = useSetShoppingCartItem(
        shouldLoadAuthenticated && authenticated && !authenticationExpired,
    );

    useEffect(() => {
        if (!authenticationExpired) {
            return;
        }
        queryClient.removeQueries({ queryKey: useGardensKeys });
        queryClient.removeQueries({ queryKey: useShoppingCartQueryKey });
        queryClient.setQueryData(currentUserQueryKey.currentUser, null);
        onReservationIntentChange?.(true);
    }, [authenticationExpired, onReservationIntentChange, queryClient]);

    useEffect(() => {
        if (requested && enabled && selectedOfferId !== null) {
            setOpened(true);
        }
    }, [enabled, requested, selectedOfferId]);

    useEffect(() => {
        if (
            enabled &&
            selectedOfferId !== null &&
            hasOutletGardenCommerceAttribution()
        ) {
            setOpened(true);
        }
    }, [enabled, selectedOfferId]);

    useEffect(() => {
        if (previousOfferIdRef.current === selectedOfferId) {
            return;
        }
        previousOfferIdRef.current = selectedOfferId;
        setOpened(requested && enabled && selectedOfferId !== null);
        setReceipt(null);
        setErrorMessage(null);
        setSelectedRaisedBedId(null);
        setSelectedTargetKey(null);
    }, [enabled, requested, selectedOfferId]);

    useEffect(() => {
        if (
            selectedGardenId === null ||
            !eligibleGardens.some((garden) => garden.id === selectedGardenId)
        ) {
            setSelectedGardenId(eligibleGardens[0]?.id ?? null);
            setSelectedRaisedBedId(null);
            setSelectedTargetKey(null);
        }
    }, [eligibleGardens, selectedGardenId]);

    useEffect(() => {
        if (selectedRaisedBedId !== resolvedRaisedBedId) {
            setSelectedRaisedBedId(resolvedRaisedBedId);
        }
        if (selectedTargetKey !== resolvedTargetKey) {
            setSelectedTargetKey(resolvedTargetKey);
        }
    }, [
        resolvedRaisedBedId,
        resolvedTargetKey,
        selectedRaisedBedId,
        selectedTargetKey,
    ]);

    useEffect(() => {
        if (!receipt) {
            return;
        }
        const expiresAt = new Date(receipt.holdExpiresAt).getTime();
        const delay = Math.max(0, expiresAt - Date.now());
        const timeout = window.setTimeout(
            () => {
                setNow(Date.now());
                track('game_outlet_garden_hold_expired', {
                    cart_item_id: receipt.cartItemId,
                    garden_id: receipt.gardenId,
                    outlet_offer_id: receipt.offer.id,
                    renderer,
                });
            },
            Math.min(delay + 50, 2_147_483_647),
        );
        return () => window.clearTimeout(timeout);
    }, [receipt, renderer, track]);

    useEffect(() => {
        const cart = shoppingCart.data;
        if (
            receipt ||
            selectedOfferId === null ||
            !cart ||
            eligibleGardens.length === 0
        ) {
            return;
        }
        const attribution = resolveOutletGardenCommerceAttribution(cart.items);
        if (!attribution || attribution.outletOfferId !== selectedOfferId) {
            return;
        }
        const item = cart.items.find(
            (candidate) => candidate.id === attribution.cartItemId,
        );
        const offer = item ? outletGardenOfferFromHeldCartItem(item) : null;
        if (
            !item ||
            !offer ||
            typeof item.gardenId !== 'number' ||
            typeof item.raisedBedId !== 'number' ||
            typeof item.positionIndex !== 'number'
        ) {
            return;
        }
        const garden = eligibleGardens.find(
            (candidate) => candidate.id === item.gardenId,
        );
        if (!garden) {
            return;
        }
        const raisedBedName =
            targetGarden.data?.raisedBeds
                .find((raisedBed) => raisedBed.id === item.raisedBedId)
                ?.name?.trim() ?? `Gredica ${item.raisedBedId.toString()}`;
        setReceipt({
            cartItemId: item.id,
            gardenId: garden.id,
            gardenName: garden.name,
            holdExpiresAt: attribution.holdExpiresAt,
            offer,
            positionIndex: item.positionIndex,
            raisedBedId: item.raisedBedId,
            raisedBedName,
        });
        setSelectedGardenId(garden.id);
        setOpened(true);
        setNow(Date.now());
    }, [
        eligibleGardens,
        receipt,
        selectedOfferId,
        shoppingCart.data,
        targetGarden.data?.raisedBeds,
    ]);

    const open = useCallback(() => {
        if (!enabled || selectedOfferId === null) {
            return;
        }
        setOpened(true);
        onReservationIntentChange?.(true);
        setErrorMessage(null);
        track('game_outlet_garden_reservation_opened', {
            outlet_offer_id: selectedOfferId,
            renderer,
        });
    }, [enabled, onReservationIntentChange, renderer, selectedOfferId, track]);

    const close = useCallback(() => {
        setOpened(false);
        onReservationIntentChange?.(false);
        setErrorMessage(null);
    }, [onReservationIntentChange]);

    const continueToCart = useCallback(() => {
        if (!receipt) {
            return;
        }
        track('game_outlet_garden_cart_continued', {
            cart_item_id: receipt.cartItemId,
            garden_id: receipt.gardenId,
            outlet_offer_id: receipt.offer.id,
            renderer,
        });
    }, [receipt, renderer, track]);

    const refreshAuthentication = useCallback(async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
            queryClient.invalidateQueries({ queryKey: useGardensKeys }),
            queryClient.invalidateQueries({
                queryKey: useShoppingCartQueryKey,
            }),
        ]);
    }, [queryClient]);

    const retryQueries = useCallback(async () => {
        setQueryRetrying(true);
        try {
            if (currentUser.isError) {
                await currentUser.refetch();
                return;
            }

            const retries: Promise<unknown>[] = [];
            if (gardensQuery.isError) {
                retries.push(gardensQuery.refetch());
            }
            if (shoppingCart.isError) {
                retries.push(shoppingCart.refetch());
            }
            if (targetGarden.isError) {
                retries.push(targetGarden.refetch());
            }
            await Promise.all(retries);
        } finally {
            setQueryRetrying(false);
        }
    }, [currentUser, gardensQuery, shoppingCart, targetGarden]);

    const selectGarden = useCallback(
        (gardenId: number) => {
            if (!eligibleGardens.some((garden) => garden.id === gardenId)) {
                return;
            }
            setSelectedGardenId(gardenId);
            setSelectedRaisedBedId(null);
            setSelectedTargetKey(null);
            setErrorMessage(null);
            track('game_outlet_garden_garden_selected', {
                garden_id: gardenId,
                outlet_offer_id: selectedOfferId ?? undefined,
                renderer,
            });
        },
        [eligibleGardens, renderer, selectedOfferId, track],
    );

    const selectRaisedBed = useCallback(
        (raisedBedId: number) => {
            if (!raisedBeds.some((raisedBed) => raisedBed.id === raisedBedId)) {
                return;
            }
            const firstTarget = targets.find(
                (target) => target.raisedBedId === raisedBedId,
            );
            if (!firstTarget) {
                return;
            }
            setSelectedRaisedBedId(raisedBedId);
            setSelectedTargetKey(targetKey(firstTarget));
            setErrorMessage(null);
            track('game_outlet_garden_field_selected', {
                garden_id: selectedGardenId ?? undefined,
                outlet_offer_id: selectedOfferId ?? undefined,
                position_index: firstTarget.positionIndex,
                raised_bed_id: firstTarget.raisedBedId,
                renderer,
            });
        },
        [
            raisedBeds,
            renderer,
            selectedGardenId,
            selectedOfferId,
            targets,
            track,
        ],
    );

    const selectTarget = useCallback(
        (nextTargetKey: string) => {
            const target = fieldTargets.find(
                (candidate) => targetKey(candidate) === nextTargetKey,
            );
            if (!target) {
                return;
            }
            setSelectedTargetKey(nextTargetKey);
            setErrorMessage(null);
            track('game_outlet_garden_field_selected', {
                garden_id: selectedGardenId ?? undefined,
                outlet_offer_id: selectedOfferId ?? undefined,
                position_index: target.positionIndex,
                raised_bed_id: target.raisedBedId,
                renderer,
            });
        },
        [fieldTargets, renderer, selectedGardenId, selectedOfferId, track],
    );

    const reserve = useCallback(async () => {
        const offer = selectedLiveOffer;
        const garden = eligibleGardens.find(
            (candidate) => candidate.id === selectedGardenId,
        );
        if (!offer || !garden || !selectedTarget || mutation.isPending) {
            return;
        }

        setErrorMessage(null);
        track('game_outlet_garden_hold_attempted', {
            garden_id: garden.id,
            outlet_offer_id: offer.id,
            plant_sort_id: offer.plantSort.id,
            position_index: selectedTarget.positionIndex,
            raised_bed_id: selectedTarget.raisedBedId,
            renderer,
        });

        try {
            await mutation.mutateAsync(
                buildOutletCartItemPayload({
                    gardenId: garden.id,
                    outletOfferId: offer.id,
                    plantSortId: offer.plantSort.id,
                    positionIndex: selectedTarget.positionIndex,
                    raisedBedId: selectedTarget.raisedBedId,
                }),
            );
            await Promise.all([
                queryClient.refetchQueries({
                    queryKey: useShoppingCartQueryKey,
                    type: 'active',
                }),
                refetchOffers(),
            ]);
            const refreshedCart =
                queryClient.getQueryData<ShoppingCartData | null>(
                    useShoppingCartQueryKey,
                );
            const heldItem = refreshedCart?.items.find((item) =>
                isHeldOutletCartItem(
                    item,
                    offer.id,
                    offer.plantSort.id,
                    garden.id,
                    selectedTarget,
                ),
            );
            const holdExpiresAt = heldItem?.outlet?.holdExpiresAt;
            const receiptOffer = heldItem
                ? outletGardenOfferFromHeldCartItem(heldItem)
                : null;
            if (
                !heldItem ||
                !receiptOffer ||
                typeof holdExpiresAt !== 'string' ||
                new Date(holdExpiresAt).getTime() <= Date.now()
            ) {
                throw new Error('Verified Outlet hold was not returned');
            }

            const nextReceipt: OutletGardenCommerceReceipt = {
                cartItemId: heldItem.id,
                gardenId: garden.id,
                gardenName: garden.name,
                holdExpiresAt,
                offer: receiptOffer,
                positionIndex: selectedTarget.positionIndex,
                raisedBedId: selectedTarget.raisedBedId,
                raisedBedName: selectedTarget.raisedBedName,
            };
            setReceipt(nextReceipt);
            setNow(Date.now());
            storeOutletGardenCommerceAttribution({
                cartItemId: heldItem.id,
                holdExpiresAt,
                outletOfferId: receiptOffer.id,
            });
            track('game_outlet_garden_hold_succeeded', {
                cart_item_id: heldItem.id,
                garden_id: garden.id,
                outlet_offer_id: receiptOffer.id,
                position_index: selectedTarget.positionIndex,
                raised_bed_id: selectedTarget.raisedBedId,
                renderer,
            });
        } catch (error) {
            const targetUnavailable =
                error instanceof ShoppingCartMutationError &&
                error.code === 'OUTLET_TARGET_UNAVAILABLE';
            if (
                error instanceof ShoppingCartMutationError &&
                error.status === 401
            ) {
                queryClient.setQueryData(currentUserQueryKey.currentUser, null);
                setErrorMessage(null);
                onReservationIntentChange?.(true);
                await queryClient.invalidateQueries({
                    queryKey: currentUserQueryKey.currentUser,
                });
            } else {
                const message = commerceErrorMessage(error);
                setErrorMessage(message);
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: useShoppingCartQueryKey,
                }),
                queryClient.invalidateQueries({
                    queryKey: useOutletOffersQueryKey,
                }),
                ...(targetUnavailable ? [targetGarden.refetch()] : []),
            ]);
            track('game_outlet_garden_hold_failed', {
                error_code:
                    error instanceof ShoppingCartMutationError
                        ? (error.code ?? 'unknown')
                        : 'unknown',
                garden_id: garden.id,
                outlet_offer_id: offer.id,
                position_index: selectedTarget.positionIndex,
                raised_bed_id: selectedTarget.raisedBedId,
                renderer,
            });
        }
    }, [
        eligibleGardens,
        mutation,
        onReservationIntentChange,
        queryClient,
        refetchOffers,
        renderer,
        selectedGardenId,
        selectedLiveOffer,
        selectedTarget,
        targetGarden,
        track,
    ]);

    const state = resolveOutletGardenCommerceState({
        authenticated: authenticated && !authenticationExpired,
        authenticatedQueriesPending:
            gardensQuery.isPending ||
            shoppingCart.isPending ||
            (selectedGardenId !== null && targetGarden.isPending),
        enabled,
        hasEligibleTarget: eligibleGardens.length > 0 && targets.length > 0,
        hasMutationError: Boolean(errorMessage) && targets.length > 0,
        hasQueryError:
            currentUser.isError ||
            (authenticated &&
                !authenticationExpired &&
                (gardensQuery.isError ||
                    shoppingCart.isError ||
                    (selectedGardenId !== null && targetGarden.isError))),
        hasSelectedOffer: Boolean(selectedLiveOffer),
        mutationPending: mutation.isPending,
        now,
        opened,
        queryRetrying,
        receiptHoldExpiresAt: receipt?.holdExpiresAt ?? null,
        userPending: currentUser.isPending,
    });

    return {
        cartHref: receipt ? `/?vrt=${receipt.gardenId}&kosarica=true` : null,
        close,
        continueToCart,
        enabled,
        errorMessage,
        fieldTargets,
        gardens: eligibleGardens,
        open,
        opened,
        raisedBeds,
        receipt,
        refreshAuthentication,
        reserve,
        retryQueries,
        selectGarden,
        selectRaisedBed,
        selectTarget,
        selectedGardenId,
        selectedOffer: selectedLiveOffer ?? receipt?.offer ?? null,
        selectedRaisedBedId: resolvedRaisedBedId,
        selectedTargetKey: resolvedTargetKey,
        state,
        targets,
    };
}

const holdTimeFormatter = new Intl.DateTimeFormat('hr-HR', {
    hour: '2-digit',
    minute: '2-digit',
});

export function OutletGardenReservationPanel({
    commerce,
    onAuthenticationRequired,
    onChooseAnother,
    onContinueToCart,
}: {
    commerce: OutletGardenCommerceController;
    onAuthenticationRequired: () => void;
    onChooseAnother: () => void;
    onContinueToCart?: () => void;
}) {
    const statusHeadingRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        if (commerce.state === 'success' || commerce.state === 'expired') {
            statusHeadingRef.current?.focus({ preventScroll: true });
        }
    }, [commerce.state]);

    if (!commerce.enabled) {
        return null;
    }

    if (!commerce.opened) {
        return (
            <div className="mt-4" data-outlet-garden-commerce>
                <Button fullWidth onClick={commerce.open} size="lg">
                    Rezerviraj u svom vrtu
                </Button>
            </div>
        );
    }

    return (
        <section
            aria-live="polite"
            className="mt-4 rounded-xl border border-lime-200 bg-lime-50/70 p-3 dark:border-lime-900 dark:bg-lime-950/30"
            data-outlet-garden-commerce
            data-outlet-garden-commerce-state={commerce.state}
        >
            {commerce.state === 'loading' ? (
                <div className="flex min-h-11 items-center gap-2 text-sm">
                    <Spinner loadingLabel="Učitavanje vrtova" />
                    Učitavamo tvoje vrtove i slobodna mjesta...
                </div>
            ) : null}

            {commerce.state === 'authentication-required' ? (
                <div>
                    <h3 className="font-semibold">Prijavi se za rezervaciju</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Ponuda ostaje odabrana dok se prijavljuješ.
                    </p>
                    <Button
                        className="mt-3"
                        fullWidth
                        onClick={onAuthenticationRequired}
                        size="lg"
                    >
                        Prijavi se i nastavi
                    </Button>
                </div>
            ) : null}

            {commerce.state === 'query-error' ? (
                <div>
                    <h3 className="font-semibold">
                        Nismo uspjeli učitati podatke
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Provjeri vezu i pokušaj ponovno. Odabrana ponuda ostaje
                        sačuvana.
                    </p>
                    <Button
                        className="mt-3"
                        fullWidth
                        onClick={() => void commerce.retryQueries()}
                        size="lg"
                        startDecorator={<Reset className="size-4" />}
                        variant="outlined"
                    >
                        Pokušaj ponovno
                    </Button>
                </div>
            ) : null}

            {commerce.state === 'ready' ||
            commerce.state === 'error' ||
            commerce.state === 'reserving' ? (
                <div>
                    <h3 className="font-semibold">Odaberi mjesto za sadnicu</h3>
                    <div className="mt-3 grid gap-3">
                        {commerce.gardens.length > 1 ? (
                            <label className="grid gap-1 text-sm">
                                <span className="font-medium">Vrt</span>
                                <select
                                    className="min-h-11 rounded-lg border bg-background px-3"
                                    disabled={commerce.state === 'reserving'}
                                    onChange={(event) =>
                                        commerce.selectGarden(
                                            Number(event.currentTarget.value),
                                        )
                                    }
                                    value={commerce.selectedGardenId ?? ''}
                                >
                                    {commerce.gardens.map((garden) => (
                                        <option
                                            key={garden.id}
                                            value={garden.id}
                                        >
                                            {garden.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ) : null}
                        <label className="grid gap-1 text-sm">
                            <span className="font-medium">Gredica</span>
                            <select
                                className="min-h-11 rounded-lg border bg-background px-3"
                                disabled={commerce.state === 'reserving'}
                                onChange={(event) =>
                                    commerce.selectRaisedBed(
                                        Number(event.currentTarget.value),
                                    )
                                }
                                value={commerce.selectedRaisedBedId ?? ''}
                            >
                                {commerce.raisedBeds.map((raisedBed) => (
                                    <option
                                        key={raisedBed.id}
                                        value={raisedBed.id}
                                    >
                                        {raisedBed.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="grid gap-1 text-sm">
                            <span className="font-medium">
                                Polje / pozicija
                            </span>
                            <select
                                className="min-h-11 rounded-lg border bg-background px-3"
                                disabled={commerce.state === 'reserving'}
                                onChange={(event) =>
                                    commerce.selectTarget(
                                        event.currentTarget.value,
                                    )
                                }
                                value={commerce.selectedTargetKey ?? ''}
                            >
                                {commerce.fieldTargets.map((target) => (
                                    <option
                                        key={targetKey(target)}
                                        value={targetKey(target)}
                                    >
                                        Polje{' '}
                                        {(target.positionIndex + 1).toString()}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    {commerce.errorMessage ? (
                        <p
                            className="mt-3 text-sm text-red-700 dark:text-red-300"
                            role="alert"
                        >
                            {commerce.errorMessage}
                        </p>
                    ) : null}
                    <Button
                        className="mt-3"
                        disabled={commerce.state === 'reserving'}
                        fullWidth
                        onClick={() => void commerce.reserve()}
                        size="lg"
                        startDecorator={
                            commerce.state === 'reserving' ? (
                                <Spinner loadingLabel="Rezerviranje sadnice" />
                            ) : undefined
                        }
                    >
                        {commerce.state === 'reserving'
                            ? 'Rezerviramo...'
                            : commerce.state === 'error'
                              ? 'Pokušaj ponovno'
                              : 'Rezerviraj sadnicu'}
                    </Button>
                </div>
            ) : null}

            {commerce.state === 'no-targets' ? (
                <div>
                    <h3 className="font-semibold">Nema slobodnog mjesta</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        U odabranom vrtu nema slobodnog mjesta. Odaberi drugi
                        vrt ili dodaj odnosno oslobodi mjesto u aktivnoj
                        gredici.
                    </p>
                    {commerce.gardens.length > 1 ? (
                        <label className="mt-3 grid gap-1 text-sm">
                            <span className="font-medium">Vrt</span>
                            <select
                                className="min-h-11 rounded-lg border bg-background px-3"
                                onChange={(event) =>
                                    commerce.selectGarden(
                                        Number(event.currentTarget.value),
                                    )
                                }
                                value={commerce.selectedGardenId ?? ''}
                            >
                                {commerce.gardens.map((garden) => (
                                    <option key={garden.id} value={garden.id}>
                                        {garden.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : null}
                    <Button
                        className="mt-3"
                        fullWidth
                        href="/"
                        size="lg"
                        variant="outlined"
                    >
                        Povratak u moj vrt
                    </Button>
                </div>
            ) : null}

            {commerce.state === 'unavailable' ? (
                <div>
                    <h3 className="font-semibold">Ponuda više nije dostupna</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Odaberi drugu sadnicu iz aktualnih ponuda.
                    </p>
                    <Button
                        className="mt-3"
                        fullWidth
                        onClick={onChooseAnother}
                        size="lg"
                        startDecorator={<Reset className="size-4" />}
                        variant="outlined"
                    >
                        Odaberi drugu
                    </Button>
                </div>
            ) : null}

            {commerce.state === 'success' && commerce.receipt ? (
                <div>
                    <span className="grid size-10 place-items-center rounded-full bg-lime-200 text-lime-900 dark:bg-lime-900 dark:text-lime-100">
                        <Check className="size-5" />
                    </span>
                    <h3
                        className="mt-2 font-semibold"
                        ref={statusHeadingRef}
                        tabIndex={-1}
                    >
                        Sadnica je rezervirana
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {commerce.receipt.gardenName} ·{' '}
                        {commerce.receipt.raisedBedName}, polje{' '}
                        {(commerce.receipt.positionIndex + 1).toString()}.
                        Rezervacija vrijedi do{' '}
                        {holdTimeFormatter.format(
                            new Date(commerce.receipt.holdExpiresAt),
                        )}
                        .
                    </p>
                    <div className="mt-3 grid gap-2">
                        {commerce.cartHref ? (
                            <Button
                                fullWidth
                                href={commerce.cartHref}
                                onClick={() => {
                                    commerce.continueToCart();
                                    onContinueToCart?.();
                                }}
                                size="lg"
                            >
                                Nastavi u košaricu
                            </Button>
                        ) : null}
                        <Button
                            fullWidth
                            onClick={onChooseAnother}
                            size="lg"
                            startDecorator={<Sprout className="size-4" />}
                            variant="outlined"
                        >
                            Odaberi drugu sadnicu
                        </Button>
                    </div>
                </div>
            ) : null}

            {commerce.state === 'expired' && commerce.receipt ? (
                <div>
                    <h3
                        className="font-semibold"
                        ref={statusHeadingRef}
                        tabIndex={-1}
                    >
                        Rezervacija je istekla
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Sadnica više nije zadržana u košarici. Osvježi ponude i
                        odaberi je ponovno ako je još dostupna.
                    </p>
                    <Button
                        className="mt-3"
                        fullWidth
                        onClick={onChooseAnother}
                        size="lg"
                        startDecorator={<Reset className="size-4" />}
                        variant="outlined"
                    >
                        Prikaži aktualne ponude
                    </Button>
                </div>
            ) : null}
        </section>
    );
}
