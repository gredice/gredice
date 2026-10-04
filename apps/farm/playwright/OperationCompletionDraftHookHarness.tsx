'use client';

import { useState } from 'react';
import { useOperationCompletionDraft } from '../app/schedule/useOperationCompletionDraft';
import {
    acquireOperationCompletionDraftLease,
    captureOperationCompletionDraftLogoutNonce,
    type OperationCompletionDraftScope,
} from '../lib/offline/operationCompletionDraftStore';
import {
    claimNextOperationCompletionQueueItem,
    markOperationCompletionQueueServerConfirmed,
} from '../lib/offline/operationCompletionQueueStore';

type OperationCompletionDraftHookHarnessProps =
    OperationCompletionDraftScope & {
        operationLabel: string;
        scheduleDateKey?: string;
        sessionIncarnation: string;
    };

export function OperationCompletionDraftHookHarness({
    operationLabel,
    scheduleDateKey,
    sessionIncarnation,
    ...scope
}: OperationCompletionDraftHookHarnessProps) {
    const [notes, setNotes] = useState('');
    const [handoffResult, setHandoffResult] = useState<unknown>(null);
    const [confirmationResult, setConfirmationResult] = useState<unknown>(null);
    const localDraft = useOperationCompletionDraft({
        ...scope,
        enabled: true,
        notes,
        photos: [],
        sessionIncarnation,
    });

    const confirmQueuedItem = async () => {
        if (
            localDraft.gate.kind !== 'queued' &&
            localDraft.gate.kind !== 'server_confirmed'
        ) {
            setConfirmationResult({ status: 'missing' });
            return;
        }
        if (localDraft.gate.kind === 'server_confirmed') {
            setConfirmationResult({ status: 'ok' });
            return;
        }
        const leaseResult = await acquireOperationCompletionDraftLease(
            scope.userId,
            captureOperationCompletionDraftLogoutNonce(scope.userId),
            sessionIncarnation,
        );
        if (leaseResult.status !== 'ready') {
            setConfirmationResult(leaseResult);
            return;
        }
        const claimId = crypto.randomUUID();
        const claimResult = await claimNextOperationCompletionQueueItem(
            { accountId: scope.accountId, userId: scope.userId },
            { claimId, lease: leaseResult.lease },
        );
        if (claimResult.status !== 'claimed') {
            setConfirmationResult(claimResult);
            return;
        }
        setConfirmationResult(
            await markOperationCompletionQueueServerConfirmed(
                {
                    claimId,
                    key: claimResult.item.key,
                    serverState: 'completed',
                    submissionId: claimResult.item.submissionId,
                },
                leaseResult.lease,
            ),
        );
    };

    return (
        <>
            <label htmlFor="operation-completion-hook-notes">Napomena</label>
            <textarea
                id="operation-completion-hook-notes"
                onChange={(event) => setNotes(event.currentTarget.value)}
                value={notes}
            />
            <button
                onClick={async () => {
                    setHandoffResult(
                        await localDraft.handoffToQueue({
                            operationLabel,
                            ...(scheduleDateKey === undefined
                                ? {}
                                : { scheduleDateKey }),
                        }),
                    );
                }}
                type="button"
            >
                Predaj u red
            </button>
            <button onClick={confirmQueuedItem} type="button">
                Označi potvrđeno
            </button>
            <output data-testid="operation-draft-gate">
                {JSON.stringify(localDraft.gate)}
            </output>
            <output data-testid="operation-draft-save-state">
                {JSON.stringify(localDraft.saveState)}
            </output>
            <output data-testid="operation-draft-handoff-result">
                {JSON.stringify(handoffResult)}
            </output>
            <output data-testid="operation-draft-confirmation-result">
                {JSON.stringify(confirmationResult)}
            </output>
        </>
    );
}
