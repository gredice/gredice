'use client';

import { DriverTrackingStatus } from '../components/DriverTrackingStatus';
import type {
    DriverTrackingReason,
    DriverTrackingStatus as DriverTrackingStatusValue,
} from '../lib/driverTracking';

export function DriverTrackingStatusStory({
    status,
    reason = null,
    sampleQueued,
}: {
    status: DriverTrackingStatusValue;
    reason?: DriverTrackingReason;
    sampleQueued?: boolean;
}) {
    return (
        <DriverTrackingStatus
            tracking={{
                status,
                reason,
                lastAttemptAt: null,
                lastAcceptedAt: '2026-07-15T12:00:00.000Z',
                nextRetryAt: null,
                retryAttempt: status === 'retrying' ? 2 : 0,
                sampleQueued: sampleQueued ?? status === 'retrying',
                retryNow: () => undefined,
                recheckPermission: () => undefined,
            }}
        />
    );
}
