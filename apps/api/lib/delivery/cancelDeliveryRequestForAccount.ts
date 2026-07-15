import { notifyDeliveryRequestEvent } from '@gredice/notifications';
import { cancelDeliveryRequestForAccount } from '@gredice/storage';
import { getPostHogClient } from '../posthog-server';
import { deleteDeliveryRequestCalendarEvent } from './calendarSync';

export type CancelDeliveryRequestForAccountDeps = {
    cancelDeliveryRequestForAccount: typeof cancelDeliveryRequestForAccount;
    notifyDeliveryCancelled: (
        requestId: string,
        data: { reason: string; note?: string },
    ) => Promise<void>;
    captureDeliveryCancelled: (data: {
        accountId: string;
        requestId: string;
        cancelReason: string;
    }) => Promise<void>;
    deleteDeliveryRequestCalendarEvent: (requestId: string) => Promise<void>;
};

const defaultDeps: CancelDeliveryRequestForAccountDeps = {
    cancelDeliveryRequestForAccount,
    notifyDeliveryCancelled: (requestId, data) =>
        notifyDeliveryRequestEvent(requestId, 'cancelled', data),
    captureDeliveryCancelled: async ({
        accountId,
        requestId,
        cancelReason,
    }) => {
        (await getPostHogClient()).capture({
            distinctId: accountId,
            event: 'delivery_request_cancelled',
            properties: {
                request_id: requestId,
                cancel_reason: cancelReason,
            },
        });
    },
    deleteDeliveryRequestCalendarEvent,
};

export async function cancelDeliveryRequestForCurrentAccount(
    input: {
        requestId: string;
        accountId: string;
        actorUserId?: string;
        cancelReason: string;
        note?: string;
    },
    deps: CancelDeliveryRequestForAccountDeps = defaultDeps,
) {
    await deps.cancelDeliveryRequestForAccount(input);
    await deps.notifyDeliveryCancelled(input.requestId, {
        reason: input.cancelReason,
        note: input.note,
    });
    await deps.captureDeliveryCancelled({
        accountId: input.accountId,
        requestId: input.requestId,
        cancelReason: input.cancelReason,
    });
    void deps.deleteDeliveryRequestCalendarEvent(input.requestId);
}
