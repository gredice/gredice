import { GameDeliveryIcon, GameLocationIcon } from '@gredice/ui/GameIcons';
import { type NextOpenSlot, NextOpenSlotItem } from './NextOpenSlotItem';

/** The first bookable delivery and pickup slot, shown above the full schedule. */
export function NextOpenSlots({
    delivery,
    pickup,
}: {
    delivery: NextOpenSlot | null;
    pickup: NextOpenSlot | null;
}) {
    if (!delivery && !pickup) {
        return null;
    }

    return (
        <section aria-labelledby="sljedeci-slobodan-termin">
            <h3
                id="sljedeci-slobodan-termin"
                className="mb-2 text-lg font-semibold"
            >
                Sljedeći slobodan termin
            </h3>
            <dl className="grid gap-3 sm:grid-cols-2">
                {delivery ? (
                    <NextOpenSlotItem
                        icon={
                            <GameDeliveryIcon
                                aria-hidden
                                className="size-5 shrink-0"
                            />
                        }
                        label="Dostava na adresu"
                        slot={delivery}
                    />
                ) : null}
                {pickup ? (
                    <NextOpenSlotItem
                        icon={
                            <GameLocationIcon
                                aria-hidden
                                className="size-5 shrink-0"
                            />
                        }
                        label="Osobno preuzimanje"
                        slot={pickup}
                        showLocation
                    />
                ) : null}
            </dl>
        </section>
    );
}
