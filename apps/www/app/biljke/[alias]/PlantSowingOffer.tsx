import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { formatPrice } from '../../../lib/formatPrice';
import { KnownPages } from '../../../src/KnownPages';
import {
    type PlantSowingOfferData,
    plantSowingOfferElementId,
} from './plantSowingOfferData';

/** Price and the way into the garden, together, right under the plant's title. */
export function PlantSowingOffer({
    href,
    price,
    availableForSowing,
}: PlantSowingOfferData) {
    const availabilityNote = availableForSowing ? null : (
        <Typography
            level="body2"
            className="font-semibold text-amber-800 dark:text-amber-300"
        >
            Trenutno nije dostupna za sjetvu
        </Typography>
    );

    if (price === null) {
        return (
            <div
                id={plantSowingOfferElementId}
                className="flex flex-col items-start gap-2"
            >
                {availabilityNote}
                <NavigatingButton href={href} color="brand">
                    Posadi u svoj vrt
                </NavigatingButton>
            </div>
        );
    }

    return (
        <div
            id={plantSowingOfferElementId}
            className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-b-4 border-tertiary bg-card p-4"
        >
            <div>
                <Typography level="body2" secondary>
                    Cijena sijanja, po biljci
                </Typography>
                <p className="text-3xl font-semibold tabular-nums leading-tight">
                    {formatPrice(price)}
                </p>
            </div>
            {availabilityNote}
            <NavigatingButton
                href={href}
                color="brand"
                size="lg"
                className="w-full justify-center"
            >
                Posadi u svoj vrt
            </NavigatingButton>
            <Typography level="body3" secondary>
                Cijena uključuje sjeme, pripremu tla, sjetvu i sezonske
                pogodnosti.{' '}
                <Link className="underline" href={KnownPages.Sowing}>
                    Više o sjetvi
                </Link>
            </Typography>
            <Typography level="body3" secondary>
                Usluga ili proizvod nisu ispunili očekivanja? Pogledaj{' '}
                <Link className="underline" href={KnownPages.Refunds}>
                    30-dnevnu politiku povrata novca
                </Link>
                .
            </Typography>
        </div>
    );
}
