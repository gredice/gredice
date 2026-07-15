'use client';

import { AuthProvider, useCurrentUser } from '@gredice/ui/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { FarmAnalyticsProvider } from '../components/analytics/FarmAnalyticsProvider';
import { FarmTodayViewTracker } from '../components/analytics/FarmTodayViewTracker';
import type { FarmAnalyticsCapture } from '../components/analytics/farmAnalytics';
import { FarmShellAuthGate } from '../components/navigation/FarmShellAuthGate';

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

function AuthResolutionProbe() {
    const currentUser = useCurrentUser();

    return (
        <output data-auth-resolution>
            {currentUser.data ? 'resolved' : 'loading'}
        </output>
    );
}

export function FarmShellAuthTransitionHarness({
    userRole = 'farmer',
}: {
    userRole?: string;
}) {
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
    const currentUserFactory = useCallback(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        return {
            id: 'farmer-test',
            role: userRole,
            userName: 'Farmer Test',
        };
    }, [userRole]);

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider currentUserFactory={currentUserFactory}>
                <FarmAnalyticsProvider capture={capture}>
                    <AuthResolutionProbe />
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
