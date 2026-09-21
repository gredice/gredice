export type AnchorPrice = {
    price: number;
    date: string;
};

// NN 101/2026-1212: newly covered goods and services. Food retail keeps
// 2025-05-02; callers selling food must explicitly use that reference date.
export const serviceAnchorDate = '2026-09-10';
export const foodAnchorDate = '2025-05-02';

const priceFormatter = new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency: 'EUR',
});

export function anchorPriceLabel(
    currentPrice: number,
    anchor: AnchorPrice | null | undefined,
    { showUnchanged = false }: { showUnchanged?: boolean } = {},
) {
    if (
        !anchor ||
        !Number.isFinite(currentPrice) ||
        !Number.isFinite(anchor.price) ||
        currentPrice < 0 ||
        anchor.price < 0 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(anchor.date) ||
        Number.isNaN(Date.parse(anchor.date))
    ) {
        return null;
    }

    const [year, month, day] = anchor.date.split('-');
    const date = `${Number(day)}. ${Number(month)}. ${year}.`;
    const price = priceFormatter.format(anchor.price);
    return !showUnchanged && priceFormatter.format(currentPrice) === price
        ? null
        : `Cijena ${date}: ${price}`;
}
