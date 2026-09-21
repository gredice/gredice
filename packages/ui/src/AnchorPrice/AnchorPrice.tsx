import {
    type AnchorPrice as AnchorPriceData,
    anchorPriceLabel,
} from '@gredice/js/pricing';

export function AnchorPrice({
    currentPrice,
    anchor,
    showUnchanged = false,
}: {
    currentPrice: number;
    anchor: AnchorPriceData | null | undefined;
    showUnchanged?: boolean;
}) {
    const label = anchorPriceLabel(currentPrice, anchor, { showUnchanged });
    return label ? (
        <span className="block text-xs font-normal text-muted-foreground">
            {label}
        </span>
    ) : null;
}
