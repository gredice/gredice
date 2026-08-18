export const DELIVERY_TIME_ZONE = 'Europe/Zagreb';

function toDate(value: Date | string) {
    return typeof value === 'string' ? new Date(value) : value;
}

export function formatDeliveryDate(
    value: Date | string,
    options: Intl.DateTimeFormatOptions,
) {
    return new Intl.DateTimeFormat('hr-HR', {
        ...options,
        timeZone: DELIVERY_TIME_ZONE,
    }).format(toDate(value));
}

export function formatDeliveryTime(value: Date | string) {
    return formatDeliveryDate(value, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}
