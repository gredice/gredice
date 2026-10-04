'use client';

import { usePostHog } from '@posthog/next';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getFarmAnalyticsPage } from './farmAnalyticsPage';

export function FarmPageViewTracker() {
    const pathname = usePathname();
    const posthog = usePostHog();

    useEffect(() => {
        if (!posthog) {
            return;
        }

        const page = getFarmAnalyticsPage(pathname);

        posthog.capture('$pageview', {
            route_group: page.routeGroup,
            surface: 'farm',
        });
    }, [pathname, posthog]);

    return null;
}
