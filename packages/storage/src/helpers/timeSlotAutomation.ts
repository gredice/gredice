import 'server-only';
import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import { DeliveryModes, TimeSlotStatuses, timeSlots } from '../schema';
import { storage } from '../storage';

export const AUTO_CLOSE_WINDOW_HOURS = 48;
export const AUTO_CLOSE_WINDOW_MS = AUTO_CLOSE_WINDOW_HOURS * 60 * 60 * 1000;

function getAutoCloseThreshold(referenceDate: Date) {
    return new Date(referenceDate.getTime() + AUTO_CLOSE_WINDOW_MS);
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
                inArray(timeSlots.type, [DeliveryModes.DELIVERY, DeliveryModes.PICKUP]),
                eq(timeSlots.status, TimeSlotStatuses.SCHEDULED),
                gte(timeSlots.startAt, now),
                lt(timeSlots.startAt, cutoffTime),
            ),
        );
}
