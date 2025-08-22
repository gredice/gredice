'use server';

import { auth } from '../../../../lib/auth/auth';
import { cancelDeliveryRequest, confirmDeliveryRequest, DeliveryRequestStates, fulfillDeliveryRequest, prepareDeliveryRequest, readyDeliveryRequest } from '@gredice/storage';
import { revalidatePath } from 'next/cache';

export async function updateDeliveryRequestStatusAction(prevState: unknown, formData: FormData) {
    try {
        await auth(['admin']);

        const requestId = formData.get('requestId') as string;
        const status = formData.get('status') as string;
        const cancelReason = formData.get('cancelReason') as string;
        const notes = formData.get('notes') as string || undefined;

        if (!requestId || !status) {
            return {
                success: false,
                message: 'Molimo popunite sva obavezna polja'
            };
        }

        if (status === DeliveryRequestStates.CONFIRMED) {
            await confirmDeliveryRequest(requestId);
        } else if (status === DeliveryRequestStates.CANCELLED) {
            await cancelDeliveryRequest(requestId, 'admin', cancelReason, notes);
        } else if (status === DeliveryRequestStates.PREPARING) {
            await prepareDeliveryRequest(requestId);
        } else if (status === DeliveryRequestStates.READY) {
            await readyDeliveryRequest(requestId);
        } else if (status === DeliveryRequestStates.FULFILLED) {
            await fulfillDeliveryRequest(requestId, notes);
        } else {
            throw new Error('Nepoznat status zahtjeva');
        }

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
