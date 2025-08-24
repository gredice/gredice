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
        const startDate = formData.get('startDate') as string;
        const startTime = formData.get('startTime') as string;

        // Combine date and time
        const startAt = new Date(`${startDate}T${startTime}:00.000Z`);
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
        const startDate = new Date(formData.get('startDate') as string);
        const daysAhead = parseInt(formData.get('daysAhead') as string, 10);
        const windows = (formData.get('windows') as string)
            .split(',')
            .map((w) => w.trim())
            .filter(Boolean);

        const params: BulkSlotCreationParams = {
            startDate,
            daysAhead,
            windows,
            type,
            locationId,
        };

        const result = await bulkGenerateTimeSlots(params);

        revalidatePath('/admin/delivery/slots');
        return {
            success: true,
            message: `Kreirano ${result.created} slotova, preskočeno ${result.skippedExisting} postojećih slotova`,
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
