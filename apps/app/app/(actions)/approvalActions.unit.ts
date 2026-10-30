import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import type { ApprovalRequest } from '@gredice/storage';

const { StalePlantStatusApprovalRequestError } = await import(
    '@gredice/storage'
);
const calls: string[] = [];
let approvalError: Error | undefined;
let authError: Error | undefined;
let notificationError: Error | undefined;
const request: ApprovalRequest = {
    id: 'approval-test',
    status: 'approved',
    requestedBy: 'farmer-test',
    requestedAt: new Date('2026-10-29T10:00:00Z'),
    createdAt: new Date('2026-10-29T10:00:00Z'),
    reviewedAt: new Date('2026-10-29T10:19:34Z'),
    target: {
        kind: 'raisedBedPlanting.plantStatus',
        plantingId: 20,
        lifecycleVersionEventId: 30,
        plantSortId: 40,
        raisedBedId: 50,
        positionIndex: 0,
        accountId: 'account-test',
        gardenId: 60,
        currentStatus: 'sowed',
        requestedStatus: 'sprouted',
    },
};

mock.module('@gredice/storage', {
    namedExports: {
        StalePlantStatusApprovalRequestError,
        approvePlantStatusApprovalRequest: async (input: unknown) => {
            calls.push('approve');
            assert.deepEqual(input, {
                requestId: request.id,
                reviewedBy: 'admin-test',
            });
            if (approvalError) throw approvalError;
            return request;
        },
        createNotification: async () => {
            calls.push('notify');
            if (notificationError) throw notificationError;
        },
        getEntityFormatted: async () => ({ information: { name: 'Grah' } }),
        getRaisedBed: async () => ({
            id: 50,
            name: 'A1',
            accountId: 'account-test',
            gardenId: 60,
        }),
        rejectApprovalRequest: async () => {},
    },
});
mock.module('next/cache', {
    namedExports: { revalidatePath: (path: string) => calls.push(path) },
});
mock.module('../../lib/auth/auth.ts', {
    namedExports: {
        auth: async (roles: unknown) => {
            calls.push('auth');
            assert.deepEqual(roles, ['admin']);
            if (authError) throw authError;
            return { userId: 'admin-test' };
        },
    },
});
mock.module('./operationActions.ts', {
    namedExports: { completeOperation: async () => {} },
});
mock.module('./raisedBedFieldsActions.ts', {
    namedExports: { verifyRaisedBedPlantingAction: async () => {} },
});
mock.module('./selectedRaisedBedPlantingActions.ts', {
    namedExports: { verifySelectedPlantingTaskAction: async () => {} },
});

const { approveApprovalRequestAction } = await import('./approvalActions.ts');
const { KnownPages } = await import('../../src/KnownPages.ts');

test.beforeEach(() => {
    calls.length = 0;
    approvalError = undefined;
    authError = undefined;
    notificationError = undefined;
});

test('returns a serializable stale conflict and revalidates queues without notifications', async () => {
    approvalError = new StalePlantStatusApprovalRequestError();
    const result = await approveApprovalRequestAction(request.id);
    assert.deepEqual(result, {
        success: false,
        conflict: true,
        code: 'plant_changed',
        message: approvalError.message,
    });
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
    assert.deepEqual(calls, [
        'auth',
        'approve',
        KnownPages.Approvals,
        KnownPages.Schedule,
    ]);
});

test('auth failure stops before storage and queue invalidation', async () => {
    authError = new Error('Unauthorized');
    await assert.rejects(approveApprovalRequestAction(request.id), authError);
    assert.deepEqual(calls, ['auth']);
});

test('unexpected storage errors still fail without being presented as stale conflicts', async () => {
    approvalError = new Error('Database unavailable');
    await assert.rejects(
        approveApprovalRequestAction(request.id),
        approvalError,
    );
    assert.deepEqual(calls, ['auth', 'approve']);
});

test('successful approval notifies and revalidates affected pages and queues', async () => {
    await approveApprovalRequestAction(request.id);
    assert.deepEqual(calls, [
        'auth',
        'approve',
        'notify',
        KnownPages.Greenhouse,
        KnownPages.RaisedBed(50),
        KnownPages.Account('account-test'),
        KnownPages.Garden(60),
        KnownPages.Approvals,
        KnownPages.Schedule,
    ]);
});

test('post-approval notification errors are outside the stale-conflict boundary', async () => {
    notificationError = new StalePlantStatusApprovalRequestError();
    await assert.rejects(
        approveApprovalRequestAction(request.id),
        notificationError,
    );
    assert.deepEqual(calls, ['auth', 'approve', 'notify']);
});
