import assert from 'node:assert/strict';
import test from 'node:test';
import { progressDeliveryRequestGroup } from './progressDeliveryRequestGroup.ts';

test('advances eligible requests and sends one grouped notification', async () => {
    const states = new Map([
        ['pending-request', 'pending'],
        ['confirmed-request', 'confirmed'],
        ['fulfilled-request', 'fulfilled'],
    ]);
    const applied: { requestId: string; status: string }[] = [];
    const notifications: string[][] = [];

    const progressed = await progressDeliveryRequestGroup({
        requestIds: [
            'pending-request',
            'confirmed-request',
            'confirmed-request',
            'fulfilled-request',
            'missing-request',
        ],
        actorUserId: 'admin-user',
        dependencies: {
            getRequest: async (requestId) => {
                const state = states.get(requestId);
                return state ? { state } : undefined;
            },
            applyStatus: async ({ requestId, status }) => {
                applied.push({ requestId, status });
            },
            notifyGroup: async (requestIds) => {
                notifications.push(requestIds);
            },
        },
    });

    assert.deepEqual(progressed, ['pending-request', 'confirmed-request']);
    assert.deepEqual(applied, [
        { requestId: 'pending-request', status: 'confirmed' },
        { requestId: 'confirmed-request', status: 'preparing' },
    ]);
    assert.deepEqual(notifications, [['pending-request', 'confirmed-request']]);
});

test('does not notify when no request can advance', async () => {
    let notifications = 0;

    const progressed = await progressDeliveryRequestGroup({
        requestIds: ['fulfilled-request'],
        actorUserId: 'admin-user',
        dependencies: {
            getRequest: async () => ({ state: 'fulfilled' }),
            applyStatus: async () => {
                throw new Error('applyStatus should not be called');
            },
            notifyGroup: async () => {
                notifications += 1;
            },
        },
    });

    assert.deepEqual(progressed, []);
    assert.equal(notifications, 0);
});

test('notifies once for requests advanced before a later failure', async () => {
    const notifications: string[][] = [];

    await assert.rejects(
        progressDeliveryRequestGroup({
            requestIds: ['first', 'second'],
            actorUserId: 'admin-user',
            dependencies: {
                getRequest: async () => ({ state: 'confirmed' }),
                applyStatus: async ({ requestId }) => {
                    if (requestId === 'second') {
                        throw new Error('status update failed');
                    }
                },
                notifyGroup: async (requestIds) => {
                    notifications.push(requestIds);
                },
            },
        }),
        /status update failed/,
    );

    assert.deepEqual(notifications, [['first']]);
});
