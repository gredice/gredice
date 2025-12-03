import type { ChipProps } from '@signalco/ui-primitives/Chip';

export function getDeliveryRequestStatusColor(
    status: string,
): ChipProps['color'] {
    switch (status) {
        case 'pending':
            return 'error';
        case 'confirmed':
        case 'preparing':
            return 'warning';
        case 'ready':
            return 'info';
        case 'fulfilled':
            return 'success';
        case 'cancelled':
            return 'neutral';
        default:
            return 'neutral';
    }
}

export function getDeliveryRequestStatusLabel(status: string) {
    switch (status) {
        case 'pending':
            return '❓ Na čekanju';
        case 'confirmed':
            return '📆 Potvrđen';
        case 'preparing':
            return '⌛ U pripremi';
        case 'ready':
            return '🛍️ Spreman';
        case 'fulfilled':
            return '✅ Ispunjen';
        case 'cancelled':
            return '❌ Otkazan';
        default:
            return status;
    }
}

export function getDeliveryRequestModeLabel(mode: string | null | undefined) {
    switch (mode) {
        case 'delivery':
            return '🛻 Dostava';
        case 'pickup':
            return '🚶 Preuzimanje';
        default:
            return mode || '-';
    }
}
