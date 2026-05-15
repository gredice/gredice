import { Alert } from '@signalco/ui/Alert';
import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import { NoDataPlaceholder } from '@signalco/ui/NoDataPlaceholder';
import {
    Delete,
    Info,
    Navigate,
    ShoppingCart as ShoppingCartIcon,
} from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { cx } from '@signalco/ui-primitives/cx';
import { DotIndicator } from '@signalco/ui-primitives/DotIndicator';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { isCompleteDeliverySelection, useCheckout } from '../hooks/useCheckout';
import { useCurrentAccount } from '../hooks/useCurrentAccount';
import { useShoppingCart } from '../hooks/useShoppingCart';
import { useShoppingCartDelete } from '../hooks/useShoppingCartDelete';
import {
    type DeliverySelectionData,
    DeliveryStep,
} from '../shared-ui/delivery/DeliveryStep';
import { useShoppingCartOpenParam } from '../useUrlState';
import { calculateSunflowerAmountFromPrices } from '../utils/sunflowerPricing';
import { HudCard } from './components/HudCard';
import { ButtonConfirmPayment } from './components/shopping-cart/ButtonConfirmPayment';
import { ShoppingCartItem } from './components/shopping-cart/ShoppingCartItem';
import { SunflowerCheckoutBalance } from './components/shopping-cart/SunflowerCheckoutBalance';

export function ShoppingCart() {
    const { data: account } = useCurrentAccount();
    const { data: cart, isLoading, isError } = useShoppingCart();
    const { track } = useGameAnalytics();
    const deleteCart = useShoppingCartDelete();
    const checkout = useCheckout();

    // State for delivery flow
    const [showDeliveryStep, setShowDeliveryStep] = useState(false);
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
            setShowDeliveryStep(true);
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
        setShowDeliveryStep(false);
    }

    function handleDelivery() {
        track('game_cart_delivery_opened', {
            item_count: cart?.items.length,
            total: cart?.total,
        });
        setShowDeliveryStep(true);
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
        <Stack spacing={2}>
            <Row spacing={2}>
                <div className="rounded-full bg-tertiary/40 p-3 flex items-center justify-center">
                    <ShoppingCartIcon className="size-7 shrink-0" />
                </div>
                <Typography level="h3">Košara</Typography>
            </Row>
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
                        spacing={2}
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
                    <Stack className="border-t mt-4 pt-2" spacing={1}>
                        <SunflowerCheckoutBalance cart={cart} />
                        <Row
                            justifyContent="space-between"
                            alignItems="start"
                            spacing={2}
                        >
                            <Typography level="body1">Ukupno</Typography>
                            <Stack>
                                <Typography level="body1" bold>
                                    {cart?.total.toFixed(2)} €
                                </Typography>
                                {(cart?.totalSunflowers ?? 0) > 0 && (
                                    <Typography level="body1" bold>
                                        {(cart?.totalSunflowers ?? 0) > 0
                                            ? `${cart?.totalSunflowers ?? 0}`
                                            : '0'}{' '}
                                        <span className={'text-lg'}>🌻</span>
                                    </Typography>
                                )}
                            </Stack>
                        </Row>
                        <Stack spacing={1}>
                            {/* Display notes if present */}
                            {cart && (cart?.notes?.length ?? 0) > 0 && (
                                <Stack spacing={1}>
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

    if (!cart?.items.length) {
        return null;
    }

    return (
        <HudCard open position="floating" className="static p-0.5">
            <Row spacing={1}>
                <Modal
                    open={isOpen}
                    onOpenChange={(open) => {
                        if (open) {
                            track('game_cart_opened', {
                                item_count: cart.items.length,
                                total: cart.total,
                            });
                        }
                        setIsOpen(open);
                    }}
                    title="Košara"
                    className="border-tertiary border-b-4 md:max-w-2xl"
                    trigger={
                        <Button
                            title="Košara"
                            variant="plain"
                            className="relative rounded-full p-2 gap-2"
                        >
                            <div className="relative size-7 shrink-0">
                                <ShoppingCartIcon className="!stroke-[1.4px] size-7 text-foreground" />
                                {cart.items.length > 0 && (
                                    <div className="absolute left-[3px] top-[9px] flex items-center gap-0.5 max-w-[22px] overflow-hidden">
                                        {cart.items
                                            .slice(0, 2)
                                            .map((item, index) => {
                                                const imageUrl =
                                                    item.shopData.image ??
                                                    item.entityData?.image
                                                        ?.cover?.url ??
                                                    item.entityData?.images
                                                        ?.cover?.url;
                                                return imageUrl ? (
                                                    <div
                                                        key={item.id}
                                                        aria-hidden
                                                        className={cx(
                                                            'size-2.5 rounded-sm border border-background bg-cover bg-center shadow-sm',
                                                            index === 1 &&
                                                                '-ml-0.5',
                                                        )}
                                                        style={{
                                                            backgroundImage: `url(${imageUrl})`,
                                                        }}
                                                    />
                                                ) : (
                                                    <div
                                                        key={item.id}
                                                        aria-hidden
                                                        className={cx(
                                                            'size-2.5 rounded-sm border border-background bg-muted',
                                                            index === 1 &&
                                                                '-ml-0.5',
                                                        )}
                                                    />
                                                );
                                            })}
                                        {cart.items.length > 2 && (
                                            <span
                                                aria-hidden
                                                className="-ml-0.5 rounded-sm bg-background/95 px-0.5 text-[8px] leading-none text-foreground border border-muted"
                                            >
                                                +{cart.items.length - 2}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <Typography
                                level="body2"
                                semiBold
                                className="text-foreground"
                            >
                                {(cart.total ?? 0).toFixed(2)} €
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
                    <ShoppingCart />
                </Modal>
            </Row>
        </HudCard>
    );
}
