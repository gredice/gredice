export function formatPrice(price?: number | null): string {
    if (price === null || price === undefined) {
        return 'Nepoznato';
    }
    return `${price.toFixed(2)}€`;
}
