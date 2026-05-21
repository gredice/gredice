import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useRef } from 'react';
import { useSunflowerTransferAnimation } from '../../../indicators/SunflowerTransfer/useSunflowerTransferAnimation';
import {
    calculateSunflowerAmountFromPrices,
    formatSunflowers,
    getEffectiveEurPrice,
} from '../../../utils/sunflowerPricing';

export function ButtonPricePickPaymentMethod({
    price,
    isSunflower,
    onChange,
    availableSunflowers,
    discountPrice,
    disabled = false,
}: {
    price: number | null | undefined;
    isSunflower: boolean;
    onChange?: (isSunflower: boolean) => void;
    availableSunflowers?: number;
    discountPrice?: number | null;
    disabled?: boolean;
}) {
    const paymentTargetRef = useRef<HTMLButtonElement>(null);
    const runSunflowerTransfer = useSunflowerTransferAnimation();

    if (price == null || price === undefined) {
        return <Typography level="body1">Nevaljan iznos</Typography>;
    }

    const effectivePrice = getEffectiveEurPrice({ price, discountPrice });
    const requiredSunflowers = calculateSunflowerAmountFromPrices({
        price,
        discountPrice,
    });
    const displayPrice = isSunflower ? requiredSunflowers : effectivePrice;
    const formattedDisplayPrice = isSunflower
        ? formatSunflowers(displayPrice)
        : displayPrice.toFixed(2);
    const canAffordSunflowers =
        availableSunflowers !== undefined
            ? availableSunflowers >= requiredSunflowers
            : true;
    const isToggleDisabled = disabled || (!isSunflower && !canAffordSunflowers);
    const nextIsSunflower = !isSunflower;

    function handleToggle() {
        if (isToggleDisabled) return;

        runSunflowerTransfer({
            paymentElement: paymentTargetRef.current,
            direction: nextIsSunflower ? 'hud-to-payment' : 'payment-to-hud',
            amount: requiredSunflowers,
        });
        onChange?.(nextIsSunflower);
    }

    return (
        <Row spacing={1}>
            {/* Price Display */}
            <Typography level="body1" semiBold>
                {formattedDisplayPrice}
            </Typography>

            {/* Custom Switch */}
            <button
                ref={paymentTargetRef}
                type="button"
                onClick={handleToggle}
                disabled={isToggleDisabled}
                data-sunflower-payment-target
                className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-1 focus:outline-[#2f6e40] focus:outline-offset-2 ${
                    isToggleDisabled
                        ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                        : isSunflower
                          ? 'bg-yellow-200 dark:bg-yellow-400'
                          : 'bg-gray-300 dark:bg-slate-600'
                }`}
                role="switch"
                aria-checked={isSunflower}
                aria-label={
                    isSunflower
                        ? `Plaćanje suncokretima, ${formatSunflowers(requiredSunflowers)} suncokreta`
                        : `Plaćanje eurima, prebaci na ${formatSunflowers(requiredSunflowers)} suncokreta`
                }
                title={
                    isToggleDisabled && !isSunflower
                        ? 'Nedovoljno suncokreta'
                        : undefined
                }
            >
                <span
                    className={`size-5 transform rounded-full bg-white text-black shadow-lg transition-transform flex items-center justify-center text-md font-medium ${
                        isSunflower ? 'translate-x-5' : 'translate-x-0.5'
                    } ${isToggleDisabled ? 'opacity-60' : ''}`}
                >
                    {isSunflower ? '🌻' : '€'}
                </span>
            </button>
        </Row>
    );
}
