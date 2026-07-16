'use client';

import {
    AppRouterContext,
    type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useCallback } from 'react';
import { OperationCompletionSyncSettings } from '../app/settings/_components/OperationCompletionSyncSettings';
import { FarmAnalyticsProvider } from '../components/analytics/FarmAnalyticsProvider';
import type { FarmAnalyticsCapture } from '../components/analytics/farmAnalytics';
import { OperationCompletionSyncBanner } from '../components/offline/OperationCompletionSyncBanner';
import { OperationCompletionSyncProvider } from '../components/offline/OperationCompletionSyncProvider';
import type { FarmOperationCompletionSyncMode } from '../lib/offline/operationCompletionSyncMode';

declare global {
    interface Window {
        __farmSyncRouterRefreshes?: number;
    }
}

const router = {
    back: () => undefined,
    bfcacheId: 'farm-sync-provider-harness',
    forward: () => undefined,
    prefetch: () => undefined,
    push: () => undefined,
    refresh: () => {
        window.__farmSyncRouterRefreshes =
            (window.__farmSyncRouterRefreshes ?? 0) + 1;
    },
    replace: () => undefined,
} satisfies AppRouterInstance;

export function OperationCompletionSyncProviderHarness({
    accountId = 'account-test',
    enabled = true,
    mode = 'enabled',
    sessionIncarnation = 'session-test',
    userId = 'user-test',
}: {
    accountId?: string;
    enabled?: boolean;
    mode?: FarmOperationCompletionSyncMode;
    sessionIncarnation?: string;
    userId?: string;
}) {
    const capture = useCallback<FarmAnalyticsCapture>(
        (eventName, properties) => {
            window.dispatchEvent(
                new CustomEvent('gredice:farm-sync-analytics', {
                    detail: { eventName, properties },
                }),
            );
        },
        [],
    );

    return (
        <AppRouterContext.Provider value={router}>
            <FarmAnalyticsProvider capture={capture}>
                <OperationCompletionSyncProvider
                    accountId={accountId}
                    enabled={enabled}
                    mode={mode}
                    sessionIncarnation={sessionIncarnation}
                    userId={userId}
                >
                    <OperationCompletionSyncBanner />
                    <main className="mx-auto w-full max-w-xl p-3">
                        <OperationCompletionSyncSettings />
                    </main>
                </OperationCompletionSyncProvider>
            </FarmAnalyticsProvider>
        </AppRouterContext.Provider>
    );
}
