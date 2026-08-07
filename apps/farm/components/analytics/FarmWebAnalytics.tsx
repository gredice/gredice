'use client';

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/react';
import { getFarmAnalyticsSafeUrl } from './farmAnalyticsPrivacy';

export function sanitizeFarmVercelAnalyticsEvent(
    event: BeforeSendEvent,
): BeforeSendEvent {
    return {
        ...event,
        url: getFarmAnalyticsSafeUrl(event.url),
    };
}

export function FarmWebAnalytics() {
    return <Analytics beforeSend={sanitizeFarmVercelAnalyticsEvent} />;
}
