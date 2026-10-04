import 'server-only';
import { and, eq, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm';
import {
    DeliveryModes,
    type SelectTimeSlot,
    TimeSlotStatuses,
    timeSlots,
} from '../schema';
import { storage } from '../storage';

export const AUTO_CLOSE_WINDOW_HOURS = 48;
export const AUTO_CLOSE_WINDOW_MS = AUTO_CLOSE_WINDOW_HOURS * 60 * 60 * 1000;

function getAutoCloseThreshold(referenceDate: Date) {
    return new Date(referenceDate.getTime() + AUTO_CLOSE_WINDOW_MS);
}

export function getDefaultTimeSlotClosesAt(startAt: Date) {
    return new Date(startAt.getTime() - AUTO_CLOSE_WINDOW_MS);
}

export function getTimeSlotEffectiveClosesAt(
    slot: Pick<SelectTimeSlot, 'closesAt' | 'startAt'>,
) {
    return slot.closesAt ?? getDefaultTimeSlotClosesAt(slot.startAt);
}

export function assertTimeSlotClosesBeforeStart(
    slot: Pick<SelectTimeSlot, 'closesAt' | 'startAt'>,
) {
    if (slot.closesAt && slot.closesAt.getTime() >= slot.startAt.getTime()) {
        throw new Error('Close time must be before slot start time');
    }
}

export function hasTimeSlotCloseDeadlinePassed(
    slot: Pick<SelectTimeSlot, 'closesAt' | 'startAt'>,
    referenceDate = new Date(),
) {
    const closeAt = getTimeSlotEffectiveClosesAt(slot);

    if (slot.closesAt) {
        return closeAt.getTime() <= referenceDate.getTime();
    }

    return closeAt.getTime() < referenceDate.getTime();
}

/**
 * Automatically closes upcoming delivery and pickup slots that are within the auto-close window.
 * This function should be called by a CRON job rather than during read operations.
 */
export async function autoCloseUpcomingSlots(
    referenceDate = new Date(),
): Promise<void> {
    const now = referenceDate;
    const cutoffTime = getAutoCloseThreshold(now);

    await storage()
        .update(timeSlots)
        .set({ status: TimeSlotStatuses.CLOSED })
        .where(
            and(
                inArray(timeSlots.type, [
                    DeliveryModes.DELIVERY,
                    DeliveryModes.PICKUP,
                ]),
                eq(timeSlots.status, TimeSlotStatuses.SCHEDULED),
                gte(timeSlots.startAt, now),
                or(
                    lte(timeSlots.closesAt, now),
                    and(
                        isNull(timeSlots.closesAt),
                        lt(timeSlots.startAt, cutoffTime),
                    ),
                ),
            ),
        );
}
