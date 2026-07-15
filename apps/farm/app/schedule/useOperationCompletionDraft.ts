'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    type AcquireOperationCompletionDraftLeaseResult,
    acquireOperationCompletionDraftLease,
    captureOperationCompletionDraftLogoutNonce,
    discardOperationCompletionDraft,
    type LoadOperationCompletionDraftResult,
    loadOperationCompletionDraft,
    markOperationCompletionDraftServerConfirmed,
    type OperationCompletionDraft,
    type OperationCompletionDraftLease,
    type OperationCompletionDraftPhotoInput,
    type OperationCompletionDraftScope,
    operationCompletionDraftPhotoToFile,
    type SaveOperationCompletionDraftResult,
    saveOperationCompletionDraft,
    subscribeToOperationCompletionDraftLogout,
} from '../../lib/offline/operationCompletionDraftStore';

const NOTES_SAVE_DEBOUNCE_MS = 300;

export type OperationCompletionDraftGate =
    | { kind: 'checking' }
    | { kind: 'found'; draft: OperationCompletionDraft }
    | { kind: 'none' }
    | { kind: 'session_changed' }
    | { kind: 'stale'; revisionId: string };

export type OperationCompletionDraftNotice =
    | 'expired'
    | 'storage_unavailable'
    | null;

export type OperationCompletionDraftSaveState =
    | { kind: 'idle' }
    | { kind: 'saved' }
    | { kind: 'saving' }
    | {
          kind: 'error';
          reason: Extract<
              SaveOperationCompletionDraftResult,
              { status: 'error' }
          >['reason'];
      };

type UseOperationCompletionDraftInput = OperationCompletionDraftScope & {
    enabled: boolean;
    notes: string;
    photos: OperationCompletionDraftPhotoInput[];
    sessionIncarnation: string;
};

type RestoredOperationCompletionDraft = {
    notes: string;
    photos: OperationCompletionDraftPhotoInput[];
};

function photoSignature(photos: OperationCompletionDraftPhotoInput[]) {
    return photos
        .map(
            ({ file, id }) =>
                `${id}:${file.name}:${file.type}:${file.size.toString()}:${file.lastModified.toString()}`,
        )
        .join('|');
}

function sessionChangedLoadResult(): LoadOperationCompletionDraftResult {
    return { status: 'session_changed' };
}

export function useOperationCompletionDraft({
    accountId,
    enabled,
    expectedEntityId,
    expectedTaskVersionEventId,
    notes,
    operationId,
    photos,
    requirementsFingerprint,
    sessionIncarnation,
    userId,
}: UseOperationCompletionDraftInput) {
    const scope = useMemo<OperationCompletionDraftScope>(
        () => ({
            accountId,
            expectedEntityId,
            expectedTaskVersionEventId,
            operationId,
            requirementsFingerprint,
            userId,
        }),
        [
            accountId,
            expectedEntityId,
            expectedTaskVersionEventId,
            operationId,
            requirementsFingerprint,
            userId,
        ],
    );
    const currentPhotoSignature = photoSignature(photos);
    const currentFormSignature = `${notes.length.toString()}:${notes}:${currentPhotoSignature}`;
    const scopeIdentity = JSON.stringify([
        userId,
        accountId,
        operationId,
        expectedEntityId,
        expectedTaskVersionEventId,
        requirementsFingerprint,
        sessionIncarnation,
    ]);
    const [gate, setGate] = useState<OperationCompletionDraftGate>({
        kind: 'checking',
    });
    const [notice, setNotice] = useState<OperationCompletionDraftNotice>(null);
    const [saveState, setSaveState] =
        useState<OperationCompletionDraftSaveState>({ kind: 'idle' });
    const activeRef = useRef(false);
    const generationRef = useRef(0);
    const leaseRef = useRef<OperationCompletionDraftLease | null>(null);
    const leasePromiseRef =
        useRef<Promise<AcquireOperationCompletionDraftLeaseResult> | null>(
            null,
        );
    const mountedRef = useRef(true);
    const persistedRevisionByScopeRef = useRef(new Map<string, string>());
    const sessionChangedRef = useRef(false);
    const loadedScopeIdentityRef = useRef<string | null>(null);
    const resetScopeIdentityRef = useRef<string | null>(null);
    const latestFormRef = useRef({ notes, photos });
    const previousPhotoSignatureRef = useRef(currentPhotoSignature);
    const previousFormSignatureRef = useRef(currentFormSignature);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

    latestFormRef.current = { notes, photos };

    const updateSaveState = useCallback(
        (
            nextState: OperationCompletionDraftSaveState,
            generation = generationRef.current,
        ) => {
            if (mountedRef.current && generationRef.current === generation) {
                setSaveState(nextState);
            }
        },
        [],
    );

    const markSessionChanged = useCallback(() => {
        if (sessionChangedRef.current) {
            return;
        }
        sessionChangedRef.current = true;
        generationRef.current += 1;
        activeRef.current = false;
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        persistedRevisionByScopeRef.current.clear();
        setGate({ kind: 'session_changed' });
        setNotice(null);
        setSaveState({ kind: 'error', reason: 'session_changed' });
    }, []);

    useEffect(() => {
        let cancelled = false;
        sessionChangedRef.current = false;
        leaseRef.current = null;
        const capturedLogoutNonce =
            captureOperationCompletionDraftLogoutNonce(userId);
        const leasePromise = acquireOperationCompletionDraftLease(
            userId,
            capturedLogoutNonce,
            sessionIncarnation,
        );
        leasePromiseRef.current = leasePromise;
        void leasePromise.then((result) => {
            if (cancelled || sessionChangedRef.current) {
                return;
            }
            if (result.status === 'ready') {
                leaseRef.current = result.lease;
                return;
            }
            if (result.status === 'session_changed') {
                markSessionChanged();
                return;
            }
            activeRef.current = false;
            setGate({ kind: 'none' });
            setNotice('storage_unavailable');
        });
        const unsubscribe = subscribeToOperationCompletionDraftLogout(
            userId,
            sessionIncarnation,
            markSessionChanged,
        );

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [markSessionChanged, sessionIncarnation, userId]);

    const enqueueCurrentDraftWrite = useCallback(() => {
        if (!activeRef.current) {
            return writeQueueRef.current;
        }
        const generation = generationRef.current;
        const lease = leaseRef.current;
        if (!lease) {
            return writeQueueRef.current;
        }
        const currentForm = {
            notes: latestFormRef.current.notes,
            photos: [...latestFormRef.current.photos],
        };
        const writeScopeIdentity = scopeIdentity;

        const write = async () => {
            updateSaveState({ kind: 'saving' }, generation);
            const expectedRevisionId =
                persistedRevisionByScopeRef.current.get(writeScopeIdentity) ??
                null;
            const result = await saveOperationCompletionDraft(
                {
                    ...scope,
                    notes: currentForm.notes,
                    photos: currentForm.photos,
                },
                { expectedRevisionId, lease },
            );
            if (generationRef.current !== generation) {
                return;
            }
            if (result.status === 'error') {
                if (result.reason === 'session_changed') {
                    markSessionChanged();
                    return;
                }
                updateSaveState(
                    { kind: 'error', reason: result.reason },
                    generation,
                );
                return;
            }

            if (result.revisionId) {
                persistedRevisionByScopeRef.current.set(
                    writeScopeIdentity,
                    result.revisionId,
                );
            } else {
                persistedRevisionByScopeRef.current.delete(writeScopeIdentity);
            }
            updateSaveState(
                result.action === 'saved'
                    ? { kind: 'saved' }
                    : { kind: 'idle' },
                generation,
            );
        };

        writeQueueRef.current = writeQueueRef.current
            .catch(() => undefined)
            .then(write);
        return writeQueueRef.current;
    }, [markSessionChanged, scope, scopeIdentity, updateSaveState]);

    const flush = useCallback(() => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        return enqueueCurrentDraftWrite();
    }, [enqueueCurrentDraftWrite]);

    useEffect(() => {
        if (resetScopeIdentityRef.current === scopeIdentity) {
            return;
        }
        resetScopeIdentityRef.current = scopeIdentity;
        generationRef.current += 1;
        loadedScopeIdentityRef.current = null;
        activeRef.current = false;
        setGate({ kind: 'checking' });
        setNotice(null);
        setSaveState({ kind: 'idle' });
    }, [scopeIdentity]);

    useEffect(() => {
        if (!enabled || loadedScopeIdentityRef.current === scopeIdentity) {
            return;
        }
        loadedScopeIdentityRef.current = scopeIdentity;
        const generation = generationRef.current;
        let cancelled = false;
        let settled = false;

        void writeQueueRef.current
            .catch(() => undefined)
            .then(() => leasePromiseRef.current)
            .then((leaseResult) =>
                leaseResult?.status === 'ready'
                    ? loadOperationCompletionDraft(scope, leaseResult.lease)
                    : Promise.resolve(
                          leaseResult?.status === 'unavailable'
                              ? ({
                                    status: 'unavailable',
                                } satisfies LoadOperationCompletionDraftResult)
                              : sessionChangedLoadResult(),
                      ),
            )
            .then((result) => {
                settled = true;
                if (cancelled || generationRef.current !== generation) {
                    return;
                }
                if (result.status === 'found') {
                    persistedRevisionByScopeRef.current.set(
                        scopeIdentity,
                        result.draft.revisionId,
                    );
                    setGate({ draft: result.draft, kind: 'found' });
                    return;
                }
                if (
                    result.status === 'missing' &&
                    result.reason === 'incompatible'
                ) {
                    persistedRevisionByScopeRef.current.set(
                        scopeIdentity,
                        result.revisionId,
                    );
                    setGate({
                        kind: 'stale',
                        revisionId: result.revisionId,
                    });
                    return;
                }

                if (result.status === 'session_changed') {
                    markSessionChanged();
                    return;
                }

                activeRef.current = result.status !== 'unavailable';
                persistedRevisionByScopeRef.current.delete(scopeIdentity);
                setGate({ kind: 'none' });
                if (result.status === 'expired') {
                    setNotice('expired');
                } else if (result.status === 'unavailable') {
                    setNotice('storage_unavailable');
                }
            });

        return () => {
            cancelled = true;
            if (!settled && loadedScopeIdentityRef.current === scopeIdentity) {
                loadedScopeIdentityRef.current = null;
            }
        };
    }, [enabled, markSessionChanged, scope, scopeIdentity]);

    useEffect(() => {
        if (previousFormSignatureRef.current === currentFormSignature) {
            return;
        }
        previousFormSignatureRef.current = currentFormSignature;
        const photosChanged =
            previousPhotoSignatureRef.current !== currentPhotoSignature;
        previousPhotoSignatureRef.current = currentPhotoSignature;
        if (!activeRef.current || gate.kind !== 'none') {
            return;
        }
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }
        saveTimerRef.current = setTimeout(
            () => {
                saveTimerRef.current = null;
                void enqueueCurrentDraftWrite();
            },
            photosChanged ? 0 : NOTES_SAVE_DEBOUNCE_MS,
        );

        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
        };
    }, [
        currentFormSignature,
        currentPhotoSignature,
        enqueueCurrentDraftWrite,
        gate.kind,
    ]);

    useEffect(() => {
        const flushWhenHidden = () => {
            if (document.visibilityState === 'hidden') {
                void flush();
            }
        };
        const flushBeforePageLeaves = () => {
            void flush();
        };

        document.addEventListener('visibilitychange', flushWhenHidden);
        window.addEventListener('pagehide', flushBeforePageLeaves);
        return () => {
            document.removeEventListener('visibilitychange', flushWhenHidden);
            window.removeEventListener('pagehide', flushBeforePageLeaves);
        };
    }, [flush]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(
        () => () => {
            void flush();
        },
        [flush],
    );

    const resume = useCallback((): RestoredOperationCompletionDraft | null => {
        if (gate.kind !== 'found') {
            return null;
        }
        activeRef.current = true;
        setGate({ kind: 'none' });
        setNotice(null);
        setSaveState({ kind: 'saved' });
        return {
            notes: gate.draft.notes,
            photos: gate.draft.photos.map((photo) => ({
                file: operationCompletionDraftPhotoToFile(photo),
                id: photo.id,
            })),
        };
    }, [gate]);

    const discard = useCallback(async () => {
        if (gate.kind !== 'found' && gate.kind !== 'stale') {
            return true;
        }
        const generation = generationRef.current;
        const lease = leaseRef.current;
        if (!lease) {
            markSessionChanged();
            return false;
        }
        const expectedRevisionId =
            gate.kind === 'found' ? gate.draft.revisionId : gate.revisionId;
        const result = await discardOperationCompletionDraft(scope, {
            expectedRevisionId,
            lease,
        });
        if (generationRef.current !== generation) {
            return false;
        }
        if (result.status === 'session_changed') {
            markSessionChanged();
            return false;
        }
        if (result.status === 'unavailable') {
            setSaveState({
                kind: 'error',
                reason: 'storage_unavailable',
            });
            return false;
        }
        if (result.status === 'conflict') {
            const latest = await loadOperationCompletionDraft(scope, lease);
            if (generationRef.current !== generation) {
                return false;
            }
            if (latest.status === 'session_changed') {
                markSessionChanged();
                return false;
            }
            if (latest.status === 'unavailable') {
                setSaveState({
                    kind: 'error',
                    reason: 'storage_unavailable',
                });
                return false;
            }
            if (latest.status === 'found') {
                persistedRevisionByScopeRef.current.set(
                    scopeIdentity,
                    latest.draft.revisionId,
                );
                setGate({ draft: latest.draft, kind: 'found' });
                setSaveState({ kind: 'error', reason: 'draft_changed' });
                return false;
            }
            if (
                latest.status === 'missing' &&
                latest.reason === 'incompatible'
            ) {
                persistedRevisionByScopeRef.current.set(
                    scopeIdentity,
                    latest.revisionId,
                );
                setGate({
                    kind: 'stale',
                    revisionId: latest.revisionId,
                });
                setSaveState({ kind: 'error', reason: 'draft_changed' });
                return false;
            }
        }
        persistedRevisionByScopeRef.current.delete(scopeIdentity);
        activeRef.current = true;
        setGate({ kind: 'none' });
        setNotice(null);
        setSaveState({ kind: 'idle' });
        return true;
    }, [gate, markSessionChanged, scope, scopeIdentity]);

    const discardAfterServerSuccess = useCallback(async () => {
        const generation = generationRef.current;
        activeRef.current = false;
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        let localConfirmationSucceeded = false;
        const lease = leaseRef.current;
        if (!lease) {
            markSessionChanged();
            return false;
        }
        writeQueueRef.current = writeQueueRef.current
            .catch(() => undefined)
            .then(async () => {
                const result =
                    await markOperationCompletionDraftServerConfirmed(
                        scope,
                        lease,
                    );
                if (result.status === 'session_changed') {
                    markSessionChanged();
                    return;
                }
                localConfirmationSucceeded = result.status === 'ok';
                if (
                    localConfirmationSucceeded &&
                    generationRef.current === generation
                ) {
                    persistedRevisionByScopeRef.current.delete(scopeIdentity);
                }
            });
        await writeQueueRef.current;
        return localConfirmationSucceeded;
    }, [markSessionChanged, scope, scopeIdentity]);

    return {
        discard,
        discardAfterServerSuccess,
        flush,
        gate,
        notice,
        resume,
        saveState,
    };
}
