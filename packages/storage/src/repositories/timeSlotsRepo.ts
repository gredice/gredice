import 'server-only';
import { and, eq, gte, lte, desc, asc, sql } from "drizzle-orm";
import { storage } from "../storage";
import {
    timeSlots,
    InsertTimeSlot,
    UpdateTimeSlot,
    SelectTimeSlot,
    TimeSlotStatuses,
    DeliveryModes
} from "../schema";

// Get available slots for booking (scheduled status, future dates)
export function getAvailableTimeSlots(
    type?: 'delivery' | 'pickup',
    locationId?: number,
    fromDate?: Date,
    toDate?: Date
): Promise<(SelectTimeSlot & { availableCount?: number })[]> {
    const conditions = [
        eq(timeSlots.status, TimeSlotStatuses.SCHEDULED),
        gte(timeSlots.startAt, fromDate || new Date())
    ];

    if (type) {
        conditions.push(eq(timeSlots.type, type));
    }

    if (locationId) {
        conditions.push(eq(timeSlots.locationId, locationId));
    }

    if (toDate) {
        conditions.push(lte(timeSlots.startAt, toDate));
    }

    return storage().query.timeSlots.findMany({
        where: and(...conditions),
        orderBy: [asc(timeSlots.startAt)],
        with: {
            location: true
        }
    });
}

// Get all slots for admin view
export function getAllTimeSlots(
    type?: 'delivery' | 'pickup',
    locationId?: number,
    status?: string
): Promise<SelectTimeSlot[]> {
    const conditions = [];

    if (type) {
        conditions.push(eq(timeSlots.type, type));
    }

    if (locationId) {
        conditions.push(eq(timeSlots.locationId, locationId));
    }

    if (status) {
        conditions.push(eq(timeSlots.status, status));
    }

    return storage().query.timeSlots.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(timeSlots.startAt)],
        with: {
            location: true
        }
    });
}

// Get a specific time slot by ID
export function getTimeSlot(slotId: number): Promise<SelectTimeSlot | undefined> {
    return storage().query.timeSlots.findFirst({
        where: eq(timeSlots.id, slotId),
        with: {
            location: true,
            // Note: deliveryRequests relationship removed due to event sourcing refactor
        }
    });
}

// Create a new time slot
export async function createTimeSlot(data: InsertTimeSlot): Promise<number> {
    // Validate that endAt = startAt + 2h
    const startAt = new Date(data.startAt);
    const expectedEndAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000); // +2 hours

    if (data.endAt.getTime() !== expectedEndAt.getTime()) {
        throw new Error('End time must be exactly 2 hours after start time');
    }

    // Validate that start time aligns to hour boundary
    if (startAt.getMinutes() !== 0 || startAt.getSeconds() !== 0) {
        throw new Error('Start time must align to hour boundary (00:00)');
    }

    // Check for overlapping slots
    const existingSlot = await storage().query.timeSlots.findFirst({
        where: and(
            eq(timeSlots.locationId, data.locationId),
            eq(timeSlots.type, data.type),
            eq(timeSlots.startAt, data.startAt)
        )
    });

    if (existingSlot) {
        throw new Error('Slot already exists for this location, type, and time');
    }

    const result = await storage()
        .insert(timeSlots)
        .values(data)
        .returning({ id: timeSlots.id });

    if (!result[0]?.id) {
        throw new Error('Failed to create time slot');
    }

    return result[0].id;
}

// Update a time slot
export async function updateTimeSlot(update: UpdateTimeSlot): Promise<void> {
    const result = await storage()
        .update(timeSlots)
        .set(update)
        .where(eq(timeSlots.id, update.id))
        .returning({ id: timeSlots.id });

    if (!result[0]?.id) {
        throw new Error('Failed to update time slot - slot not found');
    }
}

// Close a time slot (prevents new bookings)
export async function closeTimeSlot(slotId: number): Promise<void> {
    await updateTimeSlot({ id: slotId, status: TimeSlotStatuses.CLOSED });
}

// Archive old time slots
export async function archiveTimeSlot(slotId: number): Promise<void> {
    await updateTimeSlot({ id: slotId, status: TimeSlotStatuses.ARCHIVED });
}

// Bulk generate time slots
export interface BulkSlotCreationParams {
    startDate: Date;
    daysAhead: number;
    windows: string[]; // Array of time strings like ['08:00', '10:00', '12:00']
    type: 'delivery' | 'pickup';
    locationId: number;
}

export async function bulkGenerateTimeSlots(params: BulkSlotCreationParams): Promise<{ created: number; skippedExisting: number }> {
    const { startDate, daysAhead, windows, type, locationId } = params;

    let created = 0;
    let skippedExisting = 0;

    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + dayOffset);

        for (const window of windows) {
            const [hours, minutes] = window.split(':').map(Number);

            const startAt = new Date(currentDate);
            startAt.setHours(hours, minutes || 0, 0, 0);

            const endAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000); // +2 hours

            try {
                await createTimeSlot({
                    locationId,
                    type,
                    startAt,
                    endAt,
                    status: TimeSlotStatuses.SCHEDULED
                });
                created++;
            } catch (error) {
                // If slot already exists, skip it
                if (error instanceof Error && error.message.includes('already exists')) {
                    skippedExisting++;
                } else {
                    throw error; // Re-throw other errors
                }
            }
        }
    }

    return { created, skippedExisting };
}

// Unified function for API - get time slots with filters
export interface GetTimeSlotsParams {
    type?: 'delivery' | 'pickup';
    locationId?: number;
    fromDate?: Date;
    toDate?: Date;
    status?: string;
}

export function getTimeSlots(params: GetTimeSlotsParams = {}): Promise<SelectTimeSlot[]> {
    const { type, locationId, fromDate, toDate, status = TimeSlotStatuses.SCHEDULED } = params;

    const conditions = [
        eq(timeSlots.status, status)
    ];

    if (type) {
        conditions.push(eq(timeSlots.type, type));
    }

    if (locationId) {
        conditions.push(eq(timeSlots.locationId, locationId));
    }

    if (fromDate) {
        conditions.push(gte(timeSlots.startAt, fromDate));
    }

    if (toDate) {
        conditions.push(lte(timeSlots.startAt, toDate));
    }

    return storage().query.timeSlots.findMany({
        where: and(...conditions),
        orderBy: [asc(timeSlots.startAt)],
        with: {
            location: true
        }
    });
}

// Archive past slots (helper for cleanup)
export async function archivePastSlots(): Promise<number> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    const result = await storage()
        .update(timeSlots)
        .set({ status: TimeSlotStatuses.ARCHIVED })
        .where(and(
            lte(timeSlots.endAt, yesterday),
            eq(timeSlots.status, TimeSlotStatuses.SCHEDULED)
        ))
        .returning({ id: timeSlots.id });

    return result.length;
}
