import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type CancelDeliveryRequestForAccountDeps,
    cancelDeliveryRequestForCurrentAccount,
} from './cancelDeliveryRequestForAccount';

const input = {
    requestId: '39ba692d-4cd6-4937-9851-4527b56353c3',
    accountId: 'account-1',
    cancelReason: 'Promjena plana',
};

function deps(
    overrides: Partial<CancelDeliveryRequestForAccountDeps> = {},
): CancelDeliveryRequestForAccountDeps {
    return {
        cancelDeliveryRequestForAccount: async () => undefined,
        notifyDeliveryCancelled: async () => undefined,
        captureDeliveryCancelled: async () => undefined,
        deleteDeliveryRequestCalendarEvent: async () => undefined,
        ...overrides,
    };
}

test('account-bound cancellation runs no side effects when ownership is denied', async () => {
    let notificationCount = 0;
    let analyticsCount = 0;
    let calendarCount = 0;

    await assert.rejects(
        cancelDeliveryRequestForCurrentAccount(
            input,
            deps({
                cancelDeliveryRequestForAccount: async () => {
                    throw new Error('Delivery request not found');
                },
                notifyDeliveryCancelled: async () => {
                    notificationCount += 1;
                },
                captureDeliveryCancelled: async () => {
                    analyticsCount += 1;
                },
                deleteDeliveryRequestCalendarEvent: async () => {
                    calendarCount += 1;
                },
            }),
        ),
        /Delivery request not found/,
    );

    assert.equal(notificationCount, 0);
    assert.equal(analyticsCount, 0);
    assert.equal(calendarCount, 0);
});

test('account-bound cancellation forwards ownership and runs side effects after success', async () => {
    const calls: Array<{
        requestId: string;
        accountId: string;
        cancelReason: string;
    }> = [];
    let notificationCount = 0;
    let analyticsCount = 0;
    let calendarCount = 0;

    await cancelDeliveryRequestForCurrentAccount(
        input,
        deps({
            cancelDeliveryRequestForAccount: async (data) => {
                calls.push({
                    requestId: data.requestId,
                    accountId: data.accountId,
                    cancelReason: data.cancelReason,
                });
            },
            notifyDeliveryCancelled: async () => {
                notificationCount += 1;
            },
            captureDeliveryCancelled: async () => {
                analyticsCount += 1;
            },
            deleteDeliveryRequestCalendarEvent: async () => {
                calendarCount += 1;
            },
        }),
    );

    assert.deepEqual(calls, [input]);
    assert.equal(notificationCount, 1);
    assert.equal(analyticsCount, 1);
    assert.equal(calendarCount, 1);
});
