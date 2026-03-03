'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function PageViewTracker() {
    const pathname = usePathname();

    useEffect(() => {
        // Use pathname directly to satisfy exhaustive-deps rule (re-triggers on route change)
        const eventSourceUrl = `${window.location.origin}${pathname}${window.location.search}${window.location.hash}`;
        void fetch('/api/tracking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                eventName: 'PageView',
                eventSourceUrl,
            }),
            keepalive: true,
        });
    }, [pathname]);

    return null;
}
