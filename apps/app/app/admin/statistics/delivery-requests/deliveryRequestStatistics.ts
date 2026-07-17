const deliveryStatisticsTimeZone = 'Europe/Zagreb';

const weekdayOrder = [
    { key: 'Mon', label: 'Pon' },
    { key: 'Tue', label: 'Uto' },
    { key: 'Wed', label: 'Sri' },
    { key: 'Thu', label: 'Čet' },
    { key: 'Fri', label: 'Pet' },
    { key: 'Sat', label: 'Sub' },
    { key: 'Sun', label: 'Ned' },
] as const;

const stateOrder = [
    { key: 'pending', label: 'Na čekanju' },
    { key: 'confirmed', label: 'Potvrđeno' },
    { key: 'preparing', label: 'U pripremi' },
    { key: 'ready', label: 'Spremno' },
    { key: 'fulfilled', label: 'Ispunjeno' },
    { key: 'deferred', label: 'Odgođeno' },
    { key: 'failed', label: 'Neuspjelo' },
    { key: 'cancelled', label: 'Otkazano' },
] as const;

type DeliveryStatisticsRequest = {
    id: string;
    state: string;
    mode?: 'delivery' | 'pickup';
    createdAt: Date;
    slot?: {
        id: number;
        startAt: Date;
        endAt: Date;
        location?: {
            name: string;
        };
    };
};

export type DeliveryRequestStatistics = ReturnType<
    typeof buildDeliveryRequestStatistics
>;

const weekdayKeyFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: deliveryStatisticsTimeZone,
});

const slotDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: deliveryStatisticsTimeZone,
});

const timeFormatter = new Intl.DateTimeFormat('hr-HR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: deliveryStatisticsTimeZone,
});

const monthKeyFormatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: deliveryStatisticsTimeZone,
});

const monthLabelFormatter = new Intl.DateTimeFormat('hr-HR', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
});

function countByKey<T>(items: T[], getKey: (item: T) => string) {
    const counts = new Map<string, number>();

    for (const item of items) {
        const key = getKey(item);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return counts;
}

function getMonthKey(date: Date) {
    const parts = monthKeyFormatter.formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    return `${year}-${month}`;
}

function formatMonthLabel(monthKey: string) {
    const [year, month] = monthKey.split('-').map(Number);
    return monthLabelFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
}

function listMonthKeys(firstMonthKey: string, lastMonthKey: string) {
    const [firstYear, firstMonth] = firstMonthKey.split('-').map(Number);
    const [lastYear, lastMonth] = lastMonthKey.split('-').map(Number);
    const monthKeys: string[] = [];

    let year = firstYear;
    let month = firstMonth;

    while (year < lastYear || (year === lastYear && month <= lastMonth)) {
        monthKeys.push(`${year}-${String(month).padStart(2, '0')}`);
        month += 1;

        if (month > 12) {
            year += 1;
            month = 1;
        }
    }

    return monthKeys;
}

function formatTimeWindow(startAt: Date, endAt: Date) {
    return `${timeFormatter.format(startAt)}–${timeFormatter.format(endAt)}`;
}

function formatSlotLabel(request: DeliveryStatisticsRequest) {
    const slot = request.slot;
    if (!slot) return '';

    const location = slot.location?.name.trim();
    const dateAndTime = `${slotDateFormatter.format(slot.startAt)} · ${formatTimeWindow(slot.startAt, slot.endAt)}`;
    return location ? `${dateAndTime} · ${location}` : dateAndTime;
}

export function buildDeliveryRequestStatistics(
    requests: DeliveryStatisticsRequest[],
) {
    const requestsWithSlots = requests.filter(
        (
            request,
        ): request is DeliveryStatisticsRequest & {
            slot: NonNullable<DeliveryStatisticsRequest['slot']>;
        } => Boolean(request.slot),
    );
    const slotCounts = new Map<
        number,
        { id: number; label: string; shortLabel: string; count: number }
    >();

    for (const request of requestsWithSlots) {
        const existing = slotCounts.get(request.slot.id);
        if (existing) {
            existing.count += 1;
            continue;
        }

        const label = formatSlotLabel(request);

        slotCounts.set(request.slot.id, {
            id: request.slot.id,
            label,
            shortLabel: label,
            count: 1,
        });
    }

    const popularSlots = Array.from(slotCounts.values())
        .sort(
            (left, right) =>
                right.count - left.count ||
                left.label.localeCompare(right.label, 'hr-HR'),
        )
        .slice(0, 8);
    const weekdayCounts = countByKey(requestsWithSlots, (request) =>
        weekdayKeyFormatter.format(request.slot.startAt),
    );
    const timeWindowCounts = countByKey(requestsWithSlots, (request) =>
        formatTimeWindow(request.slot.startAt, request.slot.endAt),
    );
    const stateCounts = countByKey(requests, (request) => request.state);
    const trendCounts = countByKey(requests, (request) =>
        getMonthKey(request.createdAt),
    );
    const fulfilledRequests = stateCounts.get('fulfilled') ?? 0;
    const cancelledRequests = stateCounts.get('cancelled') ?? 0;
    const totalRequests = requests.length;
    const observedTrendMonths = Array.from(trendCounts.keys()).sort(
        (left, right) => left.localeCompare(right),
    );
    const firstTrendMonth = observedTrendMonths[0];
    const lastTrendMonth = observedTrendMonths.at(-1);
    const trendMonths =
        firstTrendMonth && lastTrendMonth
            ? listMonthKeys(firstTrendMonth, lastTrendMonth)
            : [];

    return {
        summary: {
            totalRequests,
            assignedRequests: requestsWithSlots.length,
            uniqueSlots: slotCounts.size,
            fulfilledRequests,
            cancelledRequests,
            completionRate:
                totalRequests === 0
                    ? 0
                    : Math.round((fulfilledRequests / totalRequests) * 100),
            cancellationRate:
                totalRequests === 0
                    ? 0
                    : Math.round((cancelledRequests / totalRequests) * 100),
            mostPopularSlot: popularSlots[0] ?? null,
        },
        popularSlots,
        weekdays: weekdayOrder.map(({ key, label }) => ({
            label,
            count: weekdayCounts.get(key) ?? 0,
        })),
        timeWindows: Array.from(timeWindowCounts, ([label, count]) => ({
            label,
            count,
        })).sort(
            (left, right) =>
                right.count - left.count ||
                left.label.localeCompare(right.label),
        ),
        states: stateOrder
            .map(({ key, label }) => ({
                label,
                count: stateCounts.get(key) ?? 0,
            }))
            .filter((item) => item.count > 0),
        modes: [
            {
                label: 'Dostava',
                count: requests.filter((request) => request.mode === 'delivery')
                    .length,
            },
            {
                label: 'Preuzimanje',
                count: requests.filter((request) => request.mode === 'pickup')
                    .length,
            },
            {
                label: 'Nije određeno',
                count: requests.filter((request) => !request.mode).length,
            },
        ].filter((item) => item.count > 0),
        trend: trendMonths.map((month) => ({
            month,
            label: formatMonthLabel(month),
            count: trendCounts.get(month) ?? 0,
        })),
    };
}
