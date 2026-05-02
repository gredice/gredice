import { Error as ErrorIcon, Warning } from '@signalco/ui-icons';

export function InventoryQuantityValue({
    quantity,
    lowCountThreshold,
}: {
    quantity: number;
    lowCountThreshold: number | null;
}) {
    const isEmpty = quantity === 0;
    const isLow =
        !isEmpty && lowCountThreshold !== null && quantity <= lowCountThreshold;

    return (
        <span className="inline-flex items-center gap-1.5">
            <span>{quantity}</span>
            {isEmpty && (
                <ErrorIcon
                    className="size-4 text-red-500"
                    aria-label="Prazna zaliha"
                />
            )}
            {isLow && (
                <Warning
                    className="size-4 text-amber-500"
                    aria-label="Niska zaliha"
                />
            )}
        </span>
    );
}
