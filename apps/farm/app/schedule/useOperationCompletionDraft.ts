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
import {
    type HandoffOperationCompletionDraftToQueueResult,
    handoffOperationCompletionDraftToQueue,
    loadOperationCompletionQueueItem,
    type OperationCompletionQueueSummary,
    subscribeToOperationCompletionQueueChanges,
    summarizeOperationCompletionQueueItem,
} from '../../lib/offline/operationCompletionQueueStore';

const NOTES_SAVE_DEBOUNCE_MS = 300;

export type OperationCompletionDraftGate =
    | { kind: 'checking' }
    | { kind: 'found'; draft: OperationCompletionDraft }
    | { kind: 'queued'; item: OperationCompletionQueueSummary }
    | { kind: 'server_confirmed'; item: OperationCompletionQueueSummary }
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

export type OperationCompletionDraftHandoffInput = {
    operationLabel: string;
    scheduleDateKey?: string;
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
    const gateRef = useRef(gate);
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
    gateRef.current = gate;

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

    const showQueueGate = useCallback(
        (item: OperationCompletionQueueSummary) => {
            activeRef.current = false;
            persistedRevisionByScopeRef.current.delete(scopeIdentity);
            setGate({
                item,
                kind:
                    item.state === 'server_confirmed'
                        ? 'server_confirmed'
                        : 'queued',
            });
            setNotice(null);
        },
        [scopeIdentity],
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

    const handoffToQueue = useCallback(
        async ({
            operationLabel,
            scheduleDateKey,
        }: OperationCompletionDraftHandoffInput): Promise<HandoffOperationCompletionDraftToQueueResult> => {
            const generation = generationRef.current;
            const lease = leaseRef.current;
            activeRef.current = false;
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
            if (!lease) {
                markSessionChanged();
                return { reason: 'session_changed', status: 'error' };
            }

            let handoffResult: HandoffOperationCompletionDraftToQueueResult = {
                reason: 'storage_unavailable',
                status: 'error',
            };
            writeQueueRef.current = writeQueueRef.current
                .catch(() => undefined)
                .then(async () => {
                    if (generationRef.current !== generation) {
                        handoffResult = {
                            reason: 'session_changed',
                            status: 'error',
                        };
                        return;
                    }
                    const currentForm = {
                        notes: latestFormRef.current.notes,
                        photos: [...latestFormRef.current.photos],
                    };
                    handoffResult =
                        await handoffOperationCompletionDraftToQueue(
                            {
                                ...scope,
                                notes: currentForm.notes,
                                operationLabel,
                                photos: currentForm.photos,
                                ...(scheduleDateKey === undefined
                                    ? {}
                                    : { scheduleDateKey }),
                            },
                            {
                                expectedDraftRevisionId:
                                    persistedRevisionByScopeRef.current.get(
                                        scopeIdentity,
                                    ) ?? null,
                                lease,
                            },
                        );
                    if (generationRef.current !== generation) {
                        handoffResult = {
                            reason: 'session_changed',
                            status: 'error',
                        };
                        return;
                    }
                    if (handoffResult.status !== 'error') {
                        showQueueGate(handoffResult.item);
                        setSaveState({ kind: 'idle' });
                        return;
                    }
                    if (handoffResult.reason === 'session_changed') {
                        markSessionChanged();
                        return;
                    }
                    if (
                        handoffResult.reason === 'server_confirmed' ||
                        handoffResult.reason === 'draft_changed' ||
                        handoffResult.reason === 'incompatible' ||
                        handoffResult.reason === 'queue_conflict'
                    ) {
                        const queueResult =
                            await loadOperationCompletionQueueItem(
                                scope,
                                lease,
                            );
                        if (generationRef.current !== generation) {
                            handoffResult = {
                                reason: 'session_changed',
                                status: 'error',
                            };
                            return;
                        }
                        if (
                            queueResult.status === 'found' ||
                            queueResult.status === 'expired'
                        ) {
                            showQueueGate(
                                summarizeOperationCompletionQueueItem(
                                    queueResult.item,
                                ),
                            );
                            return;
                        }
                        if (queueResult.status === 'session_changed') {
                            handoffResult = {
                                reason: 'session_changed',
                                status: 'error',
                            };
                            markSessionChanged();
                            return;
                        }
                        if (queueResult.status === 'unavailable') {
                            setNotice('storage_unavailable');
                            return;
                        }
                        const draftResult = await loadOperationCompletionDraft(
                            scope,
                            lease,
                        );
                        if (generationRef.current !== generation) {
                            handoffResult = {
                                reason: 'session_changed',
                                status: 'error',
                            };
                            return;
                        }
                        if (draftResult.status === 'found') {
                            persistedRevisionByScopeRef.current.set(
                                scopeIdentity,
                                draftResult.draft.revisionId,
                            );
                            setGate({
                                draft: draftResult.draft,
                                kind: 'found',
                            });
                            return;
                        }
                        if (
                            draftResult.status === 'missing' &&
                            draftResult.reason === 'incompatible'
                        ) {
                            persistedRevisionByScopeRef.current.set(
                                scopeIdentity,
                                draftResult.revisionId,
                            );
                            setGate({
                                kind: 'stale',
                                revisionId: draftResult.revisionId,
                            });
                            return;
                        }
                        if (draftResult.status === 'session_changed') {
                            handoffResult = {
                                reason: 'session_changed',
                                status: 'error',
                            };
                            markSessionChanged();
                            return;
                        }
                        if (draftResult.status === 'unavailable') {
                            setNotice('storage_unavailable');
                            return;
                        }
                        activeRef.current = true;
                        setGate({ kind: 'none' });
                        if (draftResult.status === 'expired') {
                            setNotice('expired');
                        }
                        return;
                    }
                    activeRef.current = true;
                });
            await writeQueueRef.current;
            return handoffResult;
        },
        [markSessionChanged, scope, scopeIdentity, showQueueGate],
    );

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
            .then(async (leaseResult) => {
                if (leaseResult?.status !== 'ready') {
                    return {
                        kind: 'draft' as const,
                        result:
                            leaseResult?.status === 'unavailable'
                                ? ({
                                      status: 'unavailable',
                                  } satisfies LoadOperationCompletionDraftResult)
                                : sessionChangedLoadResult(),
                    };
                }
                const queueResult = await loadOperationCompletionQueueItem(
                    scope,
                    leaseResult.lease,
                );
                if (queueResult.status !== 'missing') {
                    return { kind: 'queue' as const, result: queueResult };
                }
                return {
                    kind: 'draft' as const,
                    result: await loadOperationCompletionDraft(
                        scope,
                        leaseResult.lease,
                    ),
                };
            })
            .then((loaded) => {
                settled = true;
                if (cancelled || generationRef.current !== generation) {
                    return;
                }
                if (loaded.kind === 'queue') {
                    const result = loaded.result;
                    if (
                        result.status === 'found' ||
                        result.status === 'expired'
                    ) {
                        showQueueGate(
                            summarizeOperationCompletionQueueItem(result.item),
                        );
                        return;
                    }
                    if (result.status === 'session_changed') {
                        markSessionChanged();
                        return;
                    }
                    activeRef.current = false;
                    persistedRevisionByScopeRef.current.delete(scopeIdentity);
                    setGate({ kind: 'none' });
                    setNotice('storage_unavailable');
                    return;
                }
                const result = loaded.result;
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
    }, [enabled, markSessionChanged, scope, scopeIdentity, showQueueGate]);

    useEffect(() => {
        if (!enabled) {
            return;
        }
        const generation = generationRef.current;
        let cancelled = false;
        let refreshSequence = 0;
        const refreshQueueGate = () => {
            const lease = leaseRef.current;
            if (!lease || sessionChangedRef.current) {
                return;
            }
            refreshSequence += 1;
            const currentRefreshSequence = refreshSequence;
            void loadOperationCompletionQueueItem(scope, lease).then(
                (result) => {
                    if (
                        cancelled ||
                        !mountedRef.current ||
                        generationRef.current !== generation ||
                        currentRefreshSequence !== refreshSequence
                    ) {
                        return;
                    }
                    if (
                        result.status === 'found' ||
                        result.status === 'expired'
                    ) {
                        showQueueGate(
                            summarizeOperationCompletionQueueItem(result.item),
                        );
                        return;
                    }
                    if (result.status === 'session_changed') {
                        markSessionChanged();
                        return;
                    }
                    if (result.status === 'unavailable') {
                        setNotice('storage_unavailable');
                        return;
                    }
                    if (
                        gateRef.current.kind !== 'queued' &&
                        gateRef.current.kind !== 'server_confirmed'
                    ) {
                        return;
                    }
                    activeRef.current = result.status === 'missing';
                    setGate({ kind: 'none' });
                },
            );
        };
        const unsubscribe = subscribeToOperationCompletionQueueChanges(
            userId,
            accountId,
            refreshQueueGate,
        );
        return () => {
            cancelled = true;
            refreshSequence += 1;
            unsubscribe();
        };
    }, [accountId, enabled, markSessionChanged, scope, showQueueGate, userId]);

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
        handoffToQueue,
        notice,
        resume,
        saveState,
    };
}
