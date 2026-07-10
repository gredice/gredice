import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { DotIndicator } from '@gredice/ui/DotIndicator';
import {
    Delete,
    Info,
    Navigate,
    ShoppingCart as ShoppingCartIcon,
    Truck,
} from '@gredice/ui/icons';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { isCompleteDeliverySelection, useCheckout } from '../hooks/useCheckout';
import { useCurrentAccount } from '../hooks/useCurrentAccount';
import { useShoppingCart } from '../hooks/useShoppingCart';
import { useShoppingCartDelete } from '../hooks/useShoppingCartDelete';
import { useShoppingCartTransientHub } from '../hooks/useShoppingCartTransientHub';
import {
    type DeliverySelectionData,
    DeliveryStep,
} from '../shared-ui/delivery/DeliveryStep';
import { GameModal } from '../shared-ui/game-modal';
import { useShoppingCartOpenParam } from '../useUrlState';
import {
    calculateSunflowerAmountFromPrices,
    formatSunflowers,
} from '../utils/sunflowerPricing';
import { HudCard } from './components/HudCard';
import { ButtonConfirmPayment } from './components/shopping-cart/ButtonConfirmPayment';
import { ShoppingCartItem } from './components/shopping-cart/ShoppingCartItem';

interface ShoppingCartProps {
    showDeliveryStep: boolean;
    onShowDeliveryStepChange: (showDeliveryStep: boolean) => void;
}

export function ShoppingCart({
    showDeliveryStep,
    onShowDeliveryStepChange,
}: ShoppingCartProps) {
    const { data: account } = useCurrentAccount();
    const { data: cart, isLoading, isError } = useShoppingCart();
    const { track } = useGameAnalytics();
    const deleteCart = useShoppingCartDelete();
    const checkout = useCheckout();

    // State for delivery flow
    const [deliverySelection, setDeliverySelection] =
        useState<DeliverySelectionData | null>(null);

    const showSunflowersSuggestion =
        !cart?.items.some((item) => item.currency === 'sunflower') &&
        cart?.items.some(
            (item) =>
                (account?.sunflowers.amount ?? 0) >=
                calculateSunflowerAmountFromPrices({
                    price: item.shopData.price,
                    discountPrice: item.shopData.discountPrice,
                }),
        );

    function handleCheckout() {
        if (!cart?.id) {
            console.error('No cart available for checkout');
            return;
        }

        // If cart contains deliverable items and user hasn't gone through delivery step yet
        if (cart.hasDeliverableItems && !deliverySelection) {
            track('game_cart_delivery_opened', {
                item_count: cart.items.length,
                total: cart.total,
            });
            onShowDeliveryStepChange(true);
            return;
        }

        // Prepare checkout data with delivery information if available
        const checkoutData = {
            cartId: cart.id,
            ...(isCompleteDeliverySelection(deliverySelection) && {
                deliveryInfo: deliverySelection,
            }),
        };

        track('game_cart_checkout_clicked', {
            has_delivery_selection:
                isCompleteDeliverySelection(deliverySelection),
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
        onShowDeliveryStepChange(false);
    }

    function handleDelivery() {
        track('game_cart_delivery_opened', {
            item_count: cart?.items.length,
            total: cart?.total,
        });
        onShowDeliveryStepChange(true);
    }

    function handleDeliveryProceed() {
        if (isCompleteDeliverySelection(deliverySelection)) {
            // Proceed with checkout including delivery information
            handleCheckout();
        }
    }

    // Show delivery step if user clicked on checkout with deliverable items
    if (showDeliveryStep) {
        return (
            <DeliveryStep
                onSelectionChange={setDeliverySelection}
                onBack={handleBackToCart}
                onProceed={handleDeliveryProceed}
                checkout={checkout}
                isValid={isCompleteDeliverySelection(deliverySelection)}
            />
        );
    }

    return (
        <Stack spacing={4}>
            <Stack>
                <div
                    className={cx(
                        'opacity-0 h-0 transition-all duration-150',
                        showSunflowersSuggestion
                            ? 'opacity-100 h-auto mb-4'
                            : 'pointer-events-none',
                    )}
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
                        {!isLoading &&
                            !isError &&
                            (cart?.items.length ? (
                                cart.items.map((item) => (
                                    <ShoppingCartItem
                                        key={item.id}
                                        item={item}
                                    />
                                ))
                            ) : (
                                <NoDataPlaceholder>
                                    Košara je prazna
                                </NoDataPlaceholder>
                            ))}
                    </Stack>
                    <Stack className="border-t mt-4 pt-2" spacing={2}>
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
                                        onConfirm={handleCheckout}
                                    />
                                )}
                            </div>
                        </Stack>
                    </Stack>
                </Stack>
            </Stack>
        </Stack>
    );
}

export function ShoppingCartHud() {
    const { data: cart } = useShoppingCart();
    const { track } = useGameAnalytics();
    const [isOpen, setIsOpen] = useShoppingCartOpenParam();
    const [showDeliveryStep, setShowDeliveryStep] = useState(false);
    const showTransientHub = useShoppingCartTransientHub(isOpen);

    if (!cart?.items.length && !showTransientHub) {
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
                        }
                        setIsOpen(open);
                    }}
                    title={showDeliveryStep ? 'Dostava' : 'Košara'}
                    className="md:max-w-2xl"
                    headerIcon={
                        showDeliveryStep ? (
                            <Truck className="size-7 shrink-0" />
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
                        showDeliveryStep={showDeliveryStep}
                        onShowDeliveryStepChange={setShowDeliveryStep}
                    />
                </GameModal>
            </Row>
        </HudCard>
    );
}
