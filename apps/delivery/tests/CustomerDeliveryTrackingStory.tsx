'use client';

import { useState } from 'react';
import { CustomerDeliveryTracking } from '../components/CustomerDeliveryTracking';

export function CustomerDeliveryTrackingFromRequest({
    requestAgeMs = 0,
    ...props
}: Omit<Parameters<typeof CustomerDeliveryTracking>[0], 'requestTiming'> & {
    requestAgeMs?: number;
}) {
    const [requestTiming] = useState(() => ({
        monotonicMs: performance.now() - requestAgeMs,
        wallMs: Date.now() - requestAgeMs,
    }));
    return (
        <CustomerDeliveryTracking {...props} requestTiming={requestTiming} />
    );
}
