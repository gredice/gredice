import { Button } from '@gredice/ui/Button';
import { Info, Navigate } from '@gredice/ui/icons';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import type { useCheckout } from '../../../hooks/useCheckout';
import type { useShoppingCart } from '../../../hooks/useShoppingCart';
import { formatSunflowers } from '../../../utils/sunflowerPricing';
import { SunflowerCheckoutBalance } from './SunflowerCheckoutBalance';

type ButtonConfirmPaymentProps = {
    cart: ReturnType<typeof useShoppingCart>['data'];
    checkout: ReturnType<typeof useCheckout>;
    onConfirm: () => void;
    disabled?: boolean;
    requiresAccountUpgrade?: boolean;
};

export function ButtonConfirmPayment({
    cart,
    checkout,
    disabled,
    onConfirm,
    requiresAccountUpgrade,
}: ButtonConfirmPaymentProps) {
    const paymentLabel = requiresAccountUpgrade
        ? 'Spremi račun i plati'
        : 'Plati';
    const confirmPaymentLabel = requiresAccountUpgrade
        ? 'Spremi račun i plati'
        : 'Potvrdi i plati';
    const buttonDisabled =
        disabled ||
        !cart?.items.length ||
        checkout.isPending ||
        !cart?.allowPurchase;

    if (requiresAccountUpgrade) {
        return (
            <Button
                variant="solid"
                onClick={onConfirm}
                disabled={buttonDisabled}
                loading={checkout.isPending}
                startDecorator={
                    !cart?.allowPurchase ? (
                        <Info className="size-5 shrink-0" />
                    ) : undefined
                }
                endDecorator={<Navigate className="size-5 shrink-0" />}
            >
                {cart?.totalSunflowers ? confirmPaymentLabel : paymentLabel}
            </Button>
        );
    }

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
                            disabled={buttonDisabled}
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
                            {confirmPaymentLabel}
                        </Button>
                    }
                >
                    <SunflowerCheckoutBalance cart={cart} />
                </ModalConfirm>
            ) : (
                <Button
                    variant="solid"
                    onClick={onConfirm}
                    disabled={buttonDisabled}
                    loading={checkout.isPending}
                    startDecorator={
                        !cart?.allowPurchase ? (
                            <Info className="size-5 shrink-0" />
                        ) : undefined
                    }
                    endDecorator={<Navigate className="size-5 shrink-0" />}
                >
                    {paymentLabel}
                </Button>
            )}
        </>
    );
}
