'use client';

import { useEffect } from 'react';
import type { ScheduleTaskSubmissionFailureCode } from '../app/schedule/scheduleTaskSubmissionResult';
import type { OperationCompletionDraftLease } from '../lib/offline/operationCompletionDraftStore';
import type { OperationCompletionQueueItem } from '../lib/offline/operationCompletionQueueStore';
import {
    type OperationCompletionQueueSyncOutcome,
    syncClaimedOperationCompletionQueueItem,
} from '../lib/offline/operationCompletionQueueSync';
import { OperationCompletionDraftStoreHarness } from './OperationCompletionDraftStoreHarness';

type SyncDependencies = NonNullable<
    Parameters<typeof syncClaimedOperationCompletionQueueItem>[3]
>;

type CompletionPlan =
    | { kind: 'throw' }
    | {
          kind: 'success';
          state: 'completed' | 'pendingVerification';
      }
    | {
          canRetry?: boolean;
          code: ScheduleTaskSubmissionFailureCode;
          kind: 'failure';
          retryImageUrls?: string[];
      };

type RecoveryPlan =
    | { kind: 'missing' }
    | { kind: 'throw' }
    | { imageUrl: string; kind: 'found' }
    | {
          code: ScheduleTaskSubmissionFailureCode;
          kind: 'failure';
      };

type UploadPlan = { kind: 'throw' } | { kind: 'success'; url: string };

type CompletionCall = {
    expectedEntityId: number;
    expectedRequirementsFingerprint: string;
    expectedTaskVersionEventId: number;
    imageUrls: string[];
    notes: string | undefined;
    operationId: number;
    submissionId: string | undefined;
};

type RecoveryCall = {
    attachmentId: string;
    expectedEntityId: number;
    expectedRequirementsFingerprint: string;
    expectedTaskVersionEventId: number;
    fileName: string;
    operationId: number;
    submissionId: string;
};

type UploadCall = {
    access: 'public' | 'private';
    clientPayload: string | null;
    file: {
        lastModified: number;
        name: string;
        size: number;
        text: string;
        type: string;
    } | null;
    handleUploadUrl: string;
    multipart: boolean;
    pathname: string;
};

export type OperationCompletionQueueSyncTestConfiguration = {
    completionPlans?: CompletionPlan[];
    recoveryPlans?: RecoveryPlan[];
    uploadPlans?: UploadPlan[];
};

export type OperationCompletionQueueSyncTestState = {
    completionCalls: CompletionCall[];
    completionPlans: CompletionPlan[];
    recoveryCalls: RecoveryCall[];
    recoveryPlans: RecoveryPlan[];
    uploadCalls: UploadCall[];
    uploadPlans: UploadPlan[];
};

type OperationCompletionQueueSyncTestApi = {
    configure: (
        configuration?: OperationCompletionQueueSyncTestConfiguration,
    ) => void;
    getState: () => OperationCompletionQueueSyncTestState;
    sync: (
        item: OperationCompletionQueueItem,
        lease: OperationCompletionDraftLease,
        active?: boolean,
    ) => Promise<OperationCompletionQueueSyncOutcome>;
};

declare global {
    interface Window {
        __operationCompletionQueueSyncTestApi?: OperationCompletionQueueSyncTestApi;
    }
}

function createState(
    configuration: OperationCompletionQueueSyncTestConfiguration = {},
): OperationCompletionQueueSyncTestState {
    return {
        completionCalls: [],
        completionPlans: [...(configuration.completionPlans ?? [])],
        recoveryCalls: [],
        recoveryPlans: [...(configuration.recoveryPlans ?? [])],
        uploadCalls: [],
        uploadPlans: [...(configuration.uploadPlans ?? [])],
    };
}

let state = createState();

const complete: SyncDependencies['complete'] = async (
    operationId,
    expectedEntityId,
    expectedTaskVersionEventId,
    expectedRequirementsFingerprint,
    imageUrls,
    notes,
    submissionId,
) => {
    state.completionCalls.push({
        expectedEntityId,
        expectedRequirementsFingerprint,
        expectedTaskVersionEventId,
        imageUrls,
        notes,
        operationId,
        submissionId,
    });
    const plan = state.completionPlans.shift() ?? {
        kind: 'success',
        state: 'pendingVerification',
    };
    if (plan.kind === 'throw') {
        throw new Error('Controlled completion transport failure');
    }
    if (plan.kind === 'failure') {
        return {
            canRetry: plan.canRetry ?? false,
            code: plan.code,
            message: 'Controlled terminal completion failure',
            ...(plan.retryImageUrls
                ? { retryImageUrls: plan.retryImageUrls }
                : {}),
            success: false,
        };
    }
    return {
        recordedAt: '2026-07-15T10:00:00.000Z',
        state: plan.state,
        success: true,
    };
};

const recoverImage: SyncDependencies['recoverImage'] = async (
    operationId,
    expectedEntityId,
    expectedTaskVersionEventId,
    expectedRequirementsFingerprint,
    submissionId,
    attachmentId,
    fileName,
) => {
    state.recoveryCalls.push({
        attachmentId,
        expectedEntityId,
        expectedRequirementsFingerprint,
        expectedTaskVersionEventId,
        fileName,
        operationId,
        submissionId,
    });
    const plan = state.recoveryPlans.shift() ?? { kind: 'missing' };
    if (plan.kind === 'throw') {
        throw new Error('Controlled image recovery failure');
    }
    if (plan.kind === 'failure') {
        return {
            canRetry: false,
            code: plan.code,
            message: 'Controlled terminal image recovery failure',
            success: false,
        };
    }
    return {
        imageUrl: plan.kind === 'found' ? plan.imageUrl : null,
        success: true,
    };
};

const uploadImage: SyncDependencies['uploadImage'] = async (
    pathname,
    body,
    options,
) => {
    const file = body instanceof File ? body : null;
    state.uploadCalls.push({
        access: options.access,
        clientPayload: options.clientPayload ?? null,
        file: file
            ? {
                  lastModified: file.lastModified,
                  name: file.name,
                  size: file.size,
                  text: await file.text(),
                  type: file.type,
              }
            : null,
        handleUploadUrl: options.handleUploadUrl,
        multipart: options.multipart ?? false,
        pathname,
    });
    const plan = state.uploadPlans.shift() ?? {
        kind: 'success',
        url: `https://blob.example/${pathname}`,
    };
    if (plan.kind === 'throw') {
        throw new Error('Controlled ambiguous image upload failure');
    }
    return {
        contentDisposition: 'inline',
        contentType: file?.type ?? 'application/octet-stream',
        downloadUrl: `${plan.url}?download=1`,
        etag: 'test-etag',
        pathname,
        url: plan.url,
    };
};

const dependencies = {
    complete,
    recoverImage,
    uploadImage,
} satisfies SyncDependencies;

export function OperationCompletionQueueSyncHarness() {
    useEffect(() => {
        window.__operationCompletionQueueSyncTestApi = {
            configure(configuration) {
                state = createState(configuration);
            },
            getState() {
                return state;
            },
            sync(item, lease, active = true) {
                return syncClaimedOperationCompletionQueueItem(
                    item,
                    lease,
                    () => active,
                    dependencies,
                );
            },
        };

        return () => {
            delete window.__operationCompletionQueueSyncTestApi;
        };
    }, []);

    return <OperationCompletionDraftStoreHarness />;
}
