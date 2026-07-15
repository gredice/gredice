'use client';

import { useEffect } from 'react';
import {
    acquireOperationCompletionDraftLease,
    captureOperationCompletionDraftLogoutNonce,
    discardOperationCompletionDraft,
    loadOperationCompletionDraft,
    markOperationCompletionDraftServerConfirmed,
    operationCompletionDraftPhotoToFile,
    purgeOperationCompletionDraftsForUser,
    saveOperationCompletionDraft,
} from '../lib/offline/operationCompletionDraftStore';

declare global {
    interface Window {
        __operationCompletionDraftStoreTestApi?: {
            acquireLease: typeof acquireOperationCompletionDraftLease;
            captureLogoutNonce: typeof captureOperationCompletionDraftLogoutNonce;
            discard: typeof discardOperationCompletionDraft;
            load: typeof loadOperationCompletionDraft;
            markServerConfirmed: typeof markOperationCompletionDraftServerConfirmed;
            photoToFile: typeof operationCompletionDraftPhotoToFile;
            purgeUser: typeof purgeOperationCompletionDraftsForUser;
            save: typeof saveOperationCompletionDraft;
        };
    }
}

export function OperationCompletionDraftStoreHarness() {
    useEffect(() => {
        window.__operationCompletionDraftStoreTestApi = {
            acquireLease: acquireOperationCompletionDraftLease,
            captureLogoutNonce: captureOperationCompletionDraftLogoutNonce,
            discard: discardOperationCompletionDraft,
            load: loadOperationCompletionDraft,
            markServerConfirmed: markOperationCompletionDraftServerConfirmed,
            photoToFile: operationCompletionDraftPhotoToFile,
            purgeUser: purgeOperationCompletionDraftsForUser,
            save: saveOperationCompletionDraft,
        };

        return () => {
            delete window.__operationCompletionDraftStoreTestApi;
        };
    }, []);

    return <output data-testid="operation-draft-store-ready">ready</output>;
}
