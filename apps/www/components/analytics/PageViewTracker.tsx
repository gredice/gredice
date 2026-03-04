'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function PageViewTracker() {
    const pathname = usePathname();

    useEffect(() => {
        // Avoid including search/hash to prevent leaking potentially sensitive data in analytics
        const eventSourceUrl = `${window.location.origin}${pathname}`;
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
