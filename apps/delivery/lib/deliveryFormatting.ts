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

function deliveryTimestamp(value: string | null) {
    if (!value) return null;
    const time = Date.parse(value);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
        return null;
    }
    return { value, time };
}

export function deliveryPromiseWindow(
    startAt: string | null,
    endAt: string | null,
) {
    const start = deliveryTimestamp(startAt);
    const end = deliveryTimestamp(endAt);
    if (!start || !end || start.time >= end.time) return null;
    return { startAt: start.value, endAt: end.value };
}

function deliveryDay(value: string) {
    return new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Europe/Zagreb',
    }).format(new Date(value));
}

export function formatDeliveryDateTimeRange(
    startAt: string | null,
    endAt: string | null,
    referenceAt: string | null = null,
) {
    const range = deliveryPromiseWindow(startAt, endAt);
    if (!range) return null;
    const reference = deliveryTimestamp(referenceAt);
    const startIncludesDate =
        !reference ||
        deliveryDay(range.startAt) !== deliveryDay(reference.value);
    const endIncludesDate =
        deliveryDay(range.startAt) !== deliveryDay(range.endAt);
    return {
        ...range,
        startLabel: startIncludesDate
            ? formatDeliveryDateTime(range.startAt)
            : formatDeliveryTime(range.startAt),
        endLabel: endIncludesDate
            ? formatDeliveryDateTime(range.endAt)
            : formatDeliveryTime(range.endAt),
    };
}

export function formatTravelDuration(value: number | null) {
    if (value === null) return '—';
    const minutes = Math.max(1, Math.round(value / 60));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatDeliveryDurationRange(
    minimumSeconds: number | null,
    maximumSeconds: number | null,
) {
    if (minimumSeconds === null || maximumSeconds === null) return null;
    const minimum = Math.max(0, Math.round(minimumSeconds / 60));
    const maximum = Math.max(minimum, Math.round(maximumSeconds / 60));
    const formatMinutes = (minutes: number) => {
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        return rest ? `${hours} h ${rest} min` : `${hours} h`;
    };

    if (maximum === 0) return 'uskoro';
    if (minimum === 0) return `do ${formatMinutes(maximum)}`;
    if (minimum === maximum) return `oko ${formatMinutes(maximum)}`;
    return `${formatMinutes(minimum)} – ${formatMinutes(maximum)}`;
}

export function formatDistance(value: number | null) {
    if (value === null) return '—';
    return value < 1_000
        ? `${value} m`
        : `${(value / 1_000).toLocaleString('hr-HR', {
              maximumFractionDigits: 1,
          })} km`;
}
