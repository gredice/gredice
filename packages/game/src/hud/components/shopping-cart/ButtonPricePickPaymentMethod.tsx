import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";

export function ButtonPricePickPaymentMethod({ price, isSunflower, onChange }: { price: number | null | undefined, isSunflower: boolean, onChange?: (isSunflower: boolean) => void }) {
    function handleToggle() {
        onChange?.(!isSunflower);
    }

    if (price == null || price === undefined) {
        return <Typography level="body1">Nevaljan iznos</Typography>
    }

    const displayPrice = isSunflower ? price * 1000 : price

    return (
        <Row spacing={1} className="overflow-hidden px-0.5 py-1">
            {/* Price Display */}
            <Typography level="body1" semiBold>
                {displayPrice.toFixed(2)}
            </Typography>

            {/* Custom Switch */}
            <button
                onClick={handleToggle}
                className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2f6e40] focus:ring-offset-0 ${isSunflower ? "bg-yellow-200 dark:bg-yellow-400" : "bg-gray-300 dark:bg-slate-600"}`}
                role="switch"
                aria-checked={isSunflower}
            >
                <span className={`size-5 transform rounded-full bg-white text-black shadow-lg transition-transform flex items-center justify-center text-md font-medium ${isSunflower ? "translate-x-5" : "translate-x-0.5"}`}>
                    {isSunflower ? "🌻" : "€"}
                </span>
            </button>
        </Row>
    )
}
