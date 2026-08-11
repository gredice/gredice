import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type {
    CompleteSelectedRaisedBedPlantingTaskInput,
    SelectedRaisedBedPlantingTaskMutationResult,
    VerifySelectedRaisedBedPlantingTaskInput,
} from '@gredice/storage';
import {
    completeSelectedRaisedBedPlantingTaskAndNotify,
    verifySelectedRaisedBedPlantingTaskAndNotify,
} from './selectedRaisedBedPlantingActionNotifications.ts';

function adminTaskInput(): CompleteSelectedRaisedBedPlantingTaskInput {
    return {
        kind: 'selected',
        plantingId: 42,
        expectedLifecycleVersionEventId: 80,
        expectedPlantSortId: 17,
        actor: { role: 'admin', userId: randomUUID() },
        commandId: randomUUID(),
    };
}

function mutationResult(
    created: boolean,
): SelectedRaisedBedPlantingTaskMutationResult {
    const initialCommandId = randomUUID();
    return {
        kind: 'selectedPlantingTask',
        plantingId: 42,
        eventId: 91,
        occurredAt: new Date('2026-08-10T08:00:00.000Z'),
        created,
        lifecycleStatus: 'sowed',
        lifecycleStoppedAt: null,
        isActive: true,
        task: {
            identity: {
                kind: 'selected',
                plantingId: 42,
                expectedLifecycleVersionEventId: 91,
                expectedPlantSortId: 17,
            },
            status: 'completed',
            scheduledDate: '2026-08-11T08:00:00.000Z',
            sowingLocation: 'direct',
            startedBy: randomUUID(),
            initialCommandId,
            initialScheduledDate: '2026-08-11T08:00:00.000Z',
            initialSowingLocation: 'direct',
            assignedUserIds: [],
            assignedBy: null,
            assignedAt: null,
            block: null,
            completion: null,
            verification: null,
            cancellation: null,
        },
    };
}

test('Admin direct completion ensures one sowed notification after the mutation', async () => {
    const input = adminTaskInput();
    const expectedResult = mutationResult(true);
    const callOrder: string[] = [];
    const notificationInputs: unknown[] = [];

    const result = await completeSelectedRaisedBedPlantingTaskAndNotify(input, {
        completeTask: async (receivedInput) => {
            callOrder.push('mutation');
            assert.deepEqual(receivedInput, input);
            return expectedResult;
        },
        ensureSowedNotification: async (notificationInput) => {
            callOrder.push('notification');
            notificationInputs.push(notificationInput);
        },
    });

    assert.equal(result, expectedResult);
    assert.deepEqual(callOrder, ['mutation', 'notification']);
    assert.deepEqual(notificationInputs, [{ eventId: 91, plantingId: 42 }]);
});

test('Admin verification invokes the idempotent notification helper on command replay', async () => {
    const input: VerifySelectedRaisedBedPlantingTaskInput = adminTaskInput();
    const replayResult = mutationResult(false);
    const notificationInputs: unknown[] = [];

    const result = await verifySelectedRaisedBedPlantingTaskAndNotify(input, {
        verifyTask: async (receivedInput) => {
            assert.deepEqual(receivedInput, input);
            return replayResult;
        },
        ensureSowedNotification: async (notificationInput) => {
            notificationInputs.push(notificationInput);
        },
    });

    assert.equal(result, replayResult);
    assert.deepEqual(notificationInputs, [{ eventId: 91, plantingId: 42 }]);
});

test('notification failure stays visible so the canonical command can be retried', async () => {
    const input = adminTaskInput();
    const expectedError = new Error('notification unavailable');

    await assert.rejects(
        completeSelectedRaisedBedPlantingTaskAndNotify(input, {
            completeTask: async () => mutationResult(true),
            ensureSowedNotification: async () => {
                throw expectedError;
            },
        }),
        expectedError,
    );
});
