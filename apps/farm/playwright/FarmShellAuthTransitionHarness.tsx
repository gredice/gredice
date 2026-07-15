'use client';

import { AuthProvider } from '@gredice/ui/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { FarmAnalyticsProvider } from '../components/analytics/FarmAnalyticsProvider';
import { FarmTodayViewTracker } from '../components/analytics/FarmTodayViewTracker';
import type { FarmAnalyticsCapture } from '../components/analytics/farmAnalytics';
import { FarmShellAuthGate } from '../components/navigation/FarmShellAuthGate';

async function delayedCurrentUser() {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    return { id: 'farmer-test' };
}

function TodayMountProbe() {
    const [mountMarker] = useState(() => crypto.randomUUID());

    return (
        <main data-today-mount-marker={mountMarker}>
            <h1>Danas</h1>
            <FarmTodayViewTracker
                dataStatus="ready"
                hasNextTask
                workState="hasWork"
            />
        </main>
    );
}

export function FarmShellAuthTransitionHarness() {
    const [capturedEvents, setCapturedEvents] = useState<string[]>([]);
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: { retry: false },
                },
            }),
    );
    const capture = useCallback<FarmAnalyticsCapture>((eventName) => {
        setCapturedEvents((current) => [...current, eventName]);
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider currentUserFactory={delayedCurrentUser}>
                <FarmAnalyticsProvider capture={capture}>
                    <FarmShellAuthGate pathname="/">
                        <TodayMountProbe />
                    </FarmShellAuthGate>
                    <output data-today-view-count>
                        {
                            capturedEvents.filter(
                                (eventName) =>
                                    eventName === 'farm_today_viewed',
                            ).length
                        }
                    </output>
                </FarmAnalyticsProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}
