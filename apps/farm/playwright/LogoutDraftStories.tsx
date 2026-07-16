'use client';

import {
    AppRouterContext,
    type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useState } from 'react';
import { CompleteOperationModal } from '../app/schedule/CompleteOperationModal';
import { LogoutButton } from '../components/auth/LogoutButton';
import { OperationCompletionDraftStoreHarness } from './OperationCompletionDraftStoreHarness';

const nextNavigationRouter = {
    back: () => undefined,
    bfcacheId: 'farm-logout-draft-story',
    forward: () => undefined,
    prefetch: () => undefined,
    push: () => undefined,
    refresh: () => undefined,
    replace: () => undefined,
} satisfies AppRouterInstance;

export function LogoutWithLateModalMountStory({
    accountId,
    expectedEntityId,
    expectedTaskVersionEventId,
    operationId,
    sessionIncarnation,
    userId,
}: {
    accountId: string;
    expectedEntityId: number;
    expectedTaskVersionEventId: number;
    operationId: number;
    sessionIncarnation: string;
    userId: string;
}) {
    const [showStaleModal, setShowStaleModal] = useState(false);

    return (
        <AppRouterContext.Provider value={nextNavigationRouter}>
            <OperationCompletionDraftStoreHarness />
            <LogoutButton
                sessionIncarnation={sessionIncarnation}
                userId={userId}
            />
            <button type="button" onClick={() => setShowStaleModal(true)}>
                Prikaži stari zadatak
            </button>
            {showStaleModal ? (
                <CompleteOperationModal
                    accountId={accountId}
                    conditions={{ completionAttachNotes: true }}
                    defaultOpen
                    expectedEntityId={expectedEntityId}
                    expectedTaskVersionEventId={expectedTaskVersionEventId}
                    label="Zadatak iz odjavljene sesije"
                    operationId={operationId}
                    sessionIncarnation={sessionIncarnation}
                    userId={userId}
                />
            ) : null}
        </AppRouterContext.Provider>
    );
}

export function StaleLogoutWithCurrentModalStory({
    accountId,
    currentSessionIncarnation,
    currentUserId,
    expectedEntityId,
    expectedTaskVersionEventId,
    operationId,
    staleSessionIncarnation,
    staleUserId,
}: {
    accountId: string;
    currentSessionIncarnation: string;
    currentUserId: string;
    expectedEntityId: number;
    expectedTaskVersionEventId: number;
    operationId: number;
    staleSessionIncarnation: string;
    staleUserId: string;
}) {
    return (
        <AppRouterContext.Provider value={nextNavigationRouter}>
            <OperationCompletionDraftStoreHarness />
            <CompleteOperationModal
                accountId={accountId}
                conditions={{ completionAttachNotes: true }}
                defaultOpen
                expectedEntityId={expectedEntityId}
                expectedTaskVersionEventId={expectedTaskVersionEventId}
                label="Zadatak trenutačne sesije"
                operationId={operationId}
                sessionIncarnation={currentSessionIncarnation}
                userId={currentUserId}
            />
            <LogoutButton
                sessionIncarnation={staleSessionIncarnation}
                userId={staleUserId}
            />
        </AppRouterContext.Provider>
    );
}
