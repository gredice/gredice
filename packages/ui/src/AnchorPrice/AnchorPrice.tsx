import {
    type AnchorPrice as AnchorPriceData,
    anchorPriceLabel,
} from '@gredice/js/pricing';

export function AnchorPrice({
    currentPrice,
    anchor,
}: {
    currentPrice: number;
    anchor: AnchorPriceData | null | undefined;
}) {
    const label = anchorPriceLabel(currentPrice, anchor);
    return label ? (
        <span className="block text-xs font-normal text-muted-foreground">
            {label}
        </span>
    ) : null;
}
