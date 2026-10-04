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
import {
    claimNextOperationCompletionQueueItem,
    clearOperationCompletionQueueAttachmentUploads,
    discardOperationCompletionQueueItem,
    handoffOperationCompletionDraftToQueue,
    listOperationCompletionQueueItems,
    loadOperationCompletionQueueItem,
    markOperationCompletionQueueAttachmentUploaded,
    markOperationCompletionQueueFailed,
    markOperationCompletionQueueServerConfirmed,
    releaseOperationCompletionQueueClaimForRetry,
    renewOperationCompletionQueueClaim,
    retryOperationCompletionQueueItem,
    subscribeToOperationCompletionQueueChanges,
} from '../lib/offline/operationCompletionQueueStore';

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
            queue: {
                claimNext: typeof claimNextOperationCompletionQueueItem;
                clearAttachmentUploads: typeof clearOperationCompletionQueueAttachmentUploads;
                discard: typeof discardOperationCompletionQueueItem;
                handoff: typeof handoffOperationCompletionDraftToQueue;
                list: typeof listOperationCompletionQueueItems;
                load: typeof loadOperationCompletionQueueItem;
                markAttachmentUploaded: typeof markOperationCompletionQueueAttachmentUploaded;
                markFailed: typeof markOperationCompletionQueueFailed;
                markServerConfirmed: typeof markOperationCompletionQueueServerConfirmed;
                releaseForRetry: typeof releaseOperationCompletionQueueClaimForRetry;
                renewClaim: typeof renewOperationCompletionQueueClaim;
                retry: typeof retryOperationCompletionQueueItem;
                subscribe: typeof subscribeToOperationCompletionQueueChanges;
            };
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
            queue: {
                claimNext: claimNextOperationCompletionQueueItem,
                clearAttachmentUploads:
                    clearOperationCompletionQueueAttachmentUploads,
                discard: discardOperationCompletionQueueItem,
                handoff: handoffOperationCompletionDraftToQueue,
                list: listOperationCompletionQueueItems,
                load: loadOperationCompletionQueueItem,
                markAttachmentUploaded:
                    markOperationCompletionQueueAttachmentUploaded,
                markFailed: markOperationCompletionQueueFailed,
                markServerConfirmed:
                    markOperationCompletionQueueServerConfirmed,
                releaseForRetry: releaseOperationCompletionQueueClaimForRetry,
                renewClaim: renewOperationCompletionQueueClaim,
                retry: retryOperationCompletionQueueItem,
                subscribe: subscribeToOperationCompletionQueueChanges,
            },
        };

        return () => {
            delete window.__operationCompletionDraftStoreTestApi;
        };
    }, []);

    return <output data-testid="operation-draft-store-ready">ready</output>;
}
