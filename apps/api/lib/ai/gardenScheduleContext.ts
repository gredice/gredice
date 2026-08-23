import { tz } from '@date-fns/tz';
import {
    DeliveryModes,
    getTimeSlotEffectiveClosesAt,
    getTimeSlots,
    hasTimeSlotCloseDeadlinePassed,
} from '@gredice/storage';
import {
    formatGardenScheduleDateKey,
    GARDEN_SCHEDULE_TIME_ZONE,
} from './raisedBedPhotographySchedule';

export const DELIVERY_SLOT_CONTEXT_DAYS = 7;
const DELIVERY_SLOT_CONTEXT_LIMIT = 20;

function formatLocalTime(date: Date) {
    const localDate = tz(GARDEN_SCHEDULE_TIME_ZONE)(date);
    const hours = String(localDate.getHours()).padStart(2, '0');
    const minutes = String(localDate.getMinutes()).padStart(2, '0');

    return `${hours}:${minutes}`;
}

type DeliverySlotSource = {
    startAt: Date;
    endAt: Date;
    closesAt: Date | null;
};

export function buildDeliverySlotsContext(
    slots: DeliverySlotSource[],
    referenceDate = new Date(),
) {
    return slots
        .filter((slot) => !hasTimeSlotCloseDeadlinePassed(slot, referenceDate))
        .slice(0, DELIVERY_SLOT_CONTEXT_LIMIT)
        .map((slot) => ({
            date: formatGardenScheduleDateKey(
                tz(GARDEN_SCHEDULE_TIME_ZONE)(slot.startAt),
            ),
            from: formatLocalTime(slot.startAt),
            to: formatLocalTime(slot.endAt),
            orderDeadline: getTimeSlotEffectiveClosesAt(slot).toISOString(),
        }));
}

/**
 * Delivery windows a customer can still book in the next week. Harvest advice
 * uses them so a harvest recommendation lands on a real delivery date instead
 * of an open-ended suggestion.
 */
export async function getUpcomingDeliverySlotsContext(
    referenceDate = new Date(),
) {
    const toDate = new Date(
        referenceDate.getTime() +
            DELIVERY_SLOT_CONTEXT_DAYS * 24 * 60 * 60 * 1000,
    );
    const slots = await getTimeSlots({
        type: DeliveryModes.DELIVERY,
        fromDate: referenceDate,
        toDate,
    });

    return {
        windowDays: DELIVERY_SLOT_CONTEXT_DAYS,
        timeZone: GARDEN_SCHEDULE_TIME_ZONE,
        slots: buildDeliverySlotsContext(slots, referenceDate),
    };
}
