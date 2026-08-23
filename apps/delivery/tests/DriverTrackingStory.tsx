'use client';

import { DriverTrackingStatus } from '../components/DriverTrackingStatus';
import { useDriverTracking } from '../hooks/useDriverTracking';
import type { DeliveryTrackingStatus } from '../lib/deliveryDashboardTypes';

export function DriverTrackingStory({
    runId = 'run-one',
    serverStatus = 'unavailable',
    lastAcceptedAt = null,
    refreshedAt = '2026-07-15T12:00:00.000Z',
}: {
    runId?: string | null;
    serverStatus?: DeliveryTrackingStatus;
    lastAcceptedAt?: string | null;
    refreshedAt?: string;
}) {
    const tracking = useDriverTracking({
        runId,
        serverTracking: {
            status: serverStatus,
            lastAcceptedAt,
            mapAvailable: serverStatus === 'live' || serverStatus === 'delayed',
        },
        dashboardRefreshedAt: refreshedAt,
        onDashboardRefresh: () => {
            window.dispatchEvent(new Event('driver-dashboard-refresh'));
        },
    });

    return (
        <div
            data-last-accepted-at={tracking.lastAcceptedAt ?? ''}
            data-retry-attempt={tracking.retryAttempt}
            data-sample-queued={tracking.sampleQueued ? 'true' : 'false'}
            data-status={tracking.status}
        >
            <DriverTrackingStatus tracking={tracking} />
        </div>
    );
}
