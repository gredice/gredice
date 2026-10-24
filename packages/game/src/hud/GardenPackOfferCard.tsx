import type { BlockData, GardenPackCatalogueOffer } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import Image from 'next/image';
import { getAutumnArrangementPreviewUrl } from '../arrangements/autumnArrangements';
import { useGameState } from '../useGameState';
import { GardenPackOfferContents } from './GardenPackOfferContents';
import {
    getGardenPackComparison,
    getReviewedGardenPackPreview,
} from './gardenPackStorefrontProjection';

export function GardenPackOfferCard({
    offer,
    blockData,
    onReview,
}: {
    offer: GardenPackCatalogueOffer;
    blockData: BlockData[] | null | undefined;
    onReview: () => void;
}) {
    const appBaseUrl = useGameState((state) => state.appBaseUrl);
    const name =
        offer.name.hr ?? Object.values(offer.name)[0] ?? 'Paket za vrt';
    const description =
        offer.description.hr ?? Object.values(offer.description)[0];
    const preview = getReviewedGardenPackPreview(offer);
    const comparison = getGardenPackComparison(offer);
    return (
        <article
            className="min-w-0 border-b pb-4 space-y-3"
            data-pack-offer={offer.productId}
        >
            <h3 className="font-semibold text-lg break-words">{name}</h3>
            {preview && (
                <figure className="space-y-2">
                    <Image
                        src={getAutumnArrangementPreviewUrl(
                            preview.arrangement,
                            appBaseUrl,
                        )}
                        width={780}
                        height={600}
                        unoptimized
                        alt={`Prijedlog uređenja: ${name}`}
                        className="w-full h-auto rounded"
                    />
                    <figcaption className="text-sm text-muted-foreground">
                        Okolina nije dio paketa:{' '}
                        {preview.scenery
                            .map(
                                (item) =>
                                    `${item.quantity} × ${blockData?.find((block) => block.information.name === item.entityName)?.information.label ?? { Block_Grass: 'trava', Tree: 'drvo', Pine: 'bor', StoneWalkway: 'kamena staza' }[item.entityName] ?? item.entityName}`,
                            )
                            .join(', ')}
                        .
                    </figcaption>
                </figure>
            )}
            {description && (
                <p className="text-sm break-words">{description}</p>
            )}
            <p className="font-semibold">
                Paket: {offer.quote.chargedSunflowers} suncokreta
            </p>
            {comparison && (
                <p className="text-sm text-muted-foreground">
                    Isti predmeti pojedinačno: {comparison.total} suncokreta.
                    {comparison.saving > 0
                        ? ` Razlika: ${comparison.saving} suncokreta manje za paket.`
                        : ''}
                </p>
            )}
            {!offer.available && (
                <p role="status">
                    {offer.unavailableReason === 'expired'
                        ? 'Ponuda je završila.'
                        : offer.unavailableReason === 'scheduled'
                          ? 'Ponuda još nije počela.'
                          : 'Paket trenutačno nije dostupan.'}
                </p>
            )}
            <details>
                <summary className="cursor-pointer rounded py-2 focus-visible:outline-2">
                    Sadržaj i pojedinačni predmeti
                </summary>
                <GardenPackOfferContents
                    offer={offer}
                    blockData={blockData}
                    individualItems
                />
            </details>
            <Button
                disabled={!offer.available}
                size="sm"
                onClick={onReview}
                aria-label={`Pregledaj kupnju: ${name}`}
            >
                Pregledaj kupnju
            </Button>
        </article>
    );
}
