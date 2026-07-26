import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { DotIndicator } from '@gredice/ui/DotIndicator';
import {
    Calendar,
    Delete,
    Info,
    Navigate,
    ShoppingCart as ShoppingCartIcon,
    Truck,
} from '@gredice/ui/icons';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { isCompleteDeliverySelection, useCheckout } from '../hooks/useCheckout';
import { useCurrentAccount } from '../hooks/useCurrentAccount';
import { useHarvestSchedule } from '../hooks/useHarvestSchedule';
import { useShoppingCart } from '../hooks/useShoppingCart';
import { useShoppingCartDelete } from '../hooks/useShoppingCartDelete';
import { useShoppingCartTransientHub } from '../hooks/useShoppingCartTransientHub';
import {
    type DeliverySelectionData,
    DeliveryStep,
    type DeliveryStepSummary,
} from '../shared-ui/delivery/DeliveryStep';
import {
    type HarvestScheduleDateSelection,
    HarvestScheduleStep,
} from '../shared-ui/delivery/HarvestScheduleStep';
import { isHarvestDateWithinRange } from '../shared-ui/delivery/harvestSchedule';
import { GameModal } from '../shared-ui/game-modal';
import { useShoppingCartOpenParam } from '../useUrlState';
import {
    calculateSunflowerAmountFromPrices,
    formatSunflowers,
} from '../utils/sunflowerPricing';
import { HudCard } from './components/HudCard';
import { ButtonConfirmPayment } from './components/shopping-cart/ButtonConfirmPayment';
import { ShoppingCartItemsPresence } from './components/shopping-cart/ShoppingCartItemsPresence';
import { ShoppingCartStepTransition } from './components/shopping-cart/ShoppingCartStepTransition';

const sunflowerSuggestionLayoutExitDelayMs = 150;

function useSunflowerSuggestionLayout(showSuggestion: boolean) {
    const [reserveLayout, setReserveLayout] = useState(showSuggestion);

    useLayoutEffect(() => {
        if (showSuggestion) {
            if (!reserveLayout) {
                setReserveLayout(true);
            }
            return;
        }

        if (!reserveLayout) {
            return;
        }

        const timeout = window.setTimeout(() => {
            setReserveLayout(false);
        }, sunflowerSuggestionLayoutExitDelayMs);

        return () => window.clearTimeout(timeout);
    }, [reserveLayout, showSuggestion]);

    return reserveLayout;
}

export type ShoppingCartCheckoutStep = 'cart' | 'delivery' | 'harvest';

interface ShoppingCartProps {
    checkoutStep: ShoppingCartCheckoutStep;
    deliverySummary: DeliveryStepSummary | null;
    onCheckoutStepChange: (step: ShoppingCartCheckoutStep) => void;
    onDeliverySummaryChange: (summary: DeliveryStepSummary) => void;
}

export function ShoppingCart({
    checkoutStep,
    deliverySummary,
    onCheckoutStepChange,
    onDeliverySummaryChange,
}: ShoppingCartProps) {
    const { data: account } = useCurrentAccount();
    const { data: cart, isLoading, isError } = useShoppingCart();
    const { track } = useGameAnalytics();
    const deleteCart = useShoppingCartDelete();
    const checkout = useCheckout();
    const shouldRenderCartItems = !isLoading && (!isError || Boolean(cart));

    // State for delivery flow
    const [deliverySelection, setDeliverySelection] =
        useState<DeliverySelectionData | null>(null);
    const [harvestDates, setHarvestDates] = useState<
        readonly HarvestScheduleDateSelection[]
    >([]);
    const [transitionDirection, setTransitionDirection] = useState<
        'forward' | 'backward'
    >('forward');
    const harvestSchedule = useHarvestSchedule(
        deliverySelection?.slotId,
        checkoutStep === 'harvest',
    );

    const showSunflowersSuggestion = Boolean(
        !cart?.items.some((item) => item.currency === 'sunflower') &&
            cart?.items.some(
                (item) =>
                    (account?.sunflowers.amount ?? 0) >=
                    calculateSunflowerAmountFromPrices({
                        price: item.shopData.price,
                        discountPrice: item.shopData.discountPrice,
                    }),
            ),
    );
    const reserveSunflowersSuggestionLayout = useSunflowerSuggestionLayout(
        showSunflowersSuggestion,
    );

    function submitCheckout(
        selectedHarvestDates?: readonly HarvestScheduleDateSelection[],
    ) {
        if (!cart?.id) {
            console.error('No cart available for checkout');
            return;
        }

        if (
            cart.hasDeliverableItems &&
            !isCompleteDeliverySelection(deliverySelection)
        ) {
            handleDelivery();
            return;
        }

        const checkoutData = {
            cartId: cart.id,
            ...(isCompleteDeliverySelection(deliverySelection) && {
                deliveryInfo: deliverySelection,
            }),
            ...(selectedHarvestDates && {
                harvestDates: [...selectedHarvestDates],
            }),
        };

        track('game_cart_checkout_clicked', {
            has_delivery_selection:
                isCompleteDeliverySelection(deliverySelection),
            harvest_date_count: selectedHarvestDates?.length ?? 0,
            item_count: cart.items.length,
            total: cart.total,
            total_sunflowers: cart.totalSunflowers,
        });
        checkout.mutate(checkoutData);
    }

    function handleDeleteCart() {
        track('game_cart_cleared', {
            item_count: cart?.items.length,
            total: cart?.total,
        });
        deleteCart.mutate();
    }

    function handleBackToCart() {
        setTransitionDirection('backward');
        onCheckoutStepChange('cart');
    }

    function handleDelivery() {
        track('game_cart_delivery_opened', {
            item_count: cart?.items.length,
            total: cart?.total,
        });
        setTransitionDirection('forward');
        onCheckoutStepChange('delivery');
    }

    function handleDeliveryProceed(summary: DeliveryStepSummary) {
        if (isCompleteDeliverySelection(deliverySelection)) {
            onDeliverySummaryChange(summary);
            setHarvestDates([]);
            setTransitionDirection('forward');
            onCheckoutStepChange('harvest');
            track('game_cart_harvest_schedule_opened', {
                item_count: cart?.items.length,
                slot_id: deliverySelection.slotId,
            });
        }
    }

    function handleBackToDelivery() {
        setTransitionDirection('backward');
        onCheckoutStepChange('delivery');
    }

    if (checkoutStep === 'delivery') {
        return (
            <ShoppingCartStepTransition
                direction={transitionDirection}
                step="delivery"
            >
                <DeliveryStep
                    initialSelection={deliverySelection}
                    onSelectionChange={setDeliverySelection}
                    onBack={handleBackToCart}
                    onProceed={handleDeliveryProceed}
                    isValid={isCompleteDeliverySelection(deliverySelection)}
                />
            </ShoppingCartStepTransition>
        );
    }

    if (checkoutStep === 'harvest') {
        const scheduleItems =
            harvestSchedule.data?.items.map((item) => ({
                ...item,
                plants: item.plants.map((plant) => ({
                    id: plant.plantId,
                    label: plant.label,
                    maxHarvestDaysBeforeDelivery:
                        plant.maxHarvestDaysBeforeDelivery,
                })),
                reason: item.validationReason,
                scheduledDate: item.scheduledDate ?? '',
            })) ?? [];
        const selectedDateByItemId = new Map(
            harvestDates.map((selection) => [
                selection.cartItemId,
                selection.scheduledDate,
            ]),
        );
        const canSubmitHarvestSchedule =
            Boolean(harvestSchedule.data && deliverySummary) &&
            harvestDates.length === scheduleItems.length &&
            scheduleItems.every((item) =>
                isHarvestDateWithinRange(
                    selectedDateByItemId.get(item.cartItemId) ?? '',
                    item,
                ),
            );

        return (
            <ShoppingCartStepTransition
                direction={transitionDirection}
                step="harvest"
            >
                {harvestSchedule.isLoading ? (
                    <Stack spacing={4}>
                        <Typography
                            aria-live="polite"
                            component="h3"
                            level="body1"
                            role="status"
                        >
                            Provjeravam datume branja...
                        </Typography>
                        <Row justifyContent="end">
                            <Button
                                disabled={checkout.isPending}
                                variant="outlined"
                                onClick={handleBackToDelivery}
                            >
                                Natrag
                            </Button>
                        </Row>
                    </Stack>
                ) : null}
                {harvestSchedule.isError ? (
                    <Stack spacing={4}>
                        <Alert color="danger">
                            Nije moguće provjeriti datume branja. Pokušaj
                            ponovno ili odaberi drugi termin.
                        </Alert>
                        <Row justifyContent="end" spacing={4}>
                            <Button
                                variant="outlined"
                                onClick={handleBackToDelivery}
                            >
                                Natrag
                            </Button>
                            <Button
                                loading={harvestSchedule.isFetching}
                                onClick={() => harvestSchedule.refetch()}
                            >
                                Pokušaj ponovno
                            </Button>
                        </Row>
                    </Stack>
                ) : null}
                {harvestSchedule.data && deliverySummary ? (
                    <HarvestScheduleStep
                        confirmAction={
                            <ButtonConfirmPayment
                                cart={cart}
                                checkout={checkout}
                                disabled={!canSubmitHarvestSchedule}
                                onConfirm={() => submitCheckout(harvestDates)}
                            />
                        }
                        delivery={{
                            deliveryDate: harvestSchedule.data.deliveryDate,
                            mode: deliverySummary.mode,
                            slotStartAt: deliverySummary.startAt,
                            slotEndAt: deliverySummary.endAt,
                            destinationLabel: deliverySummary.destinationLabel,
                        }}
                        items={scheduleItems}
                        isConfirming={checkout.isPending}
                        onBack={handleBackToDelivery}
                        onConfirm={submitCheckout}
                        onSelectedDatesChange={setHarvestDates}
                    />
                ) : null}
                {checkout.isError ? (
                    <Alert color="danger">
                        Plaćanje nije pokrenuto. Provjeri termin i datume branja
                        pa pokušaj ponovno.
                    </Alert>
                ) : null}
            </ShoppingCartStepTransition>
        );
    }

    const cartStep = (
        <Stack spacing={4}>
            <Stack>
                <div
                    className={cx(
                        'opacity-0 transition-opacity duration-150',
                        reserveSunflowersSuggestionLayout
                            ? 'h-auto mb-4'
                            : 'h-0',
                        showSunflowersSuggestion
                            ? 'opacity-100'
                            : 'pointer-events-none',
                    )}
                    data-shopping-cart-sunflowers-suggestion
                >
                    <Alert color="primary">
                        Dio košare možeš platiti u{' '}
                        <span className="text-yellow-500">🌻</span>. Odaberi
                        željeni način plaćanja desno od cijene.
                    </Alert>
                </div>
                <Stack>
                    <Stack
                        spacing={4}
                        className="max-h-[50vh] overflow-x-visible overflow-y-scroll px-2 py-1 -mx-2"
                    >
                        {isLoading && (
                            <Typography level="body1">Učitavanje...</Typography>
                        )}
                        {isError && (
                            <Typography level="body1">
                                Greška prilikom učitavanja košare
                            </Typography>
                        )}
                        {shouldRenderCartItems ? (
                            <ShoppingCartItemsPresence
                                items={cart?.items ?? []}
                            />
                        ) : null}
                    </Stack>
                    <Stack
                        className="border-t mt-4 pt-2"
                        data-shopping-cart-summary
                        spacing={2}
                    >
                        <Row
                            justifyContent="space-between"
                            alignItems="start"
                            spacing={4}
                        >
                            <Typography level="body1">Ukupno</Typography>
                            <Stack>
                                <Typography level="body1" bold>
                                    {cart?.total.toFixed(2)} €
                                </Typography>
                                {(cart?.totalSunflowers ?? 0) > 0 && (
                                    <Typography level="body1" bold>
                                        {(cart?.totalSunflowers ?? 0) > 0
                                            ? formatSunflowers(
                                                  cart?.totalSunflowers ?? 0,
                                              )
                                            : '0'}{' '}
                                        <span className={'text-lg'}>🌻</span>
                                    </Typography>
                                )}
                            </Stack>
                        </Row>
                        <Stack spacing={2}>
                            {/* Display notes if present */}
                            {cart && (cart?.notes?.length ?? 0) > 0 && (
                                <Stack spacing={2}>
                                    {cart.notes.map((note) => (
                                        <Alert
                                            key={note}
                                            color="info"
                                            startDecorator={
                                                <Info className="opacity-80 stroke-blue-900 dark:stroke-blue-100 mt-px" />
                                            }
                                        >
                                            <Typography
                                                level="body2"
                                                className="text-blue-900 dark:text-blue-100"
                                            >
                                                {note}
                                            </Typography>
                                        </Alert>
                                    ))}
                                </Stack>
                            )}
                            <div className="flex flex-row gap-2 justify-between flex-wrap">
                                {/* TODO: Localize */}
                                <ModalConfirm
                                    title="Potvrdi brisanje košare"
                                    header="Brisanje košare"
                                    onConfirm={handleDeleteCart}
                                    trigger={
                                        <Button
                                            variant="plain"
                                            disabled={
                                                !cart?.items.length ||
                                                deleteCart.isPending
                                            }
                                            loading={deleteCart.isPending}
                                            startDecorator={
                                                <Delete className="size-5 shrink-0" />
                                            }
                                        >
                                            Očisti košaru
                                        </Button>
                                    }
                                >
                                    <Typography>
                                        Jeste li sigurni da želite obrisati sve
                                        stavke iz košare?
                                    </Typography>
                                </ModalConfirm>
                                {cart?.hasDeliverableItems ? (
                                    <Button
                                        variant="solid"
                                        disabled={!cart.allowPurchase}
                                        startDecorator={
                                            !cart?.allowPurchase ? (
                                                <Info className="size-5 shrink-0" />
                                            ) : undefined
                                        }
                                        endDecorator={
                                            <Navigate className="size-5 shrink-0" />
                                        }
                                        onClick={handleDelivery}
                                    >
                                        Dostava
                                    </Button>
                                ) : (
                                    <ButtonConfirmPayment
                                        cart={cart}
                                        checkout={checkout}
                                        onConfirm={() => submitCheckout()}
                                    />
                                )}
                            </div>
                        </Stack>
                    </Stack>
                </Stack>
            </Stack>
        </Stack>
    );

    return (
        <ShoppingCartStepTransition direction={transitionDirection} step="cart">
            {cartStep}
        </ShoppingCartStepTransition>
    );
}

export function ShoppingCartHud() {
    const { data: cart, refetch: refetchCart } = useShoppingCart();
    const { track } = useGameAnalytics();
    const [isOpen, setIsOpen] = useShoppingCartOpenParam();
    const [checkoutStep, setCheckoutStep] =
        useState<ShoppingCartCheckoutStep>('cart');
    const [deliverySummary, setDeliverySummary] =
        useState<DeliveryStepSummary | null>(null);
    const showTransientHub = useShoppingCartTransientHub(isOpen);

    useEffect(() => {
        if (isOpen) {
            void refetchCart();
        }
    }, [isOpen, refetchCart]);

    if (!cart?.items.length && !showTransientHub && !isOpen) {
        return null;
    }

    return (
        <HudCard open position="floating" className="static p-0.5">
            <Row spacing={2}>
                <GameModal
                    open={isOpen}
                    onOpenChange={(open) => {
                        if (open) {
                            track('game_cart_opened', {
                                item_count: cart?.items.length ?? 0,
                                total: cart?.total ?? 0,
                            });
                        } else {
                            setCheckoutStep('cart');
                            setDeliverySummary(null);
                        }
                        setIsOpen(open);
                    }}
                    title={
                        checkoutStep === 'cart'
                            ? 'Košara'
                            : checkoutStep === 'delivery'
                              ? 'Dostava'
                              : deliverySummary?.mode === 'pickup'
                                ? 'Sažetak preuzimanja'
                                : 'Sažetak dostave'
                    }
                    className="md:max-w-2xl"
                    headerIcon={
                        checkoutStep === 'delivery' ? (
                            <Truck className="size-7 shrink-0" />
                        ) : checkoutStep === 'harvest' ? (
                            <Calendar className="size-7 shrink-0" />
                        ) : (
                            <ShoppingCartIcon className="size-7 shrink-0" />
                        )
                    }
                    hudLayer
                    trigger={
                        <Button
                            title="Košara"
                            variant="plain"
                            className="relative rounded-full p-2 gap-2"
                        >
                            <ShoppingCartIcon className="!stroke-[1.4px] shrink-0  size-6" />
                            <Typography
                                level="body2"
                                semiBold
                                className="text-foreground"
                            >
                                {(cart?.total ?? 0).toFixed(2)} €
                            </Typography>
                            {Boolean(cart?.items.length) && (
                                <div className="absolute -right-2 -top-2">
                                    <div className="absolute inset-[3.5px] border bg-green-500 border-green-500 size-[17px] rounded-full animate-ping -z-10"></div>
                                    <DotIndicator
                                        size={24}
                                        color={'success'}
                                        content={
                                            <Typography>
                                                {cart?.items.length}
                                            </Typography>
                                        }
                                    />
                                </div>
                            )}
                        </Button>
                    }
                >
                    <ShoppingCart
                        checkoutStep={checkoutStep}
                        deliverySummary={deliverySummary}
                        onCheckoutStepChange={setCheckoutStep}
                        onDeliverySummaryChange={setDeliverySummary}
                    />
                </GameModal>
            </Row>
        </HudCard>
    );
}
