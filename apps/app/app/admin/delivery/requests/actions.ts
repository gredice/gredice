'use server';

import { notifyDeliveryRequestEvent } from '@gredice/notifications';
import {
    cancelDeliveryRequest,
    changeDeliveryRequestSlot,
    confirmDeliveryRequest,
    createNotification,
    DeliveryRequestStates,
    fulfillDeliveryRequest,
    getDeliveryRequest,
    prepareDeliveryRequest,
    readyDeliveryRequest,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { notifyDeliveryReady } from '../../../../../api/lib/delivery/emailNotifications';
import { auth } from '../../../../lib/auth/auth';

export async function updateDeliveryRequestStatusAction(
    _prevState: unknown,
    formData: FormData,
) {
    try {
        await auth(['admin']);

        const requestId = formData.get('requestId') as string;
        const status = formData.get('status') as string;
        const cancelReason = formData.get('cancelReason') as string;
        const notes = (formData.get('notes') as string) || undefined;

        if (!requestId || !status) {
            return {
                success: false,
                message: 'Molimo popunite sva obavezna polja',
            };
        }

        if (status === DeliveryRequestStates.CONFIRMED) {
            await confirmDeliveryRequest(requestId);
        } else if (status === DeliveryRequestStates.CANCELLED) {
            await cancelDeliveryRequest(
                requestId,
                'admin',
                cancelReason,
                notes,
            );
            await notifyDeliveryRequestEvent(requestId, 'cancelled', {
                reason: cancelReason,
                note: notes,
                status,
            });
        } else if (status === DeliveryRequestStates.PREPARING) {
            await prepareDeliveryRequest(requestId);
            await notifyDeliveryRequestEvent(requestId, 'updated', {
                status,
                note: notes,
            });
        } else if (status === DeliveryRequestStates.READY) {
            await readyDeliveryRequest(requestId);
            await notifyDeliveryRequestEvent(requestId, 'updated', {
                status,
                note: notes,
            });
            await notifyDeliveryReady(requestId);
        } else if (status === DeliveryRequestStates.FULFILLED) {
            await fulfillDeliveryRequest(requestId, notes);
            await notifyDeliveryRequestEvent(requestId, 'updated', {
                status,
                note: notes,
            });
        } else {
            throw new Error('Nepoznat status zahtjeva');
        }

        if (
            status !== DeliveryRequestStates.CANCELLED &&
            status !== DeliveryRequestStates.PREPARING &&
            status !== DeliveryRequestStates.READY &&
            status !== DeliveryRequestStates.FULFILLED
        ) {
            await notifyDeliveryRequestEvent(requestId, 'updated', {
                status,
                note: notes,
            });
        }

        revalidatePath('/admin/delivery/requests');

        return {
            success: true,
            message: 'Status zahtjeva je uspješno ažuriran',
        };
    } catch (error) {
        console.error('Error updating delivery request status:', error);
        return {
            success: false,
            message: 'Greška pri ažuriranju statusa zahtjeva',
        };
    }
}

export async function changeDeliveryRequestSlotAction(
    _prevState: unknown,
    formData: FormData,
) {
    try {
        await auth(['admin']);

        const requestId = formData.get('requestId') as string;
        const slotId = Number(formData.get('slotId'));

        if (!requestId || !slotId) {
            return {
                success: false,
                message: 'Molimo popunite sva obavezna polja',
            };
        }

        await changeDeliveryRequestSlot(requestId, slotId);
        const updatedRequest = await getDeliveryRequest(requestId);
        if (updatedRequest?.accountId && updatedRequest.slot) {
            const formatted =
                updatedRequest.slot.startAt.toLocaleString('hr-HR');
            await createNotification({
                accountId: updatedRequest.accountId,
                header: 'Termin dostave promijenjen',
                content: `Tvoj termin dostave je promijenjen na ${formatted}.`,
                timestamp: new Date(),
            });
        }

        await notifyDeliveryRequestEvent(requestId, 'updated', {
            status: updatedRequest?.state,
        });

        revalidatePath('/admin/delivery/requests');

        return {
            success: true,
            message: 'Termin dostave je uspješno promijenjen',
        };
    } catch (error) {
        console.error('Error changing delivery request slot:', error);
        return {
            success: false,
            message: 'Greška pri promjeni termina dostave',
        };
    }
}
