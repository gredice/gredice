'use server';

import {
    archiveTimeSlot,
    type BulkSlotCreationParams,
    bulkGenerateTimeSlots,
    closeTimeSlot,
    createTimeSlot,
    TimeSlotStatuses,
    updateTimeSlot,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../../../lib/auth/auth';

export async function createTimeSlotAction(
    _prevState: unknown,
    formData: FormData,
) {
    try {
        await auth(['admin']);

        const locationId = parseInt(formData.get('locationId') as string, 10);
        const type = formData.get('type') as 'delivery' | 'pickup';
        const startDateString = formData.get('startDate') as string;
        const startTime = formData.get('startTime') as string;

        // Parse date in local timezone to avoid UTC offset issues
        const [year, month, day] = startDateString.split('-').map(Number);
        const [hours, minutes] = startTime.split(':').map(Number);
        const startAt = new Date(
            year,
            month - 1,
            day,
            hours,
            minutes || 0,
            0,
            0,
        ); // Month is 0-indexed
        const endAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000); // +2 hours

        await createTimeSlot({
            locationId,
            type,
            startAt,
            endAt,
            status: TimeSlotStatuses.SCHEDULED,
        });

        revalidatePath('/admin/delivery/slots');
        return { success: true, message: 'Slot je uspješno kreiran' };
    } catch (error) {
        console.error('Failed to create time slot:', error);
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Greška pri kreiranju slota',
        };
    }
}

export async function bulkGenerateSlotsAction(
    _prevState: unknown,
    formData: FormData,
) {
    try {
        await auth(['admin']);

        const locationId = parseInt(formData.get('locationId') as string, 10);
        const type = formData.get('type') as 'delivery' | 'pickup';
        const startDateString = formData.get('startDate') as string;
        const endDateString = formData.get('endDate') as string;

        // Parse dates in local timezone to avoid UTC offset issues
        const [startYear, startMonth, startDay] = startDateString
            .split('-')
            .map(Number);
        const [endYear, endMonth, endDay] = endDateString
            .split('-')
            .map(Number);
        const startDate = new Date(startYear, startMonth - 1, startDay); // Month is 0-indexed
        const endDate = new Date(endYear, endMonth - 1, endDay);

        const startTime = formData.get('startTime') as string;
        const endTime = formData.get('endTime') as string;
        const slotDurationMinutes = 120; // Fixed 2-hour duration
        const daysOfWeek = formData
            .getAll('daysOfWeek')
            .map((day) => parseInt(day as string, 10));

        // Validate required fields and date validity
        if (
            !locationId ||
            !type ||
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(endDate.getTime()) ||
            !startTime ||
            !endTime ||
            daysOfWeek.length === 0
        ) {
            return {
                success: false,
                message:
                    'Molimo popunite sva obavezna polja ili unesite ispravne datume',
            };
        }

        // Validate date range
        if (endDate < startDate) {
            return {
                success: false,
                message: 'Datum završetka mora biti nakon datuma početka',
            };
        }

        // Generate time windows based on start time, end time, and slot duration
        const windows: string[] = [];
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const [endHours, endMinutes] = endTime.split(':').map(Number);

        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;

        for (
            let minutes = startTotalMinutes;
            minutes + slotDurationMinutes <= endTotalMinutes;
            minutes += slotDurationMinutes
        ) {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            windows.push(
                `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`,
            );
        }

        if (windows.length === 0) {
            return {
                success: false,
                message:
                    'Nema dostupnih slotova za generiranje s odabranim parametrima',
            };
        }

        // Calculate total days between start and end date
        const timeDiff = endDate.getTime() - startDate.getTime();
        const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include the end date

        // Filter dates by selected days of week and generate slots
        let created = 0;
        let skippedExisting = 0;

        for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + dayOffset);

            // Check if this day of week is selected (0 = Sunday, 1 = Monday, etc.)
            const dayOfWeek = currentDate.getDay();
            if (!daysOfWeek.includes(dayOfWeek)) {
                continue;
            }

            // Generate slots for this day using the existing bulk function
            const params: BulkSlotCreationParams = {
                startDate: currentDate,
                daysAhead: 1, // Just this one day
                windows,
                type,
                locationId,
            };

            const result = await bulkGenerateTimeSlots(params);
            created += result.created;
            skippedExisting += result.skippedExisting;
        }

        revalidatePath('/admin/delivery/slots');
        return {
            success: true,
            message: `Kreirano ${created} slotova, preskočeno ${skippedExisting} postojećih slotova`,
        };
    } catch (error) {
        console.error('Failed to bulk generate slots:', error);
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Greška pri kreiranju slotova',
        };
    }
}

export async function closeTimeSlotAction(slotId: number) {
    try {
        await auth(['admin']);
        await closeTimeSlot(slotId);
        revalidatePath('/admin/delivery/slots');
        return { success: true, message: 'Slot je uspješno zatvoren' };
    } catch (error) {
        console.error('Failed to close slot:', error);
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Greška pri zatvaranju slota',
        };
    }
}

export async function archiveTimeSlotAction(slotId: number) {
    try {
        await auth(['admin']);
        await archiveTimeSlot(slotId);
        revalidatePath('/admin/delivery/slots');
        return { success: true, message: 'Slot je uspješno arhiviran' };
    } catch (error) {
        console.error('Failed to archive slot:', error);
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Greška pri arhiviranju slota',
        };
    }
}

export async function updateTimeSlotStatusAction(
    slotId: number,
    status: string,
) {
    try {
        await auth(['admin']);
        await updateTimeSlot({ id: slotId, status });
        revalidatePath('/admin/delivery/slots');
        return { success: true, message: 'Status slota je uspješno ažuriran' };
    } catch (error) {
        console.error('Failed to update slot status:', error);
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Greška pri ažuriranju statusa slota',
        };
    }
}
