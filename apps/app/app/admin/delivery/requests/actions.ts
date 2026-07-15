'use server';

import { notifyDeliveryRequestEvent } from '@gredice/notifications';
import {
    cancelDeliveryRequest,
    changeDeliveryRequestSlot,
    confirmDeliveryRequest,
    createNotification,
    DeliveryRequestStates,
    DeliveryRunAssignmentError,
    fulfillDeliveryRequest,
    getDeliveryRequest,
    prepareDeliveryRequest,
    readyDeliveryRequest,
    uncancelDeliveryRequest,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { notifyDeliveryCancelled } from '../../../../../api/lib/delivery/emailNotifications';
import { auth } from '../../../../lib/auth/auth';
import { getNextDeliveryRequestStatus } from './DeliveryRequestStatusFlow';

async function applyDeliveryRequestStatus({
    requestId,
    status,
    cancelReason,
    notes,
    actorUserId,
}: {
    requestId: string;
    status: string;
    cancelReason?: string;
    notes?: string;
    actorUserId: string;
}) {
    const request = await getDeliveryRequest(requestId);

    if (!request) {
        throw new Error('Zahtjev za dostavu nije pronađen');
    }

    // TODO: Refactor this so we don't call 3 similar requests for each
    //       status change, notification should be piped through notification service
    //       which should send emails to users and slack messages to admins
    if (status === DeliveryRequestStates.CONFIRMED) {
        if (request.state === DeliveryRequestStates.CANCELLED) {
            await uncancelDeliveryRequest(requestId);
        } else {
            await confirmDeliveryRequest(requestId);
        }
        await notifyDeliveryRequestEvent(requestId, 'updated', {
            status,
            note: notes,
        });
    } else if (status === DeliveryRequestStates.CANCELLED) {
        await cancelDeliveryRequest(
            requestId,
            'admin',
            cancelReason ?? '',
            notes,
            actorUserId,
        );
        await notifyDeliveryRequestEvent(requestId, 'cancelled', {
            reason: cancelReason,
            note: notes,
            status,
        });
        await notifyDeliveryCancelled(requestId);
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
    } else if (status === DeliveryRequestStates.FULFILLED) {
        await fulfillDeliveryRequest(requestId, notes);
        await notifyDeliveryRequestEvent(requestId, 'updated', {
            status,
            note: notes,
        });
    } else {
        throw new Error('Nepoznat status zahtjeva');
    }
}

export async function updateDeliveryRequestStatusAction(
    _prevState: unknown,
    formData: FormData,
) {
    try {
        const { userId } = await auth(['admin']);

        const requestIdValue = formData.get('requestId');
        const statusValue = formData.get('status');
        const cancelReasonValue = formData.get('cancelReason');
        const notesValue = formData.get('notes');
        const requestId =
            typeof requestIdValue === 'string' ? requestIdValue : '';
        const status = typeof statusValue === 'string' ? statusValue : '';
        const cancelReason =
            typeof cancelReasonValue === 'string'
                ? cancelReasonValue
                : undefined;
        const notes =
            typeof notesValue === 'string' && notesValue.length > 0
                ? notesValue
                : undefined;

        if (!requestId || !status) {
            return {
                success: false,
                message: 'Molimo popunite sva obavezna polja',
            };
        }

        await applyDeliveryRequestStatus({
            requestId,
            status,
            cancelReason,
            notes,
            actorUserId: userId,
        });

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

export async function progressDeliveryRequestGroupStatusAction(
    _prevState: unknown,
    formData: FormData,
) {
    try {
        const { userId } = await auth(['admin']);

        const requestIds = formData
            .getAll('requestIds')
            .filter(
                (requestId): requestId is string =>
                    typeof requestId === 'string' && requestId.length > 0,
            );

        if (requestIds.length === 0) {
            return {
                success: false,
                message: 'Nema zahtjeva za ažuriranje',
            };
        }

        let updatedCount = 0;

        for (const requestId of requestIds) {
            const request = await getDeliveryRequest(requestId);
            if (!request) {
                continue;
            }

            const nextStatus = getNextDeliveryRequestStatus(request.state);
            if (!nextStatus) {
                continue;
            }

            await applyDeliveryRequestStatus({
                requestId,
                status: nextStatus,
                actorUserId: userId,
            });
            updatedCount += 1;
        }

        if (updatedCount === 0) {
            return {
                success: false,
                message:
                    'Nema zahtjeva koji se mogu pomaknuti u sljedeći status',
            };
        }

        revalidatePath('/admin/delivery/requests');

        return {
            success: true,
            message: `Ažurirano zahtjeva: ${updatedCount}`,
        };
    } catch (error) {
        console.error(
            'Error progressing delivery request group status:',
            error,
        );
        return {
            success: false,
            message: 'Greška pri ažuriranju statusa grupe zahtjeva',
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
        if (error instanceof DeliveryRunAssignmentError) {
            return {
                success: false,
                code: error.code,
                message:
                    'Termin je dio aktivne dostavne rute. Najprije napusti rutu ili oporavi dostavu.',
            };
        }
        return {
            success: false,
            message: 'Greška pri promjeni termina dostave',
        };
    }
}
