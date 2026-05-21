import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import { Info, Navigate } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import type { useCheckout } from '../../../hooks/useCheckout';
import type { useShoppingCart } from '../../../hooks/useShoppingCart';
import { formatSunflowers } from '../../../utils/sunflowerPricing';
import { SunflowerCheckoutBalance } from './SunflowerCheckoutBalance';

type ButtonConfirmPaymentProps = {
    cart: ReturnType<typeof useShoppingCart>['data'];
    checkout: ReturnType<typeof useCheckout>;
    onConfirm: () => void;
    disabled?: boolean;
};

export function ButtonConfirmPayment({
    cart,
    checkout,
    disabled,
    onConfirm,
}: ButtonConfirmPaymentProps) {
    return (
        <>
            {cart?.totalSunflowers ? (
                <ModalConfirm
                    title="Potvrdi plaćanje"
                    header={`Potvrđuješ plaćanje ${formatSunflowers(cart?.totalSunflowers ?? 0)} 🌻 i ${cart?.total.toFixed(2) ?? 0} €?`}
                    onConfirm={onConfirm}
                    trigger={
                        <Button
                            variant="solid"
                            disabled={
                                disabled ||
                                !cart?.items.length ||
                                checkout.isPending ||
                                !cart.allowPurchase
                            }
                            loading={checkout.isPending}
                            startDecorator={
                                !cart?.allowPurchase ? (
                                    <Info className="size-5 shrink-0" />
                                ) : undefined
                            }
                            endDecorator={
                                <Navigate className="size-5 shrink-0" />
                            }
                        >
                            Potvrdi i plati
                        </Button>
                    }
                >
                    <SunflowerCheckoutBalance cart={cart} />
                </ModalConfirm>
            ) : (
                <Button
                    variant="solid"
                    onClick={onConfirm}
                    disabled={
                        disabled ||
                        !cart?.items.length ||
                        checkout.isPending ||
                        !cart.allowPurchase
                    }
                    loading={checkout.isPending}
                    startDecorator={
                        !cart?.allowPurchase ? (
                            <Info className="size-5 shrink-0" />
                        ) : undefined
                    }
                    endDecorator={<Navigate className="size-5 shrink-0" />}
                >
                    Plati
                </Button>
            )}
        </>
    );
}
