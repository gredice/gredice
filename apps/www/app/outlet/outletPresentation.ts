import type { OutletOffer } from './outletData';

export const currencyFormatter = new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency: 'EUR',
});

export const compactDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'short',
});

export const longDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

export const offerEndFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
});

export function outletDiscountPercentage(offer: OutletOffer) {
    if (
        typeof offer.comparePrice !== 'number' ||
        offer.comparePrice <= offer.outletPrice
    ) {
        return null;
    }

    return Math.round(
        ((offer.comparePrice - offer.outletPrice) / offer.comparePrice) * 100,
    );
}

export function outletDiscountLabel(offer: OutletOffer) {
    const percentage = outletDiscountPercentage(offer);

    return percentage ? `Uštedi ${percentage}%` : 'Outlet cijena';
}

export function outletRemainingLabel(offer: OutletOffer) {
    return offer.remainingQuantity === 1
        ? 'Samo 1 preostala'
        : `preostalo ${offer.remainingQuantity}`;
}
