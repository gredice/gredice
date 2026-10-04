'use client';

import { createContext, useContext } from 'react';
import type { FarmOperationCompletionSyncMode } from '../../lib/offline/operationCompletionSyncMode';

export type OperationCompletionSyncPublicState =
    | 'queued'
    | 'syncing'
    | 'failed'
    | 'server_confirmed';

export type OperationCompletionSyncPublicItem = {
    createdAt: number;
    failureMessage: string | null;
    key: string;
    label: string | null;
    operationId: number;
    retryable: boolean;
    serverState: 'completed' | 'pendingVerification' | null;
    state: OperationCompletionSyncPublicState;
};

export type OperationCompletionSyncContextValue = {
    discard: (key: string) => Promise<boolean>;
    isStorageAvailable: boolean;
    items: OperationCompletionSyncPublicItem[];
    mode: FarmOperationCompletionSyncMode;
    retry: (key: string) => Promise<void>;
    retryAll: () => Promise<void>;
};

export const OperationCompletionSyncContext =
    createContext<OperationCompletionSyncContextValue | null>(null);

export function useOperationCompletionSync() {
    return useContext(OperationCompletionSyncContext);
}
