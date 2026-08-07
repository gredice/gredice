'use client';

import {
    isCompatibleOperationCompletionDraft,
    isOperationCompletionDraftRecord,
    OPERATION_COMPLETION_DRAFT_MAX_AGE_MS,
    OPERATION_COMPLETION_DRAFT_MAX_BYTES,
    OPERATION_COMPLETION_DRAFT_MAX_COUNT,
    type OperationCompletionDraftLease,
    type OperationCompletionDraftPhotoInput,
    type OperationCompletionDraftScope,
    operationCompletionDraftByteSize,
    operationCompletionDraftLeaseMatches,
    operationCompletionDraftRecordKey,
    operationCompletionQueueRecordKey,
    requestOperationCompletionStoreResult,
    withOperationCompletionOfflineStores,
} from './operationCompletionDraftStore';

export { OPERATION_COMPLETION_QUEUE_STORE_NAME } from './operationCompletionDraftStore';

const OPERATION_COMPLETION_QUEUE_SCHEMA_VERSION = 1;
const OPERATION_COMPLETION_QUEUE_CHANGE_EVENT =
    'gredice:operation-completion-queue-change:v1';
const OPERATION_COMPLETION_QUEUE_CLAIM_MAX_AGE_MS = 2 * 60 * 1000;
const OPERATION_COMPLETION_QUEUE_MAX_LABEL_LENGTH = 200;
const OPERATION_COMPLETION_QUEUE_MAX_URL_LENGTH = 2048;

export type OperationCompletionQueueState =
    | 'queued'
    | 'syncing'
    | 'failed'
    | 'server_confirmed';

export type OperationCompletionQueueFailureCode =
    | 'assignment_changed'
    | 'discarded'
    | 'expired'
    | 'idempotency_conflict'
    | 'invalid_input'
    | 'invalid_status'
    | 'network_unavailable'
    | 'not_authorized'
    | 'not_found'
    | 'server_unavailable'
    | 'task_changed'
    | 'upload_failed';

export type OperationCompletionQueueServerState =
    | 'completed'
    | 'pendingVerification';

export type OperationCompletionQueueAttachment = {
    blob: Blob;
    id: string;
    lastModified: number;
    name: string;
    size: number;
    type: string;
    uploadedUrl: string | null;
};

export type OperationCompletionQueueClaim = {
    claimId: string;
    claimedAt: number;
    expiresAt: number;
};

export type OperationCompletionQueueItem = OperationCompletionDraftScope & {
    attachments: OperationCompletionQueueAttachment[];
    attemptCount: number;
    claim: OperationCompletionQueueClaim | null;
    contentDiscardedAt: number | null;
    createdAt: number;
    expiresAt: number;
    failureCode: OperationCompletionQueueFailureCode | null;
    key: string;
    nextAttemptAt: number | null;
    notes: string;
    operationLabel: string;
    revisionId: string;
    scheduleDateKey: string | null;
    schemaVersion: 1;
    serverConfirmedAt: number | null;
    serverState: OperationCompletionQueueServerState | null;
    state: OperationCompletionQueueState;
    submissionId: string;
    updatedAt: number;
    writerGeneration: string;
};

export type OperationCompletionQueueSummary = OperationCompletionDraftScope & {
    attachmentCount: number;
    attemptCount: number;
    contentAvailable: boolean;
    createdAt: number;
    expiresAt: number;
    failureCode: OperationCompletionQueueFailureCode | null;
    key: string;
    nextAttemptAt: number | null;
    operationLabel: string;
    scheduleDateKey: string | null;
    serverConfirmedAt: number | null;
    serverState: OperationCompletionQueueServerState | null;
    state: OperationCompletionQueueState;
    submissionId: string;
    updatedAt: number;
};

export type OperationCompletionQueueMutationTarget = {
    key: string;
    submissionId: string;
};

export type OperationCompletionQueueHandoffInput =
    OperationCompletionDraftScope & {
        notes: string;
        operationLabel: string;
        photos: OperationCompletionDraftPhotoInput[];
        scheduleDateKey?: string;
    };

export type HandoffOperationCompletionDraftToQueueResult =
    | {
          item: OperationCompletionQueueSummary;
          status: 'enqueued' | 'existing';
      }
    | {
          reason:
              | 'draft_changed'
              | 'draft_count_limit'
              | 'draft_size_limit'
              | 'incompatible'
              | 'invalid_input'
              | 'queue_conflict'
              | 'quota_exceeded'
              | 'server_confirmed'
              | 'session_changed'
              | 'storage_unavailable';
          status: 'error';
      };

export type LoadOperationCompletionQueueItemResult =
    | { item: OperationCompletionQueueItem; status: 'found' }
    | { item: OperationCompletionQueueItem; status: 'expired' }
    | { status: 'missing' }
    | { status: 'session_changed' }
    | { status: 'unavailable' };

export type ListOperationCompletionQueueItemsResult =
    | { items: OperationCompletionQueueSummary[]; status: 'ok' }
    | { status: 'session_changed' }
    | { status: 'unavailable' };

export type ClaimNextOperationCompletionQueueItemResult =
    | { item: OperationCompletionQueueItem; status: 'claimed' }
    | { status: 'empty' }
    | { status: 'session_changed' }
    | { status: 'unavailable' };

export type OperationCompletionQueueMutationResult =
    | { status: 'ok' }
    | { status: 'conflict' }
    | { status: 'session_changed' }
    | { status: 'unavailable' };

type QueueChangeMessage = {
    accountId: string;
    kind: 'changed';
    userId: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
    return value === null || isFiniteNumber(value);
}

function isQueueState(value: unknown): value is OperationCompletionQueueState {
    return (
        value === 'queued' ||
        value === 'syncing' ||
        value === 'failed' ||
        value === 'server_confirmed'
    );
}

function isQueueFailureCode(
    value: unknown,
): value is OperationCompletionQueueFailureCode {
    return (
        value === 'assignment_changed' ||
        value === 'discarded' ||
        value === 'expired' ||
        value === 'idempotency_conflict' ||
        value === 'invalid_input' ||
        value === 'invalid_status' ||
        value === 'network_unavailable' ||
        value === 'not_authorized' ||
        value === 'not_found' ||
        value === 'server_unavailable' ||
        value === 'task_changed' ||
        value === 'upload_failed'
    );
}

function isServerState(
    value: unknown,
): value is OperationCompletionQueueServerState {
    return value === 'completed' || value === 'pendingVerification';
}

function isQueueClaim(value: unknown): value is OperationCompletionQueueClaim {
    return (
        isObject(value) &&
        typeof value.claimId === 'string' &&
        value.claimId.length > 0 &&
        isFiniteNumber(value.claimedAt) &&
        isFiniteNumber(value.expiresAt)
    );
}

function isQueueAttachment(
    value: unknown,
): value is OperationCompletionQueueAttachment {
    return (
        isObject(value) &&
        value.blob instanceof Blob &&
        typeof value.id === 'string' &&
        value.id.length > 0 &&
        isFiniteNumber(value.lastModified) &&
        typeof value.name === 'string' &&
        isFiniteNumber(value.size) &&
        value.size === value.blob.size &&
        typeof value.type === 'string' &&
        (value.uploadedUrl === null || typeof value.uploadedUrl === 'string')
    );
}

function hasValidQueueStateShape(value: Record<string, unknown>) {
    if (!isQueueState(value.state)) {
        return false;
    }
    if (value.state === 'syncing') {
        return isQueueClaim(value.claim) && value.contentDiscardedAt === null;
    }
    if (value.claim !== null) {
        return false;
    }
    if (value.contentDiscardedAt === null) {
        return (
            value.state !== 'server_confirmed' &&
            value.failureCode !== 'discarded' &&
            value.failureCode !== 'expired'
        );
    }
    return (
        Array.isArray(value.attachments) &&
        value.attachments.length === 0 &&
        value.notes === '' &&
        value.operationLabel === '' &&
        value.scheduleDateKey === null &&
        (value.state === 'server_confirmed' ||
            value.failureCode === 'discarded' ||
            value.failureCode === 'expired')
    );
}

export function isOperationCompletionQueueItem(
    value: unknown,
): value is OperationCompletionQueueItem {
    if (!isObject(value)) {
        return false;
    }

    return (
        value.schemaVersion === OPERATION_COMPLETION_QUEUE_SCHEMA_VERSION &&
        hasValidQueueStateShape(value) &&
        typeof value.accountId === 'string' &&
        Array.isArray(value.attachments) &&
        value.attachments.every(isQueueAttachment) &&
        isFiniteNumber(value.attemptCount) &&
        Number.isSafeInteger(value.attemptCount) &&
        value.attemptCount >= 0 &&
        (value.claim === null || isQueueClaim(value.claim)) &&
        isNullableFiniteNumber(value.contentDiscardedAt) &&
        isFiniteNumber(value.createdAt) &&
        isFiniteNumber(value.expectedEntityId) &&
        isFiniteNumber(value.expectedTaskVersionEventId) &&
        isFiniteNumber(value.expiresAt) &&
        (value.failureCode === null || isQueueFailureCode(value.failureCode)) &&
        typeof value.key === 'string' &&
        isNullableFiniteNumber(value.nextAttemptAt) &&
        typeof value.notes === 'string' &&
        isFiniteNumber(value.operationId) &&
        typeof value.operationLabel === 'string' &&
        typeof value.requirementsFingerprint === 'string' &&
        typeof value.revisionId === 'string' &&
        (value.scheduleDateKey === null ||
            typeof value.scheduleDateKey === 'string') &&
        isNullableFiniteNumber(value.serverConfirmedAt) &&
        (value.serverState === null || isServerState(value.serverState)) &&
        isQueueState(value.state) &&
        typeof value.submissionId === 'string' &&
        isFiniteNumber(value.updatedAt) &&
        typeof value.userId === 'string' &&
        typeof value.writerGeneration === 'string'
    );
}

function compatibleQueueItem(
    item: OperationCompletionQueueItem,
    scope: OperationCompletionDraftScope,
) {
    return (
        item.userId === scope.userId &&
        item.accountId === scope.accountId &&
        item.operationId === scope.operationId &&
        item.expectedEntityId === scope.expectedEntityId &&
        item.expectedTaskVersionEventId === scope.expectedTaskVersionEventId &&
        item.requirementsFingerprint === scope.requirementsFingerprint
    );
}

function queueByteSize(item: OperationCompletionQueueItem) {
    const notesBytes = new TextEncoder().encode(item.notes).byteLength;
    return item.attachments.reduce(
        (bytes, attachment) => bytes + attachment.blob.size,
        notesBytes,
    );
}

export function summarizeOperationCompletionQueueItem(
    item: OperationCompletionQueueItem,
) {
    return {
        accountId: item.accountId,
        attachmentCount: item.attachments.length,
        attemptCount: item.attemptCount,
        contentAvailable: item.contentDiscardedAt === null,
        createdAt: item.createdAt,
        expectedEntityId: item.expectedEntityId,
        expectedTaskVersionEventId: item.expectedTaskVersionEventId,
        expiresAt: item.expiresAt,
        failureCode: item.failureCode,
        key: item.key,
        nextAttemptAt: item.nextAttemptAt,
        operationId: item.operationId,
        operationLabel: item.operationLabel,
        requirementsFingerprint: item.requirementsFingerprint,
        scheduleDateKey: item.scheduleDateKey,
        serverConfirmedAt: item.serverConfirmedAt,
        serverState: item.serverState,
        state: item.state,
        submissionId: item.submissionId,
        updatedAt: item.updatedAt,
        userId: item.userId,
    } satisfies OperationCompletionQueueSummary;
}

function newId() {
    return globalThis.crypto.randomUUID();
}

function isQuotaExceeded(error: unknown) {
    return error instanceof DOMException && error.name === 'QuotaExceededError';
}

function normalizedOperationLabel(value: string) {
    const label = value.trim();
    return label.length > 0 &&
        label.length <= OPERATION_COMPLETION_QUEUE_MAX_LABEL_LENGTH
        ? label
        : null;
}

function normalizedScheduleDateKey(value: string | undefined) {
    if (value === undefined) {
        return null;
    }
    return /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : null;
}

function normalizedUploadedUrl(value: string) {
    if (
        value.length === 0 ||
        value.length > OPERATION_COMPLETION_QUEUE_MAX_URL_LENGTH
    ) {
        return null;
    }
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url.toString() : null;
    } catch {
        return null;
    }
}

function hasValidAttachmentIds(photos: OperationCompletionDraftPhotoInput[]) {
    const ids = new Set<string>();
    for (const photo of photos) {
        if (!photo.id || ids.has(photo.id)) {
            return false;
        }
        ids.add(photo.id);
    }
    return true;
}

function queueItemMatchesHandoff(
    item: OperationCompletionQueueItem,
    {
        notes,
        operationLabel,
        photos,
        scheduleDateKey,
    }: {
        notes: string;
        operationLabel: string;
        photos: OperationCompletionDraftPhotoInput[];
        scheduleDateKey: string | null;
    },
) {
    return (
        item.contentDiscardedAt === null &&
        item.notes === notes &&
        item.operationLabel === operationLabel &&
        item.scheduleDateKey === scheduleDateKey &&
        item.attachments.length === photos.length &&
        item.attachments.every((attachment, index) => {
            const photo = photos[index];
            return (
                photo !== undefined &&
                attachment.id === photo.id &&
                attachment.name === photo.file.name &&
                attachment.type === photo.file.type &&
                attachment.size === photo.file.size &&
                attachment.lastModified === photo.file.lastModified
            );
        })
    );
}

function scrubbedQueueItem(
    item: OperationCompletionQueueItem,
    now: number,
    failureCode: 'discarded' | 'expired',
): OperationCompletionQueueItem {
    return {
        ...item,
        attachments: [],
        claim: null,
        contentDiscardedAt: now,
        expiresAt: now + OPERATION_COMPLETION_DRAFT_MAX_AGE_MS,
        failureCode,
        nextAttemptAt: null,
        notes: '',
        operationLabel: '',
        revisionId: newId(),
        scheduleDateKey: null,
        serverConfirmedAt: null,
        serverState: null,
        state: 'failed',
        updatedAt: now,
    };
}

function isHiddenTombstone(item: OperationCompletionQueueItem) {
    return item.contentDiscardedAt !== null && item.failureCode === 'discarded';
}

function isQueueChangeMessage(value: unknown): value is QueueChangeMessage {
    return (
        isObject(value) &&
        value.kind === 'changed' &&
        typeof value.accountId === 'string' &&
        typeof value.userId === 'string'
    );
}

export function notifyOperationCompletionQueueChanged(
    userId: string,
    accountId: string,
) {
    if (typeof window === 'undefined') {
        return;
    }
    const message = {
        accountId,
        kind: 'changed',
        userId,
    } satisfies QueueChangeMessage;
    window.dispatchEvent(
        new CustomEvent(OPERATION_COMPLETION_QUEUE_CHANGE_EVENT, {
            detail: message,
        }),
    );
    if (!('BroadcastChannel' in window)) {
        return;
    }
    try {
        const channel = new BroadcastChannel(
            OPERATION_COMPLETION_QUEUE_CHANGE_EVENT,
        );
        channel.postMessage(message);
        channel.close();
    } catch {
        // IndexedDB remains authoritative when cross-tab messaging is absent.
    }
}

export function subscribeToOperationCompletionQueueChanges(
    userId: string,
    accountId: string,
    listener: () => void,
) {
    if (typeof window === 'undefined') {
        return () => undefined;
    }
    const handleWindowEvent = (event: Event) => {
        if (
            event instanceof CustomEvent &&
            isQueueChangeMessage(event.detail) &&
            event.detail.userId === userId &&
            event.detail.accountId === accountId
        ) {
            listener();
        }
    };
    const handleChannelMessage = (event: MessageEvent<unknown>) => {
        if (
            isQueueChangeMessage(event.data) &&
            event.data.userId === userId &&
            event.data.accountId === accountId
        ) {
            listener();
        }
    };
    window.addEventListener(
        OPERATION_COMPLETION_QUEUE_CHANGE_EVENT,
        handleWindowEvent,
    );
    let channel: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
        try {
            channel = new BroadcastChannel(
                OPERATION_COMPLETION_QUEUE_CHANGE_EVENT,
            );
            channel.addEventListener('message', handleChannelMessage);
        } catch {
            channel = null;
        }
    }
    return () => {
        window.removeEventListener(
            OPERATION_COMPLETION_QUEUE_CHANGE_EVENT,
            handleWindowEvent,
        );
        channel?.removeEventListener('message', handleChannelMessage);
        channel?.close();
    };
}

export async function handoffOperationCompletionDraftToQueue(
    {
        notes,
        operationLabel: rawOperationLabel,
        photos,
        scheduleDateKey: rawScheduleDateKey,
        ...scope
    }: OperationCompletionQueueHandoffInput,
    {
        expectedDraftRevisionId,
        lease,
    }: {
        expectedDraftRevisionId?: string | null;
        lease: OperationCompletionDraftLease;
    },
): Promise<HandoffOperationCompletionDraftToQueueResult> {
    const operationLabel = normalizedOperationLabel(rawOperationLabel);
    const scheduleDateKey = normalizedScheduleDateKey(rawScheduleDateKey);
    if (lease.userId !== scope.userId) {
        return { reason: 'session_changed', status: 'error' };
    }
    if (
        !operationLabel ||
        !hasValidAttachmentIds(photos) ||
        (rawScheduleDateKey !== undefined && !scheduleDateKey)
    ) {
        return { reason: 'invalid_input', status: 'error' };
    }
    try {
        const result = await withOperationCompletionOfflineStores(
            'readwrite',
            async ({ drafts, queue }) => {
                if (
                    !(await operationCompletionDraftLeaseMatches(drafts, lease))
                ) {
                    return {
                        reason: 'session_changed',
                        status: 'error',
                    } satisfies HandoffOperationCompletionDraftToQueueResult;
                }
                const now = Date.now();
                const key = operationCompletionQueueRecordKey(scope);
                const queuedValue: unknown =
                    await requestOperationCompletionStoreResult(queue.get(key));
                if (isOperationCompletionQueueItem(queuedValue)) {
                    if (queuedValue.expiresAt <= now) {
                        if (queuedValue.contentDiscardedAt !== null) {
                            await requestOperationCompletionStoreResult(
                                queue.delete(key),
                            );
                        } else {
                            const expiredItem = scrubbedQueueItem(
                                queuedValue,
                                now,
                                'expired',
                            );
                            await requestOperationCompletionStoreResult(
                                queue.put(expiredItem),
                            );
                            return {
                                item: summarizeOperationCompletionQueueItem(
                                    expiredItem,
                                ),
                                status: 'existing',
                            } satisfies HandoffOperationCompletionDraftToQueueResult;
                        }
                    } else if (!compatibleQueueItem(queuedValue, scope)) {
                        return {
                            reason: 'incompatible',
                            status: 'error',
                        } satisfies HandoffOperationCompletionDraftToQueueResult;
                    } else if (queuedValue.state === 'server_confirmed') {
                        return {
                            reason: 'server_confirmed',
                            status: 'error',
                        } satisfies HandoffOperationCompletionDraftToQueueResult;
                    } else if (
                        !isHiddenTombstone(queuedValue) &&
                        queueItemMatchesHandoff(queuedValue, {
                            notes,
                            operationLabel,
                            photos,
                            scheduleDateKey,
                        })
                    ) {
                        return {
                            item: summarizeOperationCompletionQueueItem(
                                queuedValue,
                            ),
                            status: 'existing',
                        } satisfies HandoffOperationCompletionDraftToQueueResult;
                    } else {
                        return {
                            reason: 'queue_conflict',
                            status: 'error',
                        } satisfies HandoffOperationCompletionDraftToQueueResult;
                    }
                } else if (queuedValue !== undefined) {
                    await requestOperationCompletionStoreResult(
                        queue.delete(key),
                    );
                }

                const draftKey = operationCompletionDraftRecordKey(scope);
                const draftValue: unknown =
                    await requestOperationCompletionStoreResult(
                        drafts.get(draftKey),
                    );
                let draft = isOperationCompletionDraftRecord(draftValue)
                    ? draftValue
                    : null;
                if (draftValue !== undefined && !draft) {
                    if (expectedDraftRevisionId !== undefined) {
                        return {
                            reason: 'draft_changed',
                            status: 'error',
                        } satisfies HandoffOperationCompletionDraftToQueueResult;
                    }
                    await requestOperationCompletionStoreResult(
                        drafts.delete(draftKey),
                    );
                }
                if (draft && draft.expiresAt <= now) {
                    await requestOperationCompletionStoreResult(
                        drafts.delete(draftKey),
                    );
                    draft = null;
                }
                if (draft) {
                    if (
                        draft.writerGeneration !== lease.generation ||
                        !isCompatibleOperationCompletionDraft(draft, scope)
                    ) {
                        return {
                            reason: 'incompatible',
                            status: 'error',
                        } satisfies HandoffOperationCompletionDraftToQueueResult;
                    }
                    if (draft.serverConfirmedAt !== null) {
                        return {
                            reason: 'server_confirmed',
                            status: 'error',
                        } satisfies HandoffOperationCompletionDraftToQueueResult;
                    }
                }
                if (
                    expectedDraftRevisionId !== undefined &&
                    (draft?.revisionId ?? null) !== expectedDraftRevisionId
                ) {
                    return {
                        reason: 'draft_changed',
                        status: 'error',
                    } satisfies HandoffOperationCompletionDraftToQueueResult;
                }

                const draftValues: unknown[] =
                    await requestOperationCompletionStoreResult(
                        drafts.getAll(),
                    );
                const queueValues: unknown[] =
                    await requestOperationCompletionStoreResult(queue.getAll());
                let ownerCount = 0;
                let ownerBytes = 0;
                for (const value of draftValues) {
                    if (
                        !isOperationCompletionDraftRecord(value) ||
                        value.userId !== scope.userId ||
                        value.accountId !== scope.accountId ||
                        value.key === draftKey ||
                        value.serverConfirmedAt !== null
                    ) {
                        continue;
                    }
                    if (value.expiresAt <= now) {
                        drafts.delete(value.key);
                        continue;
                    }
                    ownerCount += 1;
                    ownerBytes += operationCompletionDraftByteSize(value);
                }
                for (const value of queueValues) {
                    if (
                        !isOperationCompletionQueueItem(value) ||
                        value.userId !== scope.userId ||
                        value.accountId !== scope.accountId ||
                        value.key === key ||
                        value.contentDiscardedAt !== null
                    ) {
                        continue;
                    }
                    if (value.expiresAt <= now) {
                        await requestOperationCompletionStoreResult(
                            queue.put(scrubbedQueueItem(value, now, 'expired')),
                        );
                        continue;
                    }
                    ownerCount += 1;
                    ownerBytes += queueByteSize(value);
                }
                if (ownerCount >= OPERATION_COMPLETION_DRAFT_MAX_COUNT) {
                    return {
                        reason: 'draft_count_limit',
                        status: 'error',
                    } satisfies HandoffOperationCompletionDraftToQueueResult;
                }

                const item: OperationCompletionQueueItem = {
                    ...scope,
                    attachments: photos.map(({ file, id }) => ({
                        blob: file,
                        id,
                        lastModified: file.lastModified,
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        uploadedUrl: null,
                    })),
                    attemptCount: 0,
                    claim: null,
                    contentDiscardedAt: null,
                    createdAt: draft?.createdAt ?? now,
                    expiresAt: now + OPERATION_COMPLETION_DRAFT_MAX_AGE_MS,
                    failureCode: null,
                    key,
                    nextAttemptAt: now,
                    notes,
                    operationLabel,
                    revisionId: newId(),
                    scheduleDateKey,
                    schemaVersion: OPERATION_COMPLETION_QUEUE_SCHEMA_VERSION,
                    serverConfirmedAt: null,
                    serverState: null,
                    state: 'queued',
                    submissionId: newId(),
                    updatedAt: now,
                    writerGeneration: lease.generation,
                };
                if (
                    ownerBytes + queueByteSize(item) >
                    OPERATION_COMPLETION_DRAFT_MAX_BYTES
                ) {
                    return {
                        reason: 'draft_size_limit',
                        status: 'error',
                    } satisfies HandoffOperationCompletionDraftToQueueResult;
                }
                await requestOperationCompletionStoreResult(queue.put(item));
                if (draftValue !== undefined) {
                    await requestOperationCompletionStoreResult(
                        drafts.delete(draftKey),
                    );
                }
                return {
                    item: summarizeOperationCompletionQueueItem(item),
                    status: 'enqueued',
                } satisfies HandoffOperationCompletionDraftToQueueResult;
            },
        );
        if (result.status === 'enqueued' || result.status === 'existing') {
            notifyOperationCompletionQueueChanged(
                scope.userId,
                scope.accountId,
            );
        }
        return result;
    } catch (error) {
        return {
            reason: isQuotaExceeded(error)
                ? 'quota_exceeded'
                : 'storage_unavailable',
            status: 'error',
        };
    }
}

export async function loadOperationCompletionQueueItem(
    scope: OperationCompletionDraftScope,
    lease: OperationCompletionDraftLease,
): Promise<LoadOperationCompletionQueueItemResult> {
    if (lease.userId !== scope.userId) {
        return { status: 'session_changed' };
    }
    let changed = false;
    try {
        const result = await withOperationCompletionOfflineStores(
            'readwrite',
            async ({ drafts, queue }) => {
                if (
                    !(await operationCompletionDraftLeaseMatches(drafts, lease))
                ) {
                    return { status: 'session_changed' } as const;
                }
                const key = operationCompletionQueueRecordKey(scope);
                const value: unknown =
                    await requestOperationCompletionStoreResult(queue.get(key));
                if (value === undefined) {
                    return { status: 'missing' } as const;
                }
                if (!isOperationCompletionQueueItem(value)) {
                    await requestOperationCompletionStoreResult(
                        queue.delete(key),
                    );
                    changed = true;
                    return { status: 'missing' } as const;
                }
                if (value.writerGeneration !== lease.generation) {
                    await requestOperationCompletionStoreResult(
                        queue.delete(key),
                    );
                    changed = true;
                    return { status: 'missing' } as const;
                }
                const now = Date.now();
                if (value.expiresAt <= now) {
                    if (value.contentDiscardedAt !== null) {
                        await requestOperationCompletionStoreResult(
                            queue.delete(key),
                        );
                        changed = true;
                        return { status: 'missing' } as const;
                    }
                    const expiredItem = scrubbedQueueItem(
                        value,
                        now,
                        'expired',
                    );
                    await requestOperationCompletionStoreResult(
                        queue.put(expiredItem),
                    );
                    changed = true;
                    return { item: expiredItem, status: 'expired' } as const;
                }
                if (!compatibleQueueItem(value, scope)) {
                    return { status: 'missing' } as const;
                }
                return { item: value, status: 'found' } as const;
            },
        );
        if (changed) {
            notifyOperationCompletionQueueChanged(
                scope.userId,
                scope.accountId,
            );
        }
        return result;
    } catch {
        return { status: 'unavailable' };
    }
}

export async function listOperationCompletionQueueItems(
    owner: { accountId: string; userId: string },
    lease: OperationCompletionDraftLease,
): Promise<ListOperationCompletionQueueItemsResult> {
    if (lease.userId !== owner.userId) {
        return { status: 'session_changed' };
    }
    let changed = false;
    try {
        const result = await withOperationCompletionOfflineStores(
            'readwrite',
            async ({ drafts, queue }) => {
                if (
                    !(await operationCompletionDraftLeaseMatches(drafts, lease))
                ) {
                    return { status: 'session_changed' } as const;
                }
                const now = Date.now();
                const values: unknown[] =
                    await requestOperationCompletionStoreResult(queue.getAll());
                const items: OperationCompletionQueueSummary[] = [];
                for (const value of values) {
                    if (!isOperationCompletionQueueItem(value)) {
                        if (isObject(value) && typeof value.key === 'string') {
                            queue.delete(value.key);
                            changed = true;
                        }
                        continue;
                    }
                    if (
                        value.userId !== owner.userId ||
                        value.accountId !== owner.accountId
                    ) {
                        continue;
                    }
                    if (value.writerGeneration !== lease.generation) {
                        queue.delete(value.key);
                        changed = true;
                        continue;
                    }
                    if (value.expiresAt <= now) {
                        if (value.contentDiscardedAt !== null) {
                            queue.delete(value.key);
                        } else {
                            queue.put(scrubbedQueueItem(value, now, 'expired'));
                        }
                        changed = true;
                        continue;
                    }
                    if (!isHiddenTombstone(value)) {
                        items.push(
                            summarizeOperationCompletionQueueItem(value),
                        );
                    }
                }
                items.sort((left, right) => left.createdAt - right.createdAt);
                return { items, status: 'ok' } as const;
            },
        );
        if (changed) {
            notifyOperationCompletionQueueChanged(
                owner.userId,
                owner.accountId,
            );
        }
        return result;
    } catch {
        return { status: 'unavailable' };
    }
}

export async function claimNextOperationCompletionQueueItem(
    owner: { accountId: string; userId: string },
    {
        claimId,
        lease,
    }: {
        claimId: string;
        lease: OperationCompletionDraftLease;
    },
): Promise<ClaimNextOperationCompletionQueueItemResult> {
    if (lease.userId !== owner.userId) {
        return { status: 'session_changed' };
    }
    if (!claimId) {
        return { status: 'unavailable' };
    }
    let changed = false;
    try {
        const result = await withOperationCompletionOfflineStores(
            'readwrite',
            async ({ drafts, queue }) => {
                if (
                    !(await operationCompletionDraftLeaseMatches(drafts, lease))
                ) {
                    return { status: 'session_changed' } as const;
                }
                const now = Date.now();
                const values: unknown[] =
                    await requestOperationCompletionStoreResult(queue.getAll());
                const candidates: OperationCompletionQueueItem[] = [];
                for (const value of values) {
                    if (
                        !isOperationCompletionQueueItem(value) ||
                        value.userId !== owner.userId ||
                        value.accountId !== owner.accountId
                    ) {
                        continue;
                    }
                    if (value.writerGeneration !== lease.generation) {
                        queue.delete(value.key);
                        changed = true;
                        continue;
                    }
                    if (value.expiresAt <= now) {
                        if (value.contentDiscardedAt !== null) {
                            queue.delete(value.key);
                        } else {
                            queue.put(scrubbedQueueItem(value, now, 'expired'));
                        }
                        changed = true;
                        continue;
                    }
                    let candidate = value;
                    if (
                        candidate.state === 'syncing' &&
                        candidate.claim &&
                        candidate.claim.expiresAt <= now
                    ) {
                        candidate = {
                            ...candidate,
                            claim: null,
                            nextAttemptAt: now,
                            revisionId: newId(),
                            state: 'queued',
                            updatedAt: now,
                        };
                        await requestOperationCompletionStoreResult(
                            queue.put(candidate),
                        );
                        changed = true;
                    }
                    if (
                        candidate.state === 'queued' &&
                        candidate.contentDiscardedAt === null &&
                        (candidate.nextAttemptAt === null ||
                            candidate.nextAttemptAt <= now)
                    ) {
                        candidates.push(candidate);
                    }
                }
                candidates.sort(
                    (left, right) => left.createdAt - right.createdAt,
                );
                const candidate = candidates[0];
                if (!candidate) {
                    return { status: 'empty' } as const;
                }
                const claimed: OperationCompletionQueueItem = {
                    ...candidate,
                    attemptCount: candidate.attemptCount + 1,
                    claim: {
                        claimId,
                        claimedAt: now,
                        expiresAt:
                            now + OPERATION_COMPLETION_QUEUE_CLAIM_MAX_AGE_MS,
                    },
                    failureCode: null,
                    nextAttemptAt: null,
                    revisionId: newId(),
                    state: 'syncing',
                    updatedAt: now,
                };
                await requestOperationCompletionStoreResult(queue.put(claimed));
                changed = true;
                return { item: claimed, status: 'claimed' } as const;
            },
        );
        if (changed) {
            notifyOperationCompletionQueueChanged(
                owner.userId,
                owner.accountId,
            );
        }
        return result;
    } catch {
        return { status: 'unavailable' };
    }
}

async function mutateQueueItem(
    target: OperationCompletionQueueMutationTarget,
    lease: OperationCompletionDraftLease,
    mutation: (
        item: OperationCompletionQueueItem,
    ) => OperationCompletionQueueItem | null | 'conflict',
): Promise<OperationCompletionQueueMutationResult> {
    try {
        const result = await withOperationCompletionOfflineStores(
            'readwrite',
            async ({ drafts, queue }) => {
                if (
                    !(await operationCompletionDraftLeaseMatches(drafts, lease))
                ) {
                    return { status: 'session_changed' } as const;
                }
                const value: unknown =
                    await requestOperationCompletionStoreResult(
                        queue.get(target.key),
                    );
                if (
                    !isOperationCompletionQueueItem(value) ||
                    value.submissionId !== target.submissionId ||
                    value.userId !== lease.userId ||
                    value.writerGeneration !== lease.generation
                ) {
                    return { status: 'conflict' } as const;
                }
                const next = mutation(value);
                if (next === 'conflict') {
                    return { status: 'conflict' } as const;
                }
                if (next === null) {
                    await requestOperationCompletionStoreResult(
                        queue.delete(target.key),
                    );
                } else {
                    await requestOperationCompletionStoreResult(
                        queue.put(next),
                    );
                }
                return {
                    accountId: value.accountId,
                    status: 'ok',
                    userId: value.userId,
                } as const;
            },
        );
        if (result.status === 'ok') {
            notifyOperationCompletionQueueChanged(
                result.userId,
                result.accountId,
            );
            return { status: 'ok' };
        }
        return result;
    } catch {
        return { status: 'unavailable' };
    }
}

export async function markOperationCompletionQueueAttachmentUploaded(
    target: OperationCompletionQueueMutationTarget & {
        attachmentId: string;
        claimId: string;
        uploadedUrl: string;
    },
    lease: OperationCompletionDraftLease,
) {
    const uploadedUrl = normalizedUploadedUrl(target.uploadedUrl);
    if (!uploadedUrl) {
        return {
            status: 'conflict',
        } satisfies OperationCompletionQueueMutationResult;
    }
    return mutateQueueItem(target, lease, (item) => {
        if (
            item.state !== 'syncing' ||
            item.claim?.claimId !== target.claimId
        ) {
            return 'conflict';
        }
        const attachmentIndex = item.attachments.findIndex(
            (attachment) => attachment.id === target.attachmentId,
        );
        if (attachmentIndex < 0) {
            return 'conflict';
        }
        const attachments = item.attachments.map((attachment, index) =>
            index === attachmentIndex
                ? { ...attachment, uploadedUrl }
                : attachment,
        );
        return {
            ...item,
            attachments,
            revisionId: newId(),
            updatedAt: Date.now(),
        };
    });
}

export async function clearOperationCompletionQueueAttachmentUploads(
    target: OperationCompletionQueueMutationTarget & {
        claimId: string;
        uploadedUrls: string[];
    },
    lease: OperationCompletionDraftLease,
) {
    const uploadedUrls = new Set(
        target.uploadedUrls
            .map(normalizedUploadedUrl)
            .filter((value): value is string => value !== null),
    );
    if (
        uploadedUrls.size === 0 ||
        uploadedUrls.size !== target.uploadedUrls.length
    ) {
        return {
            status: 'conflict',
        } satisfies OperationCompletionQueueMutationResult;
    }
    return mutateQueueItem(target, lease, (item) => {
        if (
            item.state !== 'syncing' ||
            item.claim?.claimId !== target.claimId
        ) {
            return 'conflict';
        }
        const matchedUrls = new Set<string>();
        const attachments = item.attachments.map((attachment) => {
            if (
                attachment.uploadedUrl &&
                uploadedUrls.has(attachment.uploadedUrl)
            ) {
                matchedUrls.add(attachment.uploadedUrl);
                return { ...attachment, uploadedUrl: null };
            }
            return attachment;
        });
        if (matchedUrls.size !== uploadedUrls.size) {
            return 'conflict';
        }
        return {
            ...item,
            attachments,
            revisionId: newId(),
            updatedAt: Date.now(),
        };
    });
}

export async function renewOperationCompletionQueueClaim(
    target: OperationCompletionQueueMutationTarget & {
        claimId: string;
    },
    lease: OperationCompletionDraftLease,
) {
    return mutateQueueItem(target, lease, (item) => {
        const now = Date.now();
        if (
            item.state !== 'syncing' ||
            item.claim?.claimId !== target.claimId ||
            item.claim.expiresAt <= now
        ) {
            return 'conflict';
        }
        return {
            ...item,
            claim: {
                ...item.claim,
                expiresAt: now + OPERATION_COMPLETION_QUEUE_CLAIM_MAX_AGE_MS,
            },
            revisionId: newId(),
            updatedAt: now,
        };
    });
}

export async function releaseOperationCompletionQueueClaimForRetry(
    target: OperationCompletionQueueMutationTarget & {
        claimId: string;
        failureCode: Exclude<
            OperationCompletionQueueFailureCode,
            'discarded' | 'expired'
        >;
        nextAttemptAt: number;
    },
    lease: OperationCompletionDraftLease,
) {
    return mutateQueueItem(target, lease, (item) => {
        if (
            item.state !== 'syncing' ||
            item.claim?.claimId !== target.claimId ||
            !isQueueFailureCode(target.failureCode) ||
            !Number.isFinite(target.nextAttemptAt)
        ) {
            return 'conflict';
        }
        return {
            ...item,
            claim: null,
            failureCode: target.failureCode,
            nextAttemptAt: target.nextAttemptAt,
            revisionId: newId(),
            state: 'queued',
            updatedAt: Date.now(),
        };
    });
}

export async function markOperationCompletionQueueFailed(
    target: OperationCompletionQueueMutationTarget & {
        claimId: string;
        failureCode: Exclude<
            OperationCompletionQueueFailureCode,
            'discarded' | 'expired'
        >;
    },
    lease: OperationCompletionDraftLease,
) {
    return mutateQueueItem(target, lease, (item) => {
        if (
            item.state !== 'syncing' ||
            item.claim?.claimId !== target.claimId ||
            !isQueueFailureCode(target.failureCode)
        ) {
            return 'conflict';
        }
        return {
            ...item,
            claim: null,
            failureCode: target.failureCode,
            nextAttemptAt: null,
            revisionId: newId(),
            state: 'failed',
            updatedAt: Date.now(),
        };
    });
}

export async function retryOperationCompletionQueueItem(
    target: OperationCompletionQueueMutationTarget,
    lease: OperationCompletionDraftLease,
) {
    return mutateQueueItem(target, lease, (item) => {
        if (
            item.contentDiscardedAt !== null ||
            (item.state !== 'failed' &&
                !(item.state === 'queued' && item.failureCode !== null))
        ) {
            return 'conflict';
        }
        const now = Date.now();
        return {
            ...item,
            attemptCount: 0,
            failureCode: null,
            nextAttemptAt: now,
            revisionId: newId(),
            state: 'queued',
            updatedAt: now,
        };
    });
}

export async function markOperationCompletionQueueServerConfirmed(
    target: OperationCompletionQueueMutationTarget & {
        claimId: string;
        serverState?: OperationCompletionQueueServerState;
    },
    lease: OperationCompletionDraftLease,
) {
    return mutateQueueItem(target, lease, (item) => {
        if (
            item.state !== 'syncing' ||
            item.claim?.claimId !== target.claimId
        ) {
            return 'conflict';
        }
        if (target.serverState && !isServerState(target.serverState)) {
            return 'conflict';
        }
        const now = Date.now();
        return {
            ...item,
            attachments: [],
            claim: null,
            contentDiscardedAt: now,
            expiresAt: now + OPERATION_COMPLETION_DRAFT_MAX_AGE_MS,
            failureCode: null,
            nextAttemptAt: null,
            notes: '',
            operationLabel: '',
            revisionId: newId(),
            scheduleDateKey: null,
            serverConfirmedAt: now,
            serverState: target.serverState ?? null,
            state: 'server_confirmed',
            updatedAt: now,
        };
    });
}

export async function discardOperationCompletionQueueItem(
    target: OperationCompletionQueueMutationTarget,
    lease: OperationCompletionDraftLease,
) {
    return mutateQueueItem(target, lease, (item) => {
        if (item.state === 'syncing') {
            return 'conflict';
        }
        return null;
    });
}
