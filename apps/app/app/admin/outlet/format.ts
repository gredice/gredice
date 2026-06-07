import type {
    OutletOfferReservationStatus,
    OutletOfferStatus,
} from '@gredice/storage';

export const outletOfferStatusLabels = {
    draft: 'Skica',
    published: 'Objavljeno',
    paused: 'Pauzirano',
    closed: 'Zatvoreno',
} satisfies Record<OutletOfferStatus, string>;

export const outletReservationStatusLabels = {
    held: 'Rezervirano',
    released: 'Otpušteno',
    converted: 'Plaćeno',
} satisfies Record<OutletOfferReservationStatus, string>;

const dateTimeFormatter = new Intl.DateTimeFormat('hr-HR', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

const dateFormatter = new Intl.DateTimeFormat('hr-HR', {
    dateStyle: 'medium',
});

const currencyFormatter = new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency: 'EUR',
});

export function formatDateTime(date: Date) {
    return dateTimeFormatter.format(date);
}

export function formatDate(date: Date) {
    return dateFormatter.format(date);
}

export function formatPrice(cents: number | null | undefined) {
    if (typeof cents !== 'number') {
        return '-';
    }

    return currencyFormatter.format(cents / 100);
}

export function formatDateTimeInputValue(date: Date) {
    return date.toISOString().slice(0, 16);
}

export function formatDateInputValue(date: Date) {
    return date.toISOString().slice(0, 10);
}
