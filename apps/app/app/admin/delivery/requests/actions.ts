'use server';

import { auth } from '../../../../lib/auth/auth';
import { updateDeliveryRequestStatus } from '@gredice/storage';
import { revalidatePath } from 'next/cache';

export async function updateDeliveryRequestStatusAction(prevState: unknown, formData: FormData) {
    try {
        await auth(['admin']);

        const requestId = formData.get('requestId') as string;
        const status = formData.get('status') as string;
        const notes = formData.get('notes') as string || undefined;

        if (!requestId || !status) {
            return {
                success: false,
                message: 'Molimo popunite sva obavezna polja'
            };
        }

        await updateDeliveryRequestStatus(requestId, status, notes);

        revalidatePath('/admin/delivery/requests');

        return {
            success: true,
            message: 'Status zahtjeva je uspješno ažuriran'
        };
    } catch (error) {
        console.error('Error updating delivery request status:', error);
        return {
            success: false,
            message: 'Greška pri ažuriranju statusa zahtjeva'
        };
    }
}
