'use client';

import { upload } from '@vercel/blob/client';
import {
    completeFarmOperationWithImageUrls,
    recoverFarmOperationCompletionImage,
} from '../../app/schedule/actions';
import { getFarmOperationCompletionSubmissionImagePath } from '../../app/schedule/operationCompletionProof';
import {
    parseScheduleOperationCompletionRequirementsFingerprint,
    type ScheduleOperationCompletionRequirementsFingerprint,
} from '../../app/schedule/scheduleOperationRequirements';
import type { ScheduleTaskSubmissionFailureCode } from '../../app/schedule/scheduleTaskSubmissionResult';
import type { OperationCompletionDraftLease } from './operationCompletionDraftStore';
import {
    clearOperationCompletionQueueAttachmentUploads,
    markOperationCompletionQueueAttachmentUploaded,
    markOperationCompletionQueueFailed,
    markOperationCompletionQueueServerConfirmed,
    type OperationCompletionQueueFailureCode,
    type OperationCompletionQueueItem,
    type OperationCompletionQueueMutationResult,
    releaseOperationCompletionQueueClaimForRetry,
} from './operationCompletionQueueStore';

const MULTIPART_UPLOAD_THRESHOLD_BYTES = 5 * 1024 * 1024;
const RETRY_BACKOFF_MS = [5_000, 30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000];

type ActionableQueueFailureCode = Exclude<
    OperationCompletionQueueFailureCode,
    'discarded' | 'expired'
>;

export type OperationCompletionQueueSyncOutcome =
    | { serverState: 'completed' | 'pendingVerification'; status: 'confirmed' }
    | { failureCode: OperationCompletionQueueFailureCode; status: 'failed' }
    | {
          failureCode: OperationCompletionQueueFailureCode;
          status: 'retry_scheduled';
      }
    | { status: 'abandoned' };

type QueueSyncDependencies = {
    complete: typeof completeFarmOperationWithImageUrls;
    recoverImage: typeof recoverFarmOperationCompletionImage;
    uploadImage: typeof upload;
};

const defaultDependencies: QueueSyncDependencies = {
    complete: completeFarmOperationWithImageUrls,
    recoverImage: recoverFarmOperationCompletionImage,
    uploadImage: upload,
};

function nextAttemptAt(attemptCount: number) {
    const index = Math.max(
        0,
        Math.min(attemptCount - 1, RETRY_BACKOFF_MS.length - 1),
    );
    return Date.now() + (RETRY_BACKOFF_MS[index] ?? RETRY_BACKOFF_MS[0]);
}

function terminalFailureCode(
    code: ScheduleTaskSubmissionFailureCode,
): ActionableQueueFailureCode {
    switch (code) {
        case 'submission_conflict':
            return 'idempotency_conflict';
        case 'assignment_changed':
        case 'invalid_input':
        case 'invalid_status':
        case 'not_authorized':
        case 'not_found':
        case 'task_changed':
            return code;
    }
}

function mutationSucceeded(result: OperationCompletionQueueMutationResult) {
    return result.status === 'ok';
}

function requestIsStillOwned(
    item: OperationCompletionQueueItem,
    isActive: () => boolean,
) {
    return Boolean(item.claim?.claimId) && isActive();
}

async function scheduleRetry(
    item: OperationCompletionQueueItem,
    lease: OperationCompletionDraftLease,
    failureCode: ActionableQueueFailureCode,
): Promise<OperationCompletionQueueSyncOutcome> {
    const claimId = item.claim?.claimId;
    if (!claimId) {
        return { status: 'abandoned' };
    }
    const result = await releaseOperationCompletionQueueClaimForRetry(
        {
            claimId,
            failureCode,
            key: item.key,
            nextAttemptAt: nextAttemptAt(item.attemptCount),
            submissionId: item.submissionId,
        },
        lease,
    );
    return mutationSucceeded(result)
        ? { failureCode, status: 'retry_scheduled' }
        : { status: 'abandoned' };
}

async function failTerminally(
    item: OperationCompletionQueueItem,
    lease: OperationCompletionDraftLease,
    failureCode: ActionableQueueFailureCode,
): Promise<OperationCompletionQueueSyncOutcome> {
    const claimId = item.claim?.claimId;
    if (!claimId) {
        return { status: 'abandoned' };
    }
    const result = await markOperationCompletionQueueFailed(
        {
            claimId,
            failureCode,
            key: item.key,
            submissionId: item.submissionId,
        },
        lease,
    );
    return mutationSucceeded(result)
        ? { failureCode, status: 'failed' }
        : { status: 'abandoned' };
}

function uploadClientPayload(
    item: OperationCompletionQueueItem,
    attachment: OperationCompletionQueueItem['attachments'][number],
    requirementsFingerprint: ScheduleOperationCompletionRequirementsFingerprint,
) {
    return JSON.stringify({
        attachmentId: attachment.id,
        expectedEntityId: item.expectedEntityId,
        expectedRequirementsFingerprint: requirementsFingerprint,
        expectedTaskVersionEventId: item.expectedTaskVersionEventId,
        fileName: attachment.name,
        operationId: item.operationId,
        submissionId: item.submissionId,
    });
}

async function recoverAttachment(
    item: OperationCompletionQueueItem,
    attachment: OperationCompletionQueueItem['attachments'][number],
    requirementsFingerprint: ScheduleOperationCompletionRequirementsFingerprint,
    dependencies: QueueSyncDependencies,
) {
    return await dependencies.recoverImage(
        item.operationId,
        item.expectedEntityId,
        item.expectedTaskVersionEventId,
        requirementsFingerprint,
        item.submissionId,
        attachment.id,
        attachment.name,
    );
}

async function persistUploadedAttachment(
    item: OperationCompletionQueueItem,
    attachmentId: string,
    uploadedUrl: string,
    lease: OperationCompletionDraftLease,
) {
    const claimId = item.claim?.claimId;
    if (!claimId) {
        return false;
    }
    return mutationSucceeded(
        await markOperationCompletionQueueAttachmentUploaded(
            {
                attachmentId,
                claimId,
                key: item.key,
                submissionId: item.submissionId,
                uploadedUrl,
            },
            lease,
        ),
    );
}

type AttachmentResult =
    | { status: 'abandoned' }
    | { code: ActionableQueueFailureCode; status: 'retry' }
    | { code: ActionableQueueFailureCode; status: 'terminal' }
    | { status: 'uploaded'; url: string };

async function ensureAttachmentUploaded(
    item: OperationCompletionQueueItem,
    attachment: OperationCompletionQueueItem['attachments'][number],
    requirementsFingerprint: ScheduleOperationCompletionRequirementsFingerprint,
    lease: OperationCompletionDraftLease,
    isActive: () => boolean,
    dependencies: QueueSyncDependencies,
): Promise<AttachmentResult> {
    if (attachment.uploadedUrl) {
        return { status: 'uploaded', url: attachment.uploadedUrl };
    }
    if (!requestIsStillOwned(item, isActive)) {
        return { status: 'abandoned' };
    }

    let recovered: Awaited<
        ReturnType<typeof recoverFarmOperationCompletionImage>
    >;
    try {
        recovered = await recoverAttachment(
            item,
            attachment,
            requirementsFingerprint,
            dependencies,
        );
    } catch {
        return {
            code: navigator.onLine
                ? 'server_unavailable'
                : 'network_unavailable',
            status: 'retry',
        };
    }
    if (!requestIsStillOwned(item, isActive)) {
        return { status: 'abandoned' };
    }
    if (!recovered.success) {
        return {
            code: terminalFailureCode(recovered.code),
            status: 'terminal',
        };
    }
    if (recovered.imageUrl) {
        return (await persistUploadedAttachment(
            item,
            attachment.id,
            recovered.imageUrl,
            lease,
        ))
            ? { status: 'uploaded', url: recovered.imageUrl }
            : { status: 'abandoned' };
    }

    const pathname = getFarmOperationCompletionSubmissionImagePath(
        item.operationId,
        item.expectedEntityId,
        item.expectedTaskVersionEventId,
        item.submissionId,
        attachment.id,
        attachment.name,
    );
    try {
        const uploaded = await dependencies.uploadImage(
            pathname,
            new File([attachment.blob], attachment.name, {
                lastModified: attachment.lastModified,
                type: attachment.type,
            }),
            {
                access: 'public',
                contentType: attachment.type || undefined,
                handleUploadUrl: '/api/operations/images/upload',
                clientPayload: uploadClientPayload(
                    item,
                    attachment,
                    requirementsFingerprint,
                ),
                multipart: attachment.size > MULTIPART_UPLOAD_THRESHOLD_BYTES,
            },
        );
        if (!requestIsStillOwned(item, isActive)) {
            return { status: 'abandoned' };
        }
        return (await persistUploadedAttachment(
            item,
            attachment.id,
            uploaded.url,
            lease,
        ))
            ? { status: 'uploaded', url: uploaded.url }
            : { status: 'abandoned' };
    } catch {
        if (!requestIsStillOwned(item, isActive)) {
            return { status: 'abandoned' };
        }
        try {
            recovered = await recoverAttachment(
                item,
                attachment,
                requirementsFingerprint,
                dependencies,
            );
        } catch {
            return {
                code: navigator.onLine
                    ? 'upload_failed'
                    : 'network_unavailable',
                status: 'retry',
            };
        }
        if (!requestIsStillOwned(item, isActive)) {
            return { status: 'abandoned' };
        }
        if (!recovered.success) {
            return {
                code: terminalFailureCode(recovered.code),
                status: 'terminal',
            };
        }
        if (!recovered.imageUrl) {
            return {
                code: navigator.onLine
                    ? 'upload_failed'
                    : 'network_unavailable',
                status: 'retry',
            };
        }
        return (await persistUploadedAttachment(
            item,
            attachment.id,
            recovered.imageUrl,
            lease,
        ))
            ? { status: 'uploaded', url: recovered.imageUrl }
            : { status: 'abandoned' };
    }
}

export async function syncClaimedOperationCompletionQueueItem(
    item: OperationCompletionQueueItem,
    lease: OperationCompletionDraftLease,
    isActive: () => boolean,
    dependencies: QueueSyncDependencies = defaultDependencies,
): Promise<OperationCompletionQueueSyncOutcome> {
    if (!item.claim || item.state !== 'syncing' || !isActive()) {
        return { status: 'abandoned' };
    }

    let requirementsFingerprint: ScheduleOperationCompletionRequirementsFingerprint;
    try {
        requirementsFingerprint =
            parseScheduleOperationCompletionRequirementsFingerprint(
                item.requirementsFingerprint,
            );
    } catch {
        return await failTerminally(item, lease, 'invalid_input');
    }

    const imageUrls: string[] = [];
    for (const attachment of item.attachments) {
        const result = await ensureAttachmentUploaded(
            item,
            attachment,
            requirementsFingerprint,
            lease,
            isActive,
            dependencies,
        );
        if (result.status === 'abandoned') {
            return result;
        }
        if (result.status === 'retry') {
            return await scheduleRetry(item, lease, result.code);
        }
        if (result.status === 'terminal') {
            return await failTerminally(item, lease, result.code);
        }
        imageUrls.push(result.url);
    }

    if (!requestIsStillOwned(item, isActive)) {
        return { status: 'abandoned' };
    }
    let completion: Awaited<
        ReturnType<typeof completeFarmOperationWithImageUrls>
    >;
    try {
        completion = await dependencies.complete(
            item.operationId,
            item.expectedEntityId,
            item.expectedTaskVersionEventId,
            requirementsFingerprint,
            imageUrls,
            item.notes.trim() || undefined,
            item.submissionId,
        );
    } catch {
        if (!isActive()) {
            return { status: 'abandoned' };
        }
        return await scheduleRetry(
            item,
            lease,
            navigator.onLine ? 'server_unavailable' : 'network_unavailable',
        );
    }
    if (!requestIsStillOwned(item, isActive)) {
        return { status: 'abandoned' };
    }
    if (!completion.success) {
        if (
            completion.canRetry &&
            completion.retryImageUrls &&
            completion.retryImageUrls.length > 0
        ) {
            const cleared =
                await clearOperationCompletionQueueAttachmentUploads(
                    {
                        claimId: item.claim.claimId,
                        key: item.key,
                        submissionId: item.submissionId,
                        uploadedUrls: completion.retryImageUrls,
                    },
                    lease,
                );
            if (!mutationSucceeded(cleared)) {
                return { status: 'abandoned' };
            }
            return await scheduleRetry(item, lease, 'upload_failed');
        }
        return await failTerminally(
            item,
            lease,
            terminalFailureCode(completion.code),
        );
    }

    const result = await markOperationCompletionQueueServerConfirmed(
        {
            claimId: item.claim.claimId,
            key: item.key,
            serverState: completion.state,
            submissionId: item.submissionId,
        },
        lease,
    );
    return mutationSucceeded(result)
        ? { serverState: completion.state, status: 'confirmed' }
        : { status: 'abandoned' };
}
