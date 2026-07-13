export function formatDeliveryDateTime(value: string | null) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('hr-HR', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Zagreb',
    }).format(new Date(value));
}

export function formatDeliveryTime(value: string | null) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('hr-HR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Zagreb',
    }).format(new Date(value));
}

export function formatTravelDuration(value: number | null) {
    if (value === null) return '—';
    const minutes = Math.max(1, Math.round(value / 60));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatDistance(value: number | null) {
    if (value === null) return '—';
    return value < 1_000
        ? `${value} m`
        : `${(value / 1_000).toLocaleString('hr-HR', {
              maximumFractionDigits: 1,
          })} km`;
}
