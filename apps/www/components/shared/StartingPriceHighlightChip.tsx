import { Euro } from '@gredice/ui/icons';
import { getLandingPricing } from '../../app/getLandingPricing';
import { formatPrice } from '../../lib/formatPrice';
import { HighlightChip, type HighlightChipHref } from './HighlightChip';

/** Live "from" price chip, read from the same rows as the public price list. */
export async function StartingPriceHighlightChip({
    kind,
    href,
}: {
    kind: 'planting' | 'operation';
    href?: HighlightChipHref;
}) {
    const pricing = await getLandingPricing();
    const price =
        kind === 'planting'
            ? pricing?.minPlantPrice
            : pricing?.cheapestOperation?.price;
    if (typeof price !== 'number') {
        return null;
    }

    return (
        <HighlightChip href={href} icon={<Euro aria-hidden />}>
            {kind === 'planting' ? 'Sadnja već od' : 'Radnje već od'}{' '}
            {formatPrice(price)}
        </HighlightChip>
    );
}
