'use client';

export const FARM_OFFLINE_DATABASE_NAME = 'gredice-farm-offline';
export const FARM_OFFLINE_DATABASE_VERSION = 2;
export const OPERATION_COMPLETION_DRAFT_STORE_NAME =
    'operation-completion-drafts';
export const OPERATION_COMPLETION_QUEUE_STORE_NAME =
    'operation-completion-queue';
export const OPERATION_COMPLETION_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const OPERATION_COMPLETION_DRAFT_MAX_COUNT = 5;
export const OPERATION_COMPLETION_DRAFT_MAX_BYTES = 100 * 1024 * 1024;

const OPERATION_COMPLETION_DRAFT_SCHEMA_VERSION = 1;
const OPERATION_COMPLETION_QUEUE_SCHEMA_VERSION = 1;
const OPERATION_COMPLETION_DRAFT_GENERATION_KIND =
    'operation-completion-draft-generation';
const OPERATION_COMPLETION_DRAFT_REVOCATION_KIND =
    'operation-completion-draft-revocation';
const OPERATION_COMPLETION_DRAFT_LOGOUT_EVENT =
    'gredice:operation-completion-draft-logout:v1';
const OPERATION_COMPLETION_DRAFT_LOGOUT_NONCE_PREFIX =
    'gredice:farm:operation-completion-draft-logout:v1:';
const OPERATION_COMPLETION_DRAFT_LOGGED_OUT_SESSION_PREFIX =
    'gredice:farm:operation-completion-draft-logged-out-session:v1:';
const OPERATION_COMPLETION_DRAFT_INITIAL_LOGOUT_NONCE = 'initial';
const OPERATION_COMPLETION_DRAFT_REVOCATION_MAX_AGE_MS =
    31 * 24 * 60 * 60 * 1000;

export type OperationCompletionDraftScope = {
    accountId: string;
    expectedEntityId: number;
    expectedTaskVersionEventId: number;
    operationId: number;
    requirementsFingerprint: string;
    userId: string;
};

export type OperationCompletionDraftPhotoInput = {
    file: File;
    id: string;
};

export type OperationCompletionDraftPhoto = {
    blob: Blob;
    id: string;
    lastModified: number;
    name: string;
    size: number;
    type: string;
};

export type OperationCompletionDraftLease = {
    generation: string;
    logoutNonce: string;
    sessionIncarnation: string;
    userId: string;
};

export type OperationCompletionDraft = {
    accountId: string;
    createdAt: number;
    draftId: string;
    expectedEntityId: number;
    expectedTaskVersionEventId: number;
    expiresAt: number;
    key: string;
    notes: string;
    operationId: number;
    photos: OperationCompletionDraftPhoto[];
    requirementsFingerprint: string;
    revisionId: string;
    schemaVersion: 1;
    serverConfirmedAt: number | null;
    updatedAt: number;
    userId: string;
    writerGeneration: string;
};

type OperationCompletionDraftGeneration = {
    generation: string;
    key: string;
    kind: typeof OPERATION_COMPLETION_DRAFT_GENERATION_KIND;
    logoutNonce: string;
    schemaVersion: 1;
    sessionIncarnation: string | null;
    updatedAt: number;
    userId: string;
};

type OperationCompletionDraftRevocation = {
    expiresAt: number;
    key: string;
    kind: typeof OPERATION_COMPLETION_DRAFT_REVOCATION_KIND;
    revokedAt: number;
    schemaVersion: 1;
    sessionIncarnation: string;
    userId: string;
};

export type AcquireOperationCompletionDraftLeaseResult =
    | { lease: OperationCompletionDraftLease; status: 'ready' }
    | { status: 'session_changed' }
    | { status: 'unavailable' };

type AcquireOperationCompletionDraftLeaseAttempt =
    | { lease: OperationCompletionDraftLease; status: 'ready' }
    | { status: 'nonce_changed' }
    | { status: 'session_changed' };

export type LoadOperationCompletionDraftResult =
    | { draft: OperationCompletionDraft; status: 'found' }
    | {
          reason: 'invalid_record' | 'not_found';
          status: 'missing';
      }
    | {
          reason: 'incompatible';
          revisionId: string;
          status: 'missing';
      }
    | { status: 'expired' }
    | { status: 'session_changed' }
    | { status: 'unavailable' };

export type SaveOperationCompletionDraftResult =
    | {
          action: 'discarded' | 'saved';
          draftId: string | null;
          revisionId: string | null;
          status: 'ok';
      }
    | {
          reason:
              | 'draft_count_limit'
              | 'draft_changed'
              | 'draft_size_limit'
              | 'incompatible'
              | 'quota_exceeded'
              | 'session_changed'
              | 'storage_unavailable';
          status: 'error';
      };

export type OperationCompletionDraftMutationResult =
    | { status: 'ok' }
    | { status: 'conflict' }
    | { status: 'session_changed' }
    | { status: 'unavailable' };

export type PurgeOperationCompletionDraftsResult =
    | { deletedCount: number; status: 'ok' }
    | { status: 'unavailable' };

type SaveOperationCompletionDraftInput = OperationCompletionDraftScope & {
    notes: string;
    photos: OperationCompletionDraftPhotoInput[];
};

type SaveOperationCompletionDraftOptions = {
    expectedRevisionId?: string | null;
    lease?: OperationCompletionDraftLease;
};

type DiscardOperationCompletionDraftOptions = {
    expectedRevisionId?: string;
    lease?: OperationCompletionDraftLease;
};

function operationCompletionDraftKey({
    accountId,
    operationId,
    userId,
}: Pick<
    OperationCompletionDraftScope,
    'accountId' | 'operationId' | 'userId'
>) {
    return JSON.stringify([
        OPERATION_COMPLETION_DRAFT_SCHEMA_VERSION,
        userId,
        accountId,
        operationId,
    ]);
}

export function operationCompletionQueueRecordKey({
    accountId,
    operationId,
    userId,
}: Pick<
    OperationCompletionDraftScope,
    'accountId' | 'operationId' | 'userId'
>) {
    return JSON.stringify([
        'operation-completion-queue',
        OPERATION_COMPLETION_QUEUE_SCHEMA_VERSION,
        userId,
        accountId,
        operationId,
    ]);
}

function operationCompletionDraftGenerationKey(userId: string) {
    return JSON.stringify([
        OPERATION_COMPLETION_DRAFT_GENERATION_KIND,
        OPERATION_COMPLETION_DRAFT_SCHEMA_VERSION,
        userId,
    ]);
}

function operationCompletionDraftRevocationKey(
    userId: string,
    sessionIncarnation: string,
) {
    return JSON.stringify([
        OPERATION_COMPLETION_DRAFT_REVOCATION_KIND,
        OPERATION_COMPLETION_DRAFT_SCHEMA_VERSION,
        userId,
        sessionIncarnation,
    ]);
}

function operationCompletionDraftLogoutNonceKey(userId: string) {
    return `${OPERATION_COMPLETION_DRAFT_LOGOUT_NONCE_PREFIX}${userId}`;
}

function operationCompletionDraftLoggedOutSessionKey(
    userId: string,
    sessionIncarnation: string,
) {
    return `${OPERATION_COMPLETION_DRAFT_LOGGED_OUT_SESSION_PREFIX}${userId}:${sessionIncarnation}`;
}

function defaultOperationCompletionDraftSessionIncarnation(userId: string) {
    return `legacy:${userId}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isOperationCompletionDraftGeneration(
    value: unknown,
): value is OperationCompletionDraftGeneration {
    if (!isObject(value)) {
        return false;
    }

    return (
        value.kind === OPERATION_COMPLETION_DRAFT_GENERATION_KIND &&
        value.schemaVersion === OPERATION_COMPLETION_DRAFT_SCHEMA_VERSION &&
        typeof value.generation === 'string' &&
        typeof value.key === 'string' &&
        typeof value.logoutNonce === 'string' &&
        (value.sessionIncarnation === null ||
            typeof value.sessionIncarnation === 'string') &&
        isFiniteNumber(value.updatedAt) &&
        typeof value.userId === 'string'
    );
}

function isOperationCompletionDraftRevocation(
    value: unknown,
): value is OperationCompletionDraftRevocation {
    if (!isObject(value)) {
        return false;
    }

    return (
        value.kind === OPERATION_COMPLETION_DRAFT_REVOCATION_KIND &&
        value.schemaVersion === OPERATION_COMPLETION_DRAFT_SCHEMA_VERSION &&
        isFiniteNumber(value.expiresAt) &&
        typeof value.key === 'string' &&
        isFiniteNumber(value.revokedAt) &&
        typeof value.sessionIncarnation === 'string' &&
        typeof value.userId === 'string'
    );
}

function isOperationCompletionDraftPhoto(
    value: unknown,
): value is OperationCompletionDraftPhoto {
    if (!isObject(value)) {
        return false;
    }

    return (
        value.blob instanceof Blob &&
        typeof value.id === 'string' &&
        isFiniteNumber(value.lastModified) &&
        typeof value.name === 'string' &&
        isFiniteNumber(value.size) &&
        value.size === value.blob.size &&
        typeof value.type === 'string'
    );
}

export function isOperationCompletionDraftRecord(
    value: unknown,
): value is OperationCompletionDraft {
    if (!isObject(value)) {
        return false;
    }

    return (
        value.schemaVersion === OPERATION_COMPLETION_DRAFT_SCHEMA_VERSION &&
        typeof value.accountId === 'string' &&
        isFiniteNumber(value.createdAt) &&
        typeof value.draftId === 'string' &&
        isFiniteNumber(value.expectedEntityId) &&
        isFiniteNumber(value.expectedTaskVersionEventId) &&
        isFiniteNumber(value.expiresAt) &&
        typeof value.key === 'string' &&
        typeof value.notes === 'string' &&
        isFiniteNumber(value.operationId) &&
        Array.isArray(value.photos) &&
        value.photos.every(isOperationCompletionDraftPhoto) &&
        typeof value.requirementsFingerprint === 'string' &&
        typeof value.revisionId === 'string' &&
        (value.serverConfirmedAt === null ||
            isFiniteNumber(value.serverConfirmedAt)) &&
        isFiniteNumber(value.updatedAt) &&
        typeof value.userId === 'string' &&
        typeof value.writerGeneration === 'string'
    );
}

export function isCompatibleOperationCompletionDraft(
    draft: OperationCompletionDraft,
    scope: OperationCompletionDraftScope,
) {
    return (
        draft.userId === scope.userId &&
        draft.accountId === scope.accountId &&
        draft.operationId === scope.operationId &&
        draft.expectedEntityId === scope.expectedEntityId &&
        draft.expectedTaskVersionEventId === scope.expectedTaskVersionEventId &&
        draft.requirementsFingerprint === scope.requirementsFingerprint
    );
}

type OperationCompletionQueueRecordForDraftStore = {
    accountId: string;
    attachments: Array<{ blob: Blob; size: number }>;
    contentDiscardedAt: number | null;
    expiresAt: number;
    key: string;
    notes: string;
    operationId: number;
    schemaVersion: 1;
    userId: string;
    writerGeneration: string;
};

function isOperationCompletionQueueRecordForDraftStore(
    value: unknown,
): value is OperationCompletionQueueRecordForDraftStore {
    if (!isObject(value)) {
        return false;
    }

    return (
        value.schemaVersion === OPERATION_COMPLETION_QUEUE_SCHEMA_VERSION &&
        typeof value.accountId === 'string' &&
        Array.isArray(value.attachments) &&
        value.attachments.every(
            (attachment) =>
                isObject(attachment) &&
                attachment.blob instanceof Blob &&
                isFiniteNumber(attachment.size) &&
                attachment.size === attachment.blob.size,
        ) &&
        (value.contentDiscardedAt === null ||
            isFiniteNumber(value.contentDiscardedAt)) &&
        isFiniteNumber(value.expiresAt) &&
        typeof value.key === 'string' &&
        typeof value.notes === 'string' &&
        isFiniteNumber(value.operationId) &&
        typeof value.userId === 'string' &&
        typeof value.writerGeneration === 'string'
    );
}

function operationCompletionQueueByteSizeForDraftStore(
    item: OperationCompletionQueueRecordForDraftStore,
) {
    const notesBytes = new TextEncoder().encode(item.notes).byteLength;
    return item.attachments.reduce(
        (bytes, attachment) => bytes + attachment.blob.size,
        notesBytes,
    );
}

function scrubExpiredOperationCompletionQueueRecordForDraftStore(
    item: OperationCompletionQueueRecordForDraftStore,
    now: number,
) {
    return {
        ...item,
        attachments: [],
        claim: null,
        contentDiscardedAt: now,
        expiresAt: now + OPERATION_COMPLETION_DRAFT_MAX_AGE_MS,
        failureCode: 'expired',
        nextAttemptAt: null,
        notes: '',
        operationLabel: '',
        revisionId: newDraftId(),
        scheduleDateKey: null,
        serverConfirmedAt: null,
        serverState: null,
        state: 'failed',
        updatedAt: now,
    };
}

function getIndexedDb() {
    if (typeof window === 'undefined' || !window.indexedDB) {
        return null;
    }

    return window.indexedDB;
}

function readOperationCompletionDraftLogoutNonce(userId: string) {
    if (typeof window === 'undefined') {
        return null;
    }
    try {
        return (
            window.localStorage.getItem(
                operationCompletionDraftLogoutNonceKey(userId),
            ) ?? OPERATION_COMPLETION_DRAFT_INITIAL_LOGOUT_NONCE
        );
    } catch {
        return null;
    }
}

export function captureOperationCompletionDraftLogoutNonce(userId: string) {
    return readOperationCompletionDraftLogoutNonce(userId);
}

function readOperationCompletionDraftLoggedOutSession(
    userId: string,
    sessionIncarnation: string,
) {
    if (typeof window === 'undefined') {
        return false;
    }
    try {
        const key = operationCompletionDraftLoggedOutSessionKey(
            userId,
            sessionIncarnation,
        );
        const expiresAt = Number(window.localStorage.getItem(key));
        if (!Number.isFinite(expiresAt)) {
            return false;
        }
        if (expiresAt <= Date.now()) {
            window.localStorage.removeItem(key);
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

function recordOperationCompletionDraftLoggedOutSession(
    userId: string,
    sessionIncarnation: string,
) {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        const now = Date.now();
        const userPrefix = `${OPERATION_COMPLETION_DRAFT_LOGGED_OUT_SESSION_PREFIX}${userId}:`;
        for (let index = window.localStorage.length - 1; index >= 0; index--) {
            const key = window.localStorage.key(index);
            if (!key?.startsWith(userPrefix)) {
                continue;
            }
            const expiresAt = Number(window.localStorage.getItem(key));
            if (!Number.isFinite(expiresAt) || expiresAt <= now) {
                window.localStorage.removeItem(key);
            }
        }
        window.localStorage.setItem(
            operationCompletionDraftLoggedOutSessionKey(
                userId,
                sessionIncarnation,
            ),
            (now + OPERATION_COMPLETION_DRAFT_REVOCATION_MAX_AGE_MS).toString(),
        );
    } catch {
        // The IndexedDB generation record remains the durable session fence.
    }
}

function rotateOperationCompletionDraftLogoutNonce(userId: string) {
    const logoutNonce = newDraftId();
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(
                operationCompletionDraftLogoutNonceKey(userId),
                logoutNonce,
            );
        } catch {
            // IndexedDB generation rotation remains the durable fence.
        }
    }
    return logoutNonce;
}

function isCurrentOperationCompletionDraftLogoutNonce(
    lease: OperationCompletionDraftLease,
) {
    const currentLogoutNonce = readOperationCompletionDraftLogoutNonce(
        lease.userId,
    );
    return (
        (currentLogoutNonce === null ||
            currentLogoutNonce === lease.logoutNonce) &&
        !readOperationCompletionDraftLoggedOutSession(
            lease.userId,
            lease.sessionIncarnation,
        )
    );
}

function isOperationCompletionDraftLogoutMessage(
    value: unknown,
): value is { sessionIncarnation: string; userId: string } {
    return (
        isObject(value) &&
        value.kind === 'logout' &&
        typeof value.sessionIncarnation === 'string' &&
        typeof value.userId === 'string'
    );
}

function broadcastOperationCompletionDraftLogout(
    userId: string,
    sessionIncarnation: string,
) {
    if (typeof window === 'undefined') {
        return;
    }
    const message = { kind: 'logout', sessionIncarnation, userId };
    window.dispatchEvent(
        new CustomEvent(OPERATION_COMPLETION_DRAFT_LOGOUT_EVENT, {
            detail: message,
        }),
    );
    if (!('BroadcastChannel' in window)) {
        return;
    }
    try {
        const channel = new BroadcastChannel(
            OPERATION_COMPLETION_DRAFT_LOGOUT_EVENT,
        );
        channel.postMessage(message);
        channel.close();
    } catch {
        // The IndexedDB generation fence does not depend on the channel.
    }
}

export function subscribeToOperationCompletionDraftLogout(
    userId: string,
    sessionIncarnation: string,
    listener: () => void,
) {
    if (typeof window === 'undefined') {
        return () => undefined;
    }
    const handleWindowEvent = (event: Event) => {
        if (
            event instanceof CustomEvent &&
            isOperationCompletionDraftLogoutMessage(event.detail) &&
            event.detail.userId === userId &&
            event.detail.sessionIncarnation === sessionIncarnation
        ) {
            listener();
        }
    };
    const handleChannelMessage = (event: MessageEvent<unknown>) => {
        if (
            isOperationCompletionDraftLogoutMessage(event.data) &&
            event.data.userId === userId &&
            event.data.sessionIncarnation === sessionIncarnation
        ) {
            listener();
        }
    };
    const handleStorage = (event: StorageEvent) => {
        if (
            event.key ===
                operationCompletionDraftLoggedOutSessionKey(
                    userId,
                    sessionIncarnation,
                ) &&
            event.newValue !== null
        ) {
            listener();
        }
    };
    window.addEventListener(
        OPERATION_COMPLETION_DRAFT_LOGOUT_EVENT,
        handleWindowEvent,
    );
    window.addEventListener('storage', handleStorage);
    let channel: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
        try {
            channel = new BroadcastChannel(
                OPERATION_COMPLETION_DRAFT_LOGOUT_EVENT,
            );
            channel.addEventListener('message', handleChannelMessage);
        } catch {
            channel = null;
        }
    }
    return () => {
        window.removeEventListener(
            OPERATION_COMPLETION_DRAFT_LOGOUT_EVENT,
            handleWindowEvent,
        );
        window.removeEventListener('storage', handleStorage);
        channel?.removeEventListener('message', handleChannelMessage);
        channel?.close();
    };
}

export function operationCompletionDraftRecordKey(
    scope: Pick<
        OperationCompletionDraftScope,
        'accountId' | 'operationId' | 'userId'
    >,
) {
    return operationCompletionDraftKey(scope);
}

export function requestOperationCompletionStoreResult<Result>(
    request: IDBRequest<Result>,
) {
    return new Promise<Result>((resolve, reject) => {
        request.addEventListener('success', () => resolve(request.result), {
            once: true,
        });
        request.addEventListener(
            'error',
            () =>
                reject(request.error ?? new Error('IndexedDB request failed')),
            { once: true },
        );
    });
}

function transactionComplete(transaction: IDBTransaction) {
    return new Promise<void>((resolve, reject) => {
        transaction.addEventListener('complete', () => resolve(), {
            once: true,
        });
        transaction.addEventListener(
            'abort',
            () =>
                reject(
                    transaction.error ??
                        new Error('IndexedDB transaction aborted'),
                ),
            { once: true },
        );
        transaction.addEventListener(
            'error',
            () =>
                reject(
                    transaction.error ??
                        new Error('IndexedDB transaction failed'),
                ),
            { once: true },
        );
    });
}

export function openFarmOfflineDatabase() {
    const indexedDb = getIndexedDb();
    if (!indexedDb) {
        return Promise.reject(new Error('IndexedDB unavailable'));
    }

    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDb.open(
            FARM_OFFLINE_DATABASE_NAME,
            FARM_OFFLINE_DATABASE_VERSION,
        );
        request.addEventListener(
            'upgradeneeded',
            () => {
                const database = request.result;
                if (
                    !database.objectStoreNames.contains(
                        OPERATION_COMPLETION_DRAFT_STORE_NAME,
                    )
                ) {
                    database.createObjectStore(
                        OPERATION_COMPLETION_DRAFT_STORE_NAME,
                        { keyPath: 'key' },
                    );
                }
                if (
                    !database.objectStoreNames.contains(
                        OPERATION_COMPLETION_QUEUE_STORE_NAME,
                    )
                ) {
                    database.createObjectStore(
                        OPERATION_COMPLETION_QUEUE_STORE_NAME,
                        { keyPath: 'key' },
                    );
                }
            },
            { once: true },
        );
        request.addEventListener('success', () => resolve(request.result), {
            once: true,
        });
        request.addEventListener(
            'blocked',
            () => reject(new Error('IndexedDB upgrade blocked')),
            { once: true },
        );
        request.addEventListener(
            'error',
            () => reject(request.error ?? new Error('IndexedDB open failed')),
            { once: true },
        );
    });
}

async function withDraftStore<Result>(
    mode: IDBTransactionMode,
    runWithStore: (store: IDBObjectStore) => Promise<Result>,
) {
    const database = await openFarmOfflineDatabase();
    try {
        const transaction = database.transaction(
            OPERATION_COMPLETION_DRAFT_STORE_NAME,
            mode,
        );
        const completion = transactionComplete(transaction);
        try {
            const result = await runWithStore(
                transaction.objectStore(OPERATION_COMPLETION_DRAFT_STORE_NAME),
            );
            await completion;
            return result;
        } catch (error) {
            try {
                transaction.abort();
            } catch {
                // The transaction may already be complete or aborted.
            }
            await completion.catch(() => undefined);
            throw error;
        }
    } finally {
        database.close();
    }
}

export async function withOperationCompletionOfflineStores<Result>(
    mode: IDBTransactionMode,
    runWithStores: (stores: {
        drafts: IDBObjectStore;
        queue: IDBObjectStore;
    }) => Promise<Result>,
) {
    const database = await openFarmOfflineDatabase();
    try {
        const transaction = database.transaction(
            [
                OPERATION_COMPLETION_DRAFT_STORE_NAME,
                OPERATION_COMPLETION_QUEUE_STORE_NAME,
            ],
            mode,
        );
        const completion = transactionComplete(transaction);
        try {
            const result = await runWithStores({
                drafts: transaction.objectStore(
                    OPERATION_COMPLETION_DRAFT_STORE_NAME,
                ),
                queue: transaction.objectStore(
                    OPERATION_COMPLETION_QUEUE_STORE_NAME,
                ),
            });
            await completion;
            return result;
        } catch (error) {
            try {
                transaction.abort();
            } catch {
                // The transaction may already be complete or aborted.
            }
            await completion.catch(() => undefined);
            throw error;
        }
    } finally {
        database.close();
    }
}

export function operationCompletionDraftByteSize(
    draft: OperationCompletionDraft,
) {
    const notesBytes = new TextEncoder().encode(draft.notes).byteLength;
    return draft.photos.reduce(
        (bytes, photo) => bytes + photo.blob.size,
        notesBytes,
    );
}

function isQuotaExceeded(error: unknown) {
    return error instanceof DOMException && error.name === 'QuotaExceededError';
}

function newDraftId() {
    return globalThis.crypto.randomUUID();
}

class OperationCompletionDraftConflictError extends Error {}

async function operationCompletionDraftSessionIsRevoked(
    store: IDBObjectStore,
    userId: string,
    sessionIncarnation: string,
) {
    const key = operationCompletionDraftRevocationKey(
        userId,
        sessionIncarnation,
    );
    const storedValue: unknown = await requestOperationCompletionStoreResult(
        store.get(key),
    );
    if (storedValue === undefined) {
        return false;
    }
    if (!isOperationCompletionDraftRevocation(storedValue)) {
        await requestOperationCompletionStoreResult(store.delete(key));
        return false;
    }
    if (storedValue.expiresAt <= Date.now()) {
        await requestOperationCompletionStoreResult(store.delete(key));
        return false;
    }
    return true;
}

export async function operationCompletionDraftLeaseMatches(
    store: IDBObjectStore,
    lease: OperationCompletionDraftLease,
) {
    if (!isCurrentOperationCompletionDraftLogoutNonce(lease)) {
        return false;
    }
    if (
        await operationCompletionDraftSessionIsRevoked(
            store,
            lease.userId,
            lease.sessionIncarnation,
        )
    ) {
        return false;
    }
    const storedValue: unknown = await requestOperationCompletionStoreResult(
        store.get(operationCompletionDraftGenerationKey(lease.userId)),
    );
    return (
        isOperationCompletionDraftGeneration(storedValue) &&
        storedValue.generation === lease.generation &&
        storedValue.logoutNonce === lease.logoutNonce &&
        storedValue.sessionIncarnation === lease.sessionIncarnation &&
        storedValue.userId === lease.userId
    );
}

export async function acquireOperationCompletionDraftLease(
    userId: string,
    capturedLogoutNonce = captureOperationCompletionDraftLogoutNonce(userId),
    sessionIncarnation = defaultOperationCompletionDraftSessionIncarnation(
        userId,
    ),
): Promise<AcquireOperationCompletionDraftLeaseResult> {
    const currentLogoutNonce = readOperationCompletionDraftLogoutNonce(userId);
    if (
        readOperationCompletionDraftLoggedOutSession(userId, sessionIncarnation)
    ) {
        return { status: 'session_changed' };
    }
    let logoutNonce =
        currentLogoutNonce ??
        capturedLogoutNonce ??
        OPERATION_COMPLETION_DRAFT_INITIAL_LOGOUT_NONCE;

    try {
        for (let attempt = 0; attempt < 3; attempt++) {
            const result =
                await withOperationCompletionOfflineStores<AcquireOperationCompletionDraftLeaseAttempt>(
                    'readwrite',
                    async ({ drafts, queue }) => {
                        const key =
                            operationCompletionDraftGenerationKey(userId);
                        const storedValue: unknown =
                            await requestOperationCompletionStoreResult(
                                drafts.get(key),
                            );
                        const latestLogoutNonce =
                            readOperationCompletionDraftLogoutNonce(userId);
                        if (
                            latestLogoutNonce !== null &&
                            latestLogoutNonce !== logoutNonce
                        ) {
                            return { status: 'nonce_changed' };
                        }
                        if (
                            readOperationCompletionDraftLoggedOutSession(
                                userId,
                                sessionIncarnation,
                            ) ||
                            (await operationCompletionDraftSessionIsRevoked(
                                drafts,
                                userId,
                                sessionIncarnation,
                            ))
                        ) {
                            return { status: 'session_changed' };
                        }
                        if (
                            isOperationCompletionDraftGeneration(storedValue) &&
                            storedValue.logoutNonce === logoutNonce &&
                            storedValue.sessionIncarnation ===
                                sessionIncarnation
                        ) {
                            return {
                                lease: {
                                    generation: storedValue.generation,
                                    logoutNonce: storedValue.logoutNonce,
                                    sessionIncarnation,
                                    userId,
                                },
                                status: 'ready',
                            };
                        }

                        const generation = newDraftId();
                        const storedDraftValues: unknown[] =
                            await requestOperationCompletionStoreResult(
                                drafts.getAll(),
                            );
                        const storedQueueValues: unknown[] =
                            await requestOperationCompletionStoreResult(
                                queue.getAll(),
                            );
                        for (const value of storedDraftValues) {
                            if (isOperationCompletionDraftRevocation(value)) {
                                if (value.expiresAt <= Date.now()) {
                                    drafts.delete(value.key);
                                }
                                continue;
                            }
                            if (
                                isOperationCompletionDraftRecord(value) &&
                                value.userId === userId
                            ) {
                                drafts.delete(value.key);
                            }
                        }
                        for (const value of storedQueueValues) {
                            if (
                                isObject(value) &&
                                value.userId === userId &&
                                typeof value.key === 'string'
                            ) {
                                queue.delete(value.key);
                            }
                        }
                        await requestOperationCompletionStoreResult(
                            drafts.put({
                                generation,
                                key,
                                kind: OPERATION_COMPLETION_DRAFT_GENERATION_KIND,
                                logoutNonce,
                                schemaVersion:
                                    OPERATION_COMPLETION_DRAFT_SCHEMA_VERSION,
                                sessionIncarnation,
                                updatedAt: Date.now(),
                                userId,
                            }),
                        );
                        return {
                            lease: {
                                generation,
                                logoutNonce,
                                sessionIncarnation,
                                userId,
                            },
                            status: 'ready',
                        };
                    },
                );
            if (result.status === 'session_changed') {
                return result;
            }
            if (result.status === 'ready') {
                if (
                    isCurrentOperationCompletionDraftLogoutNonce(result.lease)
                ) {
                    return result;
                }
                if (
                    readOperationCompletionDraftLoggedOutSession(
                        userId,
                        sessionIncarnation,
                    )
                ) {
                    return { status: 'session_changed' };
                }
            }

            const latestLogoutNonce =
                readOperationCompletionDraftLogoutNonce(userId);
            if (
                latestLogoutNonce === null ||
                latestLogoutNonce === logoutNonce
            ) {
                return { status: 'unavailable' };
            }
            logoutNonce = latestLogoutNonce;
        }
        return { status: 'unavailable' };
    } catch {
        return { status: 'unavailable' };
    }
}

async function resolveOperationCompletionDraftLease(
    userId: string,
    lease?: OperationCompletionDraftLease,
): Promise<AcquireOperationCompletionDraftLeaseResult> {
    if (lease) {
        if (lease.userId !== userId) {
            return { status: 'session_changed' };
        }
        return { lease, status: 'ready' };
    }
    return acquireOperationCompletionDraftLease(userId);
}

export async function loadOperationCompletionDraft(
    scope: OperationCompletionDraftScope,
    lease?: OperationCompletionDraftLease,
): Promise<LoadOperationCompletionDraftResult> {
    const leaseResult = await resolveOperationCompletionDraftLease(
        scope.userId,
        lease,
    );
    if (leaseResult.status !== 'ready') {
        return { status: leaseResult.status };
    }
    try {
        return await withOperationCompletionOfflineStores(
            'readwrite',
            async ({ drafts }) => {
                if (
                    !(await operationCompletionDraftLeaseMatches(
                        drafts,
                        leaseResult.lease,
                    ))
                ) {
                    return {
                        status: 'session_changed',
                    } satisfies LoadOperationCompletionDraftResult;
                }
                const key = operationCompletionDraftKey(scope);
                const storedValue: unknown =
                    await requestOperationCompletionStoreResult(
                        drafts.get(key),
                    );
                if (storedValue === undefined) {
                    return { reason: 'not_found', status: 'missing' };
                }
                if (!isOperationCompletionDraftRecord(storedValue)) {
                    await requestOperationCompletionStoreResult(
                        drafts.delete(key),
                    );
                    return { reason: 'invalid_record', status: 'missing' };
                }
                if (storedValue.expiresAt <= Date.now()) {
                    await requestOperationCompletionStoreResult(
                        drafts.delete(key),
                    );
                    if (storedValue.serverConfirmedAt !== null) {
                        return { reason: 'not_found', status: 'missing' };
                    }
                    return { status: 'expired' };
                }
                if (
                    storedValue.writerGeneration !==
                    leaseResult.lease.generation
                ) {
                    await requestOperationCompletionStoreResult(
                        drafts.delete(key),
                    );
                    return { reason: 'not_found', status: 'missing' };
                }
                if (storedValue.serverConfirmedAt !== null) {
                    return { reason: 'not_found', status: 'missing' };
                }
                if (!isCompatibleOperationCompletionDraft(storedValue, scope)) {
                    return {
                        reason: 'incompatible',
                        revisionId: storedValue.revisionId,
                        status: 'missing',
                    };
                }

                return { draft: storedValue, status: 'found' };
            },
        );
    } catch {
        return { status: 'unavailable' };
    }
}

export async function saveOperationCompletionDraft(
    { notes, photos, ...scope }: SaveOperationCompletionDraftInput,
    { expectedRevisionId, lease }: SaveOperationCompletionDraftOptions = {},
): Promise<SaveOperationCompletionDraftResult> {
    const leaseResult = await resolveOperationCompletionDraftLease(
        scope.userId,
        lease,
    );
    if (leaseResult.status !== 'ready') {
        return {
            reason:
                leaseResult.status === 'session_changed'
                    ? 'session_changed'
                    : 'storage_unavailable',
            status: 'error',
        };
    }
    try {
        return await withOperationCompletionOfflineStores(
            'readwrite',
            async ({ drafts: draftStore, queue: queueStore }) => {
                if (
                    !(await operationCompletionDraftLeaseMatches(
                        draftStore,
                        leaseResult.lease,
                    ))
                ) {
                    return { reason: 'session_changed', status: 'error' };
                }
                const now = Date.now();
                const key = operationCompletionDraftKey(scope);
                const queuedValue: unknown =
                    await requestOperationCompletionStoreResult(
                        queueStore.get(
                            operationCompletionQueueRecordKey(scope),
                        ),
                    );
                if (queuedValue !== undefined) {
                    if (
                        !isOperationCompletionQueueRecordForDraftStore(
                            queuedValue,
                        )
                    ) {
                        return { reason: 'incompatible', status: 'error' };
                    }
                    if (
                        queuedValue.writerGeneration !==
                        leaseResult.lease.generation
                    ) {
                        await requestOperationCompletionStoreResult(
                            queueStore.delete(queuedValue.key),
                        );
                    } else if (queuedValue.expiresAt <= now) {
                        if (queuedValue.contentDiscardedAt !== null) {
                            await requestOperationCompletionStoreResult(
                                queueStore.delete(queuedValue.key),
                            );
                        } else {
                            await requestOperationCompletionStoreResult(
                                queueStore.put(
                                    scrubExpiredOperationCompletionQueueRecordForDraftStore(
                                        queuedValue,
                                        now,
                                    ),
                                ),
                            );
                            return { reason: 'incompatible', status: 'error' };
                        }
                    } else {
                        return { reason: 'incompatible', status: 'error' };
                    }
                }

                if (!notes.trim() && photos.length === 0) {
                    const storedValue: unknown =
                        await requestOperationCompletionStoreResult(
                            draftStore.get(key),
                        );
                    if (storedValue === undefined) {
                        return {
                            action: 'discarded',
                            draftId: null,
                            revisionId: null,
                            status: 'ok',
                        };
                    }
                    if (!isOperationCompletionDraftRecord(storedValue)) {
                        if (expectedRevisionId !== undefined) {
                            return { reason: 'draft_changed', status: 'error' };
                        }
                        await requestOperationCompletionStoreResult(
                            draftStore.delete(key),
                        );
                        return {
                            action: 'discarded',
                            draftId: null,
                            revisionId: null,
                            status: 'ok',
                        };
                    }
                    if (storedValue.expiresAt <= now) {
                        await requestOperationCompletionStoreResult(
                            draftStore.delete(key),
                        );
                        return {
                            action: 'discarded',
                            draftId: null,
                            revisionId: null,
                            status: 'ok',
                        };
                    }
                    if (
                        storedValue.serverConfirmedAt !== null ||
                        storedValue.writerGeneration !==
                            leaseResult.lease.generation ||
                        !isCompatibleOperationCompletionDraft(
                            storedValue,
                            scope,
                        )
                    ) {
                        return { reason: 'incompatible', status: 'error' };
                    }
                    if (
                        expectedRevisionId !== undefined &&
                        expectedRevisionId !== storedValue.revisionId
                    ) {
                        return { reason: 'draft_changed', status: 'error' };
                    }
                    await requestOperationCompletionStoreResult(
                        draftStore.delete(key),
                    );
                    return {
                        action: 'discarded',
                        draftId: null,
                        revisionId: null,
                        status: 'ok',
                    };
                }

                const storedValues: unknown[] =
                    await requestOperationCompletionStoreResult(
                        draftStore.getAll(),
                    );
                const storedQueueValues: unknown[] =
                    await requestOperationCompletionStoreResult(
                        queueStore.getAll(),
                    );
                const drafts: OperationCompletionDraft[] = [];
                const ownerQueueItems: OperationCompletionQueueRecordForDraftStore[] =
                    [];
                const serverConfirmedKeys = new Set<string>();

                for (const storedValue of storedValues) {
                    if (!isOperationCompletionDraftRecord(storedValue)) {
                        if (isOperationCompletionDraftGeneration(storedValue)) {
                            continue;
                        }
                        if (isOperationCompletionDraftRevocation(storedValue)) {
                            if (storedValue.expiresAt <= now) {
                                draftStore.delete(storedValue.key);
                            }
                            continue;
                        }
                        if (
                            isObject(storedValue) &&
                            typeof storedValue.key === 'string'
                        ) {
                            draftStore.delete(storedValue.key);
                        }
                        continue;
                    }
                    if (storedValue.expiresAt <= now) {
                        draftStore.delete(storedValue.key);
                        continue;
                    }
                    if (
                        storedValue.userId === scope.userId &&
                        storedValue.writerGeneration !==
                            leaseResult.lease.generation
                    ) {
                        draftStore.delete(storedValue.key);
                        continue;
                    }
                    if (storedValue.serverConfirmedAt !== null) {
                        serverConfirmedKeys.add(storedValue.key);
                        continue;
                    }
                    drafts.push(storedValue);
                }

                for (const storedValue of storedQueueValues) {
                    if (
                        !isOperationCompletionQueueRecordForDraftStore(
                            storedValue,
                        )
                    ) {
                        continue;
                    }
                    if (storedValue.expiresAt <= now) {
                        if (storedValue.contentDiscardedAt !== null) {
                            queueStore.delete(storedValue.key);
                        } else {
                            queueStore.put(
                                scrubExpiredOperationCompletionQueueRecordForDraftStore(
                                    storedValue,
                                    now,
                                ),
                            );
                        }
                        continue;
                    }
                    if (
                        storedValue.userId === scope.userId &&
                        storedValue.writerGeneration !==
                            leaseResult.lease.generation
                    ) {
                        queueStore.delete(storedValue.key);
                        continue;
                    }
                    if (
                        storedValue.userId === scope.userId &&
                        storedValue.accountId === scope.accountId &&
                        storedValue.contentDiscardedAt === null
                    ) {
                        ownerQueueItems.push(storedValue);
                    }
                }

                if (serverConfirmedKeys.has(key)) {
                    return { reason: 'incompatible', status: 'error' };
                }
                const existingDraft = drafts.find((draft) => draft.key === key);
                if (
                    existingDraft &&
                    !isCompatibleOperationCompletionDraft(existingDraft, scope)
                ) {
                    return { reason: 'incompatible', status: 'error' };
                }
                if (
                    expectedRevisionId !== undefined &&
                    (existingDraft?.revisionId ?? null) !== expectedRevisionId
                ) {
                    return { reason: 'draft_changed', status: 'error' };
                }

                const ownerDrafts = drafts.filter(
                    (draft) =>
                        draft.userId === scope.userId &&
                        draft.accountId === scope.accountId,
                );
                if (
                    !existingDraft &&
                    ownerDrafts.length + ownerQueueItems.length >=
                        OPERATION_COMPLETION_DRAFT_MAX_COUNT
                ) {
                    return { reason: 'draft_count_limit', status: 'error' };
                }

                const draft: OperationCompletionDraft = {
                    ...scope,
                    createdAt: existingDraft?.createdAt ?? now,
                    draftId: existingDraft?.draftId ?? newDraftId(),
                    expiresAt: now + OPERATION_COMPLETION_DRAFT_MAX_AGE_MS,
                    key,
                    notes,
                    photos: photos.map(({ file, id }) => ({
                        blob: file,
                        id,
                        lastModified: file.lastModified,
                        name: file.name,
                        size: file.size,
                        type: file.type,
                    })),
                    revisionId: newDraftId(),
                    schemaVersion: OPERATION_COMPLETION_DRAFT_SCHEMA_VERSION,
                    serverConfirmedAt: null,
                    updatedAt: now,
                    writerGeneration: leaseResult.lease.generation,
                };
                const otherOwnerBytes = ownerDrafts.reduce(
                    (bytes, ownerDraft) =>
                        ownerDraft.key === key
                            ? bytes
                            : bytes +
                              operationCompletionDraftByteSize(ownerDraft),
                    0,
                );
                const ownerQueueBytes = ownerQueueItems.reduce(
                    (bytes, item) =>
                        bytes +
                        operationCompletionQueueByteSizeForDraftStore(item),
                    0,
                );
                if (
                    otherOwnerBytes +
                        ownerQueueBytes +
                        operationCompletionDraftByteSize(draft) >
                    OPERATION_COMPLETION_DRAFT_MAX_BYTES
                ) {
                    return { reason: 'draft_size_limit', status: 'error' };
                }

                await requestOperationCompletionStoreResult(
                    draftStore.put(draft),
                );
                return {
                    action: 'saved',
                    draftId: draft.draftId,
                    revisionId: draft.revisionId,
                    status: 'ok',
                };
            },
        );
    } catch (error) {
        return {
            reason: isQuotaExceeded(error)
                ? 'quota_exceeded'
                : 'storage_unavailable',
            status: 'error',
        };
    }
}

export async function discardOperationCompletionDraft(
    scope: Pick<
        OperationCompletionDraftScope,
        'accountId' | 'operationId' | 'userId'
    >,
    { expectedRevisionId, lease }: DiscardOperationCompletionDraftOptions = {},
): Promise<OperationCompletionDraftMutationResult> {
    const leaseResult = await resolveOperationCompletionDraftLease(
        scope.userId,
        lease,
    );
    if (leaseResult.status !== 'ready') {
        return { status: leaseResult.status };
    }
    try {
        const result = await withDraftStore('readwrite', async (store) => {
            if (
                !(await operationCompletionDraftLeaseMatches(
                    store,
                    leaseResult.lease,
                ))
            ) {
                return {
                    status: 'session_changed',
                } satisfies OperationCompletionDraftMutationResult;
            }
            const key = operationCompletionDraftKey(scope);
            const storedValue: unknown =
                await requestOperationCompletionStoreResult(store.get(key));
            if (storedValue === undefined) {
                return;
            }
            if (!isOperationCompletionDraftRecord(storedValue)) {
                if (expectedRevisionId !== undefined) {
                    throw new OperationCompletionDraftConflictError();
                }
                await requestOperationCompletionStoreResult(store.delete(key));
                return;
            }
            if (storedValue.writerGeneration !== leaseResult.lease.generation) {
                throw new OperationCompletionDraftConflictError();
            }
            if (
                storedValue.serverConfirmedAt !== null &&
                storedValue.expiresAt > Date.now()
            ) {
                return;
            }
            if (
                expectedRevisionId !== undefined &&
                storedValue.revisionId !== expectedRevisionId
            ) {
                throw new OperationCompletionDraftConflictError();
            }
            await requestOperationCompletionStoreResult(store.delete(key));
        });
        if (result?.status === 'session_changed') {
            return result;
        }
        return { status: 'ok' };
    } catch (error) {
        if (error instanceof OperationCompletionDraftConflictError) {
            return { status: 'conflict' };
        }
        return { status: 'unavailable' };
    }
}

export async function markOperationCompletionDraftServerConfirmed(
    scope: OperationCompletionDraftScope,
    lease?: OperationCompletionDraftLease,
): Promise<OperationCompletionDraftMutationResult> {
    const leaseResult = await resolveOperationCompletionDraftLease(
        scope.userId,
        lease,
    );
    if (leaseResult.status !== 'ready') {
        return { status: leaseResult.status };
    }
    try {
        const result = await withOperationCompletionOfflineStores(
            'readwrite',
            async ({ drafts, queue }) => {
                if (
                    !(await operationCompletionDraftLeaseMatches(
                        drafts,
                        leaseResult.lease,
                    ))
                ) {
                    return {
                        status: 'session_changed',
                    } satisfies OperationCompletionDraftMutationResult;
                }
                const queuedValue: unknown =
                    await requestOperationCompletionStoreResult(
                        queue.get(operationCompletionQueueRecordKey(scope)),
                    );
                if (queuedValue !== undefined) {
                    return {
                        status: 'conflict',
                    } satisfies OperationCompletionDraftMutationResult;
                }
                const key = operationCompletionDraftKey(scope);
                const storedValue: unknown =
                    await requestOperationCompletionStoreResult(
                        drafts.get(key),
                    );
                const now = Date.now();
                const existingDraft = isOperationCompletionDraftRecord(
                    storedValue,
                )
                    ? storedValue
                    : null;
                await requestOperationCompletionStoreResult(
                    drafts.put({
                        ...scope,
                        createdAt: existingDraft?.createdAt ?? now,
                        draftId: existingDraft?.draftId ?? newDraftId(),
                        expiresAt: now + OPERATION_COMPLETION_DRAFT_MAX_AGE_MS,
                        key,
                        notes: '',
                        photos: [],
                        revisionId: newDraftId(),
                        schemaVersion:
                            OPERATION_COMPLETION_DRAFT_SCHEMA_VERSION,
                        serverConfirmedAt: now,
                        updatedAt: now,
                        writerGeneration: leaseResult.lease.generation,
                    }),
                );
            },
        );
        if (result?.status === 'session_changed') {
            return result;
        }
        if (result?.status === 'conflict') {
            return result;
        }
        return { status: 'ok' };
    } catch {
        return { status: 'unavailable' };
    }
}

export async function purgeOperationCompletionDraftsForUser(
    userId: string,
    sessionIncarnation = defaultOperationCompletionDraftSessionIncarnation(
        userId,
    ),
): Promise<PurgeOperationCompletionDraftsResult> {
    recordOperationCompletionDraftLoggedOutSession(userId, sessionIncarnation);
    broadcastOperationCompletionDraftLogout(userId, sessionIncarnation);
    try {
        const deletedCount = await withOperationCompletionOfflineStores(
            'readwrite',
            async ({ drafts, queue }) => {
                const storedDraftValues: unknown[] =
                    await requestOperationCompletionStoreResult(
                        drafts.getAll(),
                    );
                const storedQueueValues: unknown[] =
                    await requestOperationCompletionStoreResult(queue.getAll());
                const now = Date.now();
                const activeDifferentSession = storedDraftValues.find(
                    (
                        storedValue,
                    ): storedValue is OperationCompletionDraftGeneration =>
                        isOperationCompletionDraftGeneration(storedValue) &&
                        storedValue.userId === userId &&
                        storedValue.sessionIncarnation !== null &&
                        storedValue.sessionIncarnation !== sessionIncarnation,
                );
                const currentGeneration =
                    activeDifferentSession &&
                    !storedDraftValues.some(
                        (storedValue) =>
                            isOperationCompletionDraftRevocation(storedValue) &&
                            storedValue.userId === userId &&
                            storedValue.sessionIncarnation ===
                                activeDifferentSession.sessionIncarnation &&
                            storedValue.expiresAt > now,
                    )
                        ? activeDifferentSession
                        : null;
                let count = 0;
                for (const storedValue of storedDraftValues) {
                    if (
                        isOperationCompletionDraftGeneration(storedValue) &&
                        storedValue.userId === userId
                    ) {
                        continue;
                    }
                    if (isOperationCompletionDraftRevocation(storedValue)) {
                        if (storedValue.expiresAt <= now) {
                            drafts.delete(storedValue.key);
                        }
                        continue;
                    }
                    if (
                        isObject(storedValue) &&
                        storedValue.userId === userId &&
                        typeof storedValue.key === 'string'
                    ) {
                        if (
                            currentGeneration &&
                            isOperationCompletionDraftRecord(storedValue) &&
                            storedValue.writerGeneration ===
                                currentGeneration.generation
                        ) {
                            continue;
                        }
                        drafts.delete(storedValue.key);
                        count += 1;
                    }
                }
                for (const storedValue of storedQueueValues) {
                    if (
                        !isObject(storedValue) ||
                        storedValue.userId !== userId ||
                        typeof storedValue.key !== 'string'
                    ) {
                        continue;
                    }
                    if (
                        currentGeneration &&
                        storedValue.writerGeneration ===
                            currentGeneration.generation
                    ) {
                        continue;
                    }
                    queue.delete(storedValue.key);
                    count += 1;
                }
                await requestOperationCompletionStoreResult(
                    drafts.put({
                        expiresAt:
                            now +
                            OPERATION_COMPLETION_DRAFT_REVOCATION_MAX_AGE_MS,
                        key: operationCompletionDraftRevocationKey(
                            userId,
                            sessionIncarnation,
                        ),
                        kind: OPERATION_COMPLETION_DRAFT_REVOCATION_KIND,
                        revokedAt: now,
                        schemaVersion:
                            OPERATION_COMPLETION_DRAFT_SCHEMA_VERSION,
                        sessionIncarnation,
                        userId,
                    }),
                );
                if (!currentGeneration) {
                    const logoutNonce =
                        rotateOperationCompletionDraftLogoutNonce(userId);
                    await requestOperationCompletionStoreResult(
                        drafts.put({
                            generation: newDraftId(),
                            key: operationCompletionDraftGenerationKey(userId),
                            kind: OPERATION_COMPLETION_DRAFT_GENERATION_KIND,
                            logoutNonce,
                            schemaVersion:
                                OPERATION_COMPLETION_DRAFT_SCHEMA_VERSION,
                            sessionIncarnation: null,
                            updatedAt: Date.now(),
                            userId,
                        }),
                    );
                }
                return count;
            },
        );
        broadcastOperationCompletionDraftLogout(userId, sessionIncarnation);
        return { deletedCount, status: 'ok' };
    } catch {
        return { status: 'unavailable' };
    }
}

export function operationCompletionDraftPhotoToFile(
    photo: OperationCompletionDraftPhoto,
) {
    return new File([photo.blob], photo.name, {
        lastModified: photo.lastModified,
        type: photo.type,
    });
}
