'use client';

import { DriverRouteContinuity } from '../components/DriverRouteContinuity';
import { useDriverRouteWakeLock } from '../hooks/useDriverRouteWakeLock';

export function DriverRouteContinuityStory({
    runId = 'run-one',
    trackingAvailable = true,
}: {
    runId?: string | null;
    trackingAvailable?: boolean;
}) {
    const state = useDriverRouteWakeLock({ runId });
    return (
        <DriverRouteContinuity
            state={state}
            trackingAvailable={trackingAvailable}
        />
    );
}
