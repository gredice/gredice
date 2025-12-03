import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';

export function ButtonPricePickPaymentMethod({
    price,
    isSunflower,
    onChange,
    availableSunflowers,
    disabled = false,
}: {
    price: number | null | undefined;
    isSunflower: boolean;
    onChange?: (isSunflower: boolean) => void;
    availableSunflowers?: number;
    disabled?: boolean;
}) {
    function handleToggle() {
        if (isToggleDisabled) return;
        onChange?.(!isSunflower);
    }

    if (price == null || price === undefined) {
        return <Typography level="body1">Nevaljan iznos</Typography>;
    }

    const displayPrice = isSunflower ? price * 1000 : price;
    const requiredSunflowers = price ? price * 1000 : 0;
    const canAffordSunflowers =
        availableSunflowers !== undefined
            ? availableSunflowers >= requiredSunflowers
            : true;
    const isToggleDisabled = disabled || (!isSunflower && !canAffordSunflowers);

    return (
        <Row spacing={1}>
            {/* Price Display */}
            <Typography level="body1" semiBold>
                {displayPrice.toFixed(2)}
            </Typography>

            {/* Custom Switch */}
            <button
                type="button"
                onClick={handleToggle}
                disabled={isToggleDisabled}
                className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-1 focus:outline-[#2f6e40] focus:outline-offset-2 ${
                    isToggleDisabled
                        ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                        : isSunflower
                          ? 'bg-yellow-200 dark:bg-yellow-400'
                          : 'bg-gray-300 dark:bg-slate-600'
                }`}
                role="switch"
                aria-checked={isSunflower}
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
