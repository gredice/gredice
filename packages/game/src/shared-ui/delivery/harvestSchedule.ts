export interface HarvestSchedulePlant {
    id?: number | string;
    label: string;
    maxHarvestDaysBeforeDelivery: number;
}

export interface HarvestScheduleItem {
    cartItemId: number;
    operationLabel: string;
    raisedBedLabel?: string | null;
    plants: readonly HarvestSchedulePlant[];
    scheduledDate: string | null;
    allowedFrom: string;
    allowedTo: string;
    valid: boolean;
    reason?: string | null;
    validationReason?: string | null;
}

export interface HarvestScheduleDateSelection {
    cartItemId: number;
    scheduledDate: string;
}

const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})/;

export function harvestCalendarDateKey(value: string | null | undefined) {
    if (typeof value !== 'string') {
        return null;
    }

    const match = calendarDatePattern.exec(value);
    if (!match) {
        return null;
    }

    const [, year, month, day] = match;
    const date = new Date(`${year}-${month}-${day}T12:00:00.000Z`);

    if (
        Number.isNaN(date.getTime()) ||
        date.getUTCFullYear() !== Number(year) ||
        date.getUTCMonth() + 1 !== Number(month) ||
        date.getUTCDate() !== Number(day)
    ) {
        return null;
    }

    return `${year}-${month}-${day}`;
}

export function isHarvestDateWithinRange(
    scheduledDate: string,
    item: Pick<HarvestScheduleItem, 'allowedFrom' | 'allowedTo'>,
) {
    const dateKey = harvestCalendarDateKey(scheduledDate);
    const allowedFrom = harvestCalendarDateKey(item.allowedFrom);
    const allowedTo = harvestCalendarDateKey(item.allowedTo);

    return Boolean(
        dateKey &&
            allowedFrom &&
            allowedTo &&
            allowedFrom <= allowedTo &&
            dateKey >= allowedFrom &&
            dateKey <= allowedTo,
    );
}

export function getSuggestedHarvestDate(
    scheduledDate: string | null | undefined,
    item: Pick<HarvestScheduleItem, 'allowedFrom' | 'allowedTo'>,
) {
    const dateKey = harvestCalendarDateKey(scheduledDate);
    const allowedFrom = harvestCalendarDateKey(item.allowedFrom);
    const allowedTo = harvestCalendarDateKey(item.allowedTo);

    if (!allowedFrom || !allowedTo || allowedFrom > allowedTo) {
        return null;
    }

    if (!dateKey) {
        return allowedTo;
    }

    if (dateKey < allowedFrom) {
        return allowedFrom;
    }

    if (dateKey > allowedTo) {
        return allowedTo;
    }

    return dateKey;
}

export function createHarvestScheduleDateSelections(
    items: readonly HarvestScheduleItem[],
): HarvestScheduleDateSelection[] {
    return items.map((item) => {
        const scheduledDate = harvestCalendarDateKey(item.scheduledDate);
        const allowedFrom = harvestCalendarDateKey(item.allowedFrom);
        const allowedTo = harvestCalendarDateKey(item.allowedTo);
        const fixedToDeliveryDate =
            allowedFrom !== null && allowedFrom === allowedTo;

        return {
            cartItemId: item.cartItemId,
            scheduledDate:
                item.valid &&
                scheduledDate &&
                isHarvestDateWithinRange(scheduledDate, item)
                    ? scheduledDate
                    : fixedToDeliveryDate
                      ? (allowedTo ?? '')
                      : (scheduledDate ?? ''),
        };
    });
}
